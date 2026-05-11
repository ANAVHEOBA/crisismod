import 'dotenv/config';
import { redis } from '@devvit/web/server';

const localStore = new Map<string, string>();
const localCurlTestMode = process.env.LOCAL_CURL_TEST === '1';
const externalRedisUrl = process.env.REDIS_URL?.trim() || null;
let hasLoggedRedisReadFallback = false;
let hasLoggedRedisWriteFallback = false;
let hasLoggedExternalRedisFailure = false;
type ExternalRedisClient = {
  isOpen: boolean;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  connect(): Promise<unknown>;
  on(event: 'error', listener: (error: unknown) => void): void;
};
type CreateRedisClient = (options: {
  url: string;
  socket: {
    connectTimeout: number;
  };
}) => ExternalRedisClient;

let externalRedisClient: ExternalRedisClient | null = null;
let externalRedisConnectPromise: Promise<ExternalRedisClient | null> | null = null;
let externalRedisFactoryPromise: Promise<CreateRedisClient | null> | null = null;

const logRedisFallback = (
  mode: 'read' | 'write',
  key: string,
  error: unknown
) => {
  if (localCurlTestMode) {
    return;
  }

  if (mode === 'read' && !hasLoggedRedisReadFallback) {
    hasLoggedRedisReadFallback = true;
    console.warn(`Redis read failed for ${key}, falling back to memory.`, error);
  }

  if (mode === 'write' && !hasLoggedRedisWriteFallback) {
    hasLoggedRedisWriteFallback = true;
    console.warn(
      `Redis write failed for ${key}, persisting in local memory only.`,
      error
    );
  }
};

const logExternalRedisFailure = (error: unknown) => {
  if (hasLoggedExternalRedisFailure) {
    return;
  }

  hasLoggedExternalRedisFailure = true;
  console.warn('External Redis connection failed. Falling back to Devvit/local store.', error);
};

const getCreateRedisClient = async () => {
  if (!externalRedisUrl) {
    return null;
  }

  if (externalRedisFactoryPromise) {
    return externalRedisFactoryPromise;
  }

  externalRedisFactoryPromise = (async () => {
    try {
      const redisModuleName = 'redis';
      const redisModule = (await import(
        /* @vite-ignore */ redisModuleName
      )) as { createClient: CreateRedisClient };
      return redisModule.createClient;
    } catch (error) {
      logExternalRedisFailure(error);
      externalRedisFactoryPromise = null;
      return null;
    }
  })();

  return externalRedisFactoryPromise;
};

const getExternalRedisClient = async () => {
  if (!externalRedisUrl) {
    return null;
  }

  if (externalRedisClient?.isOpen) {
    return externalRedisClient;
  }

  if (externalRedisConnectPromise) {
    return externalRedisConnectPromise;
  }

  const createRedisClient = await getCreateRedisClient();
  if (!createRedisClient) {
    return null;
  }

  const client = createRedisClient({
    url: externalRedisUrl,
    socket: {
      connectTimeout: 5000,
    },
  });

  client.on('error', (error) => {
    logExternalRedisFailure(error);
  });

  externalRedisConnectPromise = client
    .connect()
    .then(() => {
      externalRedisClient = client;
      return client;
    })
    .catch((error) => {
      logExternalRedisFailure(error);
      externalRedisConnectPromise = null;
      externalRedisClient = null;
      return null;
    });

  return externalRedisConnectPromise;
};

export const readString = async (key: string) => {
  const externalClient = await getExternalRedisClient();
  if (externalClient) {
    try {
      return await externalClient.get(key);
    } catch (error) {
      logExternalRedisFailure(error);
    }
  }

  try {
    const value = await redis.get(key);
    if (value !== null) {
      return value;
    }
  } catch (error) {
    logRedisFallback('read', key, error);
  }

  return localStore.get(key) ?? null;
};

export const writeString = async (key: string, value: string) => {
  const externalClient = await getExternalRedisClient();
  if (externalClient) {
    try {
      await externalClient.set(key, value);
      localStore.set(key, value);
      return;
    } catch (error) {
      logExternalRedisFailure(error);
    }
  }

  try {
    await redis.set(key, value);
  } catch (error) {
    logRedisFallback('write', key, error);
  }

  localStore.set(key, value);
};

export const readJson = async <T>(key: string, fallback: T): Promise<T> => {
  const value = await readString(key);
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.error(`Failed to parse stored JSON for ${key}.`, error);
    return fallback;
  }
};

export const writeJson = async <T>(key: string, value: T) => {
  await writeString(key, JSON.stringify(value));
};
