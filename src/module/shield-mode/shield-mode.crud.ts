import type {
  ActivateShieldModePayload,
  ShieldModeAuditAction,
  ShieldModeAuditLog,
  ShieldModeConfig,
  ShieldModeConfigPatch,
  ShieldModeCounters,
  ShieldModeSession,
} from './shield-mode.interface';
import { readJson, writeJson } from '../../config/store';
import type { AppRequestContext } from '../../config/request-context';

const MAX_AUDIT_LOGS = 100;

const sessionKey = (subredditId: string) => `shield-mode:session:${subredditId}`;
const configKey = (subredditId: string) => `shield-mode:config:${subredditId}`;
const auditKey = (subredditId: string) => `shield-mode:audit:${subredditId}`;

const defaultCounters = (): ShieldModeCounters => ({
  heldPosts: 0,
  heldComments: 0,
  flaggedItems: 0,
});

const defaultConfig = (): ShieldModeConfig => ({
  presetName: 'Default Shield',
  defaultDurationHours: 6,
  subredditRules: ['Be civil', 'No spam or self-promotion'],
  minAccountAgeDays: 7,
  minSubredditKarma: 10,
  holdLinks: true,
  triggerPhrases: ['raid', 'kill yourself', 'discord.gg/'],
  strictRules: ['Rule 1', 'Rule 3'],
  appealResponseTemplate:
    'Thanks for the appeal. We reviewed this under {{rule}} and the recommended outcome is {{recommended_outcome}}. {{explanation}}',
  alertWebhookUrl: null,
});

const defaultSession = (
  subredditId: string,
  subredditName: string
): ShieldModeSession => ({
  id: `shield-session-${subredditId}`,
  subredditId,
  subredditName,
  status: 'inactive',
  activatedBy: null,
  activatedAt: null,
  deactivatedAt: null,
  expiresAt: null,
  reason: null,
  configSnapshot: null,
  counters: defaultCounters(),
  expiryJobId: null,
});

const now = () => new Date().toISOString();

const appendAuditLog = async (
  subredditId: string,
  action: ShieldModeAuditAction,
  moderator: string,
  note: string | null
) => {
  const key = auditKey(subredditId);
  const existingLogs = await readJson<ShieldModeAuditLog[]>(key, []);
  const nextLog: ShieldModeAuditLog = {
    id: `${action}-${Date.now()}`,
    action,
    moderator,
    createdAt: now(),
    note,
  };

  const nextLogs = [nextLog, ...existingLogs].slice(0, MAX_AUDIT_LOGS);
  await writeJson(key, nextLogs);
};

const mergeConfig = (
  currentConfig: ShieldModeConfig,
  patch?: ShieldModeConfigPatch
): ShieldModeConfig => {
  if (!patch) {
    return currentConfig;
  }

  return {
    presetName: patch.presetName ?? currentConfig.presetName,
    defaultDurationHours:
      patch.defaultDurationHours ?? currentConfig.defaultDurationHours,
    subredditRules: patch.subredditRules ?? currentConfig.subredditRules,
    minAccountAgeDays:
      patch.minAccountAgeDays ?? currentConfig.minAccountAgeDays,
    minSubredditKarma:
      patch.minSubredditKarma ?? currentConfig.minSubredditKarma,
    holdLinks: patch.holdLinks ?? currentConfig.holdLinks,
    triggerPhrases: patch.triggerPhrases ?? currentConfig.triggerPhrases,
    strictRules: patch.strictRules ?? currentConfig.strictRules,
    appealResponseTemplate:
      patch.appealResponseTemplate ?? currentConfig.appealResponseTemplate,
    alertWebhookUrl:
      patch.alertWebhookUrl !== undefined
        ? patch.alertWebhookUrl
        : currentConfig.alertWebhookUrl,
  };
};

const maybeExpireSession = async (
  session: ShieldModeSession
): Promise<ShieldModeSession> => {
  if (
    session.status !== 'active' ||
    !session.expiresAt ||
    Date.parse(session.expiresAt) > Date.now()
  ) {
    return session;
  }

  const expiredSession: ShieldModeSession = {
    ...session,
    status: 'expired',
    deactivatedAt: now(),
    expiresAt: null,
    expiryJobId: null,
  };

  await writeJson(sessionKey(session.subredditId), expiredSession);
  await appendAuditLog(
    session.subredditId,
    'expired',
    'system',
    'Shield Mode duration elapsed.'
  );

  return expiredSession;
};

export const getShieldModeConfig = async (subredditId: string) =>
  readJson<ShieldModeConfig>(configKey(subredditId), defaultConfig());

export const updateShieldModeConfig = async (
  subredditId: string,
  moderator: string,
  patch: ShieldModeConfigPatch
) => {
  const currentConfig = await getShieldModeConfig(subredditId);
  const nextConfig = mergeConfig(currentConfig, patch);

  await writeJson(configKey(subredditId), nextConfig);
  await appendAuditLog(subredditId, 'config_updated', moderator, null);

  return nextConfig;
};

