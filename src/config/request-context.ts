import type { Context as HonoContext } from 'hono';
import { context, reddit } from '@devvit/web/server';

export type AppRequestContext = {
  subredditId: string;
  subredditName: string;
  moderatorUsername: string;
};

export const makeRequestContext = (
  subredditId: string,
  subredditName: string,
  moderatorUsername: string
): AppRequestContext => ({
  subredditId,
  subredditName,
  moderatorUsername,
});

const fallbackRequestContext = makeRequestContext(
  't5_crisismod_local',
  'crisismod_local',
  'local_mod'
);

const getHeaderValue = (c: HonoContext, key: string) => {
  const value = c.req.header(key);
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const getRequestContext = (c: HonoContext): AppRequestContext => ({
  subredditId:
    getHeaderValue(c, 'x-subreddit-id') ??
    context.subredditId ??
    fallbackRequestContext.subredditId,
  subredditName:
    getHeaderValue(c, 'x-subreddit-name') ??
    context.subredditName ??
    fallbackRequestContext.subredditName,
  moderatorUsername:
    getHeaderValue(c, 'x-moderator-username') ??
    fallbackRequestContext.moderatorUsername,
});

export const getRuntimeRequestContext = async (
  c: HonoContext
): Promise<AppRequestContext> => {
  const requestContext = getRequestContext(c);
  if (requestContext.moderatorUsername !== fallbackRequestContext.moderatorUsername) {
    return requestContext;
  }

  try {
    const username = await reddit.getCurrentUsername();
    if (username) {
      return {
        ...requestContext,
        moderatorUsername: username,
      };
    }
  } catch (error) {
    if (process.env.LOCAL_CURL_TEST !== '1') {
      console.warn('Failed to resolve the runtime moderator username.', error);
    }
  }

  return requestContext;
};
