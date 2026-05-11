import type { Context as HonoContext } from 'hono';
import {
  activateShieldMode,
  deactivateShieldMode,
  getShieldModeAuditLogs,
  getShieldModeConfig,
  getShieldModeSession,
  setShieldModeExpiryJobId,
  updateShieldModeConfig,
} from './shield-mode.crud';
import {
  validateActivateShieldModePayload,
  validateAuditLimit,
  validateDeactivateShieldModePayload,
  validateShieldModeConfigPatch,
} from './shield-mode.schema';
import { getRuntimeRequestContext } from '../../config/request-context';
import {
  cancelScheduledJob,
  scheduleShieldModeExpiry,
} from '../../core/scheduler';

export const getShieldModeStatus = async (c: HonoContext) => {
  const requestContext = await getRuntimeRequestContext(c);
  const session = await getShieldModeSession(
    requestContext.subredditId,
    requestContext.subredditName
  );
  const config = await getShieldModeConfig(requestContext.subredditId);

  return c.json(
    {
      success: true,
      data: {
        session,
        config,
        counters: session.counters,
      },
    },
    200
  );
};

export const activateShieldModeHandler = async (c: HonoContext) => {
  const payload = validateActivateShieldModePayload(await c.req.json());
  if (!payload.ok) {
    return c.json(
      {
        success: false,
        errors: payload.errors,
      },
      400
    );
  }

  const requestContext = await getRuntimeRequestContext(c);
  const currentSession = await getShieldModeSession(
    requestContext.subredditId,
    requestContext.subredditName
  );
  await cancelScheduledJob(currentSession.expiryJobId);

  const session = await activateShieldMode(requestContext, payload.data);
  const expiryJobId = session.expiresAt
    ? await scheduleShieldModeExpiry(
        requestContext.subredditId,
        requestContext.subredditName,
        session.expiresAt
      )
    : null;
  const scheduledSession = await setShieldModeExpiryJobId(
    requestContext.subredditId,
    requestContext.subredditName,
    expiryJobId
  );
  const appliedRules = session.configSnapshot
    ? [
        `Min account age: ${session.configSnapshot.minAccountAgeDays} day(s)`,
        `Min subreddit karma: ${session.configSnapshot.minSubredditKarma}`,
        session.configSnapshot.holdLinks ? 'Hold links enabled' : 'Hold links disabled',
        `Strict rules: ${session.configSnapshot.strictRules.join(', ')}`,
      ]
    : [];

  return c.json(
    {
      success: true,
      message: `Shield Mode activated for ${payload.data.durationHours} hour(s).`,
      data: {
        session: scheduledSession,
        appliedRules,
      },
    },
    200
  );
};

export const deactivateShieldModeHandler = async (c: HonoContext) => {
  const payload = validateDeactivateShieldModePayload(await c.req.json());
  if (!payload.ok) {
    return c.json(
      {
        success: false,
        errors: payload.errors,
      },
      400
    );
  }

  const requestContext = await getRuntimeRequestContext(c);
  const currentSession = await getShieldModeSession(
    requestContext.subredditId,
    requestContext.subredditName
  );
  await cancelScheduledJob(currentSession.expiryJobId);

  const session = await deactivateShieldMode(
    requestContext,
    payload.data.reason ?? null
  );

  return c.json(
    {
      success: true,
      message: 'Shield Mode deactivated.',
      data: {
        session,
      },
    },
    200
  );
};

export const updateShieldModeConfigHandler = async (c: HonoContext) => {
  const payload = validateShieldModeConfigPatch(await c.req.json());
  if (!payload.ok) {
    return c.json(
      {
        success: false,
        errors: payload.errors,
      },
      400
    );
  }

  const requestContext = await getRuntimeRequestContext(c);
  const config = await updateShieldModeConfig(
    requestContext.subredditId,
    requestContext.moderatorUsername,
    payload.data
  );

  return c.json(
    {
      success: true,
      message: 'Shield Mode config updated.',
      data: {
        config,
      },
    },
    200
  );
};

export const getShieldModeAuditHandler = async (c: HonoContext) => {
  const requestContext = await getRuntimeRequestContext(c);
  const limit = validateAuditLimit(c.req.query('limit'));
  const logs = await getShieldModeAuditLogs(requestContext.subredditId, limit);

  return c.json(
    {
      success: true,
      data: {
        logs,
      },
    },
    200
  );
};