export const getShieldModeSession = async (
  subredditId: string,
  subredditName: string
) => {
  const session = await readJson<ShieldModeSession>(
    sessionKey(subredditId),
    defaultSession(subredditId, subredditName)
  );

  if (session.subredditName !== subredditName) {
    session.subredditName = subredditName;
    await writeJson(sessionKey(subredditId), session);
  }

  return maybeExpireSession(session);
};

export const activateShieldMode = async (
  requestContext: AppRequestContext,
  payload: ActivateShieldModePayload
) => {
  const currentConfig = await getShieldModeConfig(requestContext.subredditId);
  const nextConfig = mergeConfig(currentConfig, payload.configOverride);

  if (payload.configOverride) {
    await writeJson(configKey(requestContext.subredditId), nextConfig);
  }

  const activatedAt = now();
  const nextSession: ShieldModeSession = {
    id: `shield-session-${Date.now()}`,
    subredditId: requestContext.subredditId,
    subredditName: requestContext.subredditName,
    status: 'active',
    activatedBy: requestContext.moderatorUsername,
    activatedAt,
    deactivatedAt: null,
    expiresAt: new Date(
      Date.now() + payload.durationHours * 60 * 60 * 1000
    ).toISOString(),
    reason:
      payload.reason ?? 'Spike in reports, links, or new-account activity.',
    configSnapshot: nextConfig,
    counters: {
      heldPosts: 0,
      heldComments: 0,
      flaggedItems: 0,
    },
    expiryJobId: null,
  };

  await writeJson(sessionKey(requestContext.subredditId), nextSession);
  await appendAuditLog(
    requestContext.subredditId,
    'activated',
    requestContext.moderatorUsername,
    nextSession.reason
  );

  return nextSession;
};

export const deactivateShieldMode = async (
  requestContext: AppRequestContext,
  note: string | null
) => {
  const currentSession = await getShieldModeSession(
    requestContext.subredditId,
    requestContext.subredditName
  );

  const nextSession: ShieldModeSession = {
    ...currentSession,
    status: 'inactive',
    deactivatedAt: now(),
    expiresAt: null,
    reason: note ?? currentSession.reason,
    expiryJobId: null,
  };

  await writeJson(sessionKey(requestContext.subredditId), nextSession);
  await appendAuditLog(
    requestContext.subredditId,
    'deactivated',
    requestContext.moderatorUsername,
    note
  );

  return nextSession;
};

export const getShieldModeAuditLogs = async (
  subredditId: string,
  limit: number
) => {
  const logs = await readJson<ShieldModeAuditLog[]>(auditKey(subredditId), []);
  return logs.slice(0, limit);
};

export const setShieldModeExpiryJobId = async (
  subredditId: string,
  subredditName: string,
  expiryJobId: string | null
) => {
  const session = await getShieldModeSession(subredditId, subredditName);
  const nextSession: ShieldModeSession = {
    ...session,
    expiryJobId,
  };

  await writeJson(sessionKey(subredditId), nextSession);
  return nextSession;
};

export const expireShieldModeSession = async (
  subredditId: string,
  subredditName: string
) => {
  const session = await getShieldModeSession(subredditId, subredditName);
  if (session.status !== 'active') {
    return session;
  }

  const expiredSession: ShieldModeSession = {
    ...session,
    status: 'expired',
    deactivatedAt: now(),
    expiresAt: null,
    expiryJobId: null,
  };

  await writeJson(sessionKey(subredditId), expiredSession);
  await appendAuditLog(
    subredditId,
    'expired',
    'system',
    'Shield Mode duration elapsed.'
  );

  return expiredSession;
};

export const recordShieldModeIntervention = async (
  requestContext: AppRequestContext,
  action: Extract<ShieldModeAuditAction, 'held_post' | 'held_comment' | 'flagged'>,
  note: string | null
) => {
  const session = await getShieldModeSession(
    requestContext.subredditId,
    requestContext.subredditName
  );

  if (session.status !== 'active') {
    return session;
  }

  const nextCounters: ShieldModeCounters = {
    heldPosts:
      session.counters.heldPosts + (action === 'held_post' ? 1 : 0),
    heldComments:
      session.counters.heldComments + (action === 'held_comment' ? 1 : 0),
    flaggedItems:
      session.counters.flaggedItems +
      (action === 'flagged' || action === 'held_post' || action === 'held_comment'
        ? 1
        : 0),
  };

  const nextSession: ShieldModeSession = {
    ...session,
    counters: nextCounters,
  };

  await writeJson(sessionKey(requestContext.subredditId), nextSession);
  await appendAuditLog(
    requestContext.subredditId,
    action,
    requestContext.moderatorUsername,
    note
  );

  return nextSession;
};
