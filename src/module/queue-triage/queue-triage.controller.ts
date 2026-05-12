import type { Context as HonoContext } from 'hono';
import { getRuntimeRequestContext } from '../../config/request-context';
import {
  applyQueueAction,
  getQueueAuditLogs,
  getQueueItems,
  getQueueSummary,
  scoreQueueItem,
} from './queue-triage.crud';
import {
  validateLimit,
  validateQueueActionPayload,
  validateQueueScorePayload,
} from './queue-triage.schema';
import { jsonError, jsonSuccess } from '../../routes/response';

export const getQueueItemsHandler = async (c: HonoContext) => {
  const requestContext = await getRuntimeRequestContext(c);
  const items = await getQueueItems(requestContext.subredditId);

  return jsonSuccess(c, {
    items,
  });
};

export const scoreQueueItemHandler = async (c: HonoContext) => {
  const payload = validateQueueScorePayload(await c.req.json());
  if (!payload.ok) {
    return jsonError(c, payload.errors);
  }

  const requestContext = await getRuntimeRequestContext(c);
  const item = await scoreQueueItem(requestContext, payload.data);

  return jsonSuccess(
    c,
    {
      item,
    },
    {
      message: 'Queue item scored and stored.',
    }
  );
};

export const applyQueueActionHandler = async (c: HonoContext) => {
  const payload = validateQueueActionPayload(await c.req.json());
  if (!payload.ok) {
    return jsonError(c, payload.errors);
  }

  const requestContext = await getRuntimeRequestContext(c);
  let item;
  try {
    item = await applyQueueAction(requestContext, payload.data);
  } catch (error) {
    return jsonError(c, ['Failed to apply the Reddit moderation action.'], {
      detail: error instanceof Error ? error.message : 'Unknown error',
      status: 500,
    });
  }

  if (!item) {
    return jsonError(c, ['Queue item not found.'], {
      status: 404,
    });
  }

  return jsonSuccess(
    c,
    {
      item,
    },
    {
      message: 'Queue action recorded.',
    }
  );
};

export const getQueueAuditHandler = async (c: HonoContext) => {
  const requestContext = await getRuntimeRequestContext(c);
  const limit = validateLimit(c.req.query('limit'));
  const logs = await getQueueAuditLogs(requestContext.subredditId, limit);

  return jsonSuccess(c, {
    logs,
  });
};

export const getQueueSummaryHandler = async (c: HonoContext) => {
  const requestContext = await getRuntimeRequestContext(c);
  const summary = await getQueueSummary(requestContext.subredditId);

  return jsonSuccess(c, {
    summary,
  });
};
