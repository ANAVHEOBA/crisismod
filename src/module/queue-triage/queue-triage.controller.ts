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

export const getQueueItemsHandler = async (c: HonoContext) => {
  const requestContext = await getRuntimeRequestContext(c);
  const items = await getQueueItems(requestContext.subredditId);

  return c.json(
    {
      success: true,
      data: {
        items,
      },
    },
    200
  );
};

export const scoreQueueItemHandler = async (c: HonoContext) => {
  const payload = validateQueueScorePayload(await c.req.json());
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
  const item = await scoreQueueItem(requestContext, payload.data);

  return c.json(
    {
      success: true,
      message: 'Queue item scored and stored.',
      data: {
        item,
      },
    },
    200
  );
};

export const applyQueueActionHandler = async (c: HonoContext) => {
  const payload = validateQueueActionPayload(await c.req.json());
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
  let item;
  try {
    item = await applyQueueAction(requestContext, payload.data);
  } catch (error) {
    return c.json(
      {
        success: false,
        errors: ['Failed to apply the Reddit moderation action.'],
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }

  if (!item) {
    return c.json(
      {
        success: false,
        errors: ['Queue item not found.'],
      },
      404
    );
  }

  return c.json(
    {
      success: true,
      message: 'Queue action recorded.',
      data: {
        item,
      },
    },
    200
  );
};

export const getQueueAuditHandler = async (c: HonoContext) => {
  const requestContext = await getRuntimeRequestContext(c);
  const limit = validateLimit(c.req.query('limit'));
  const logs = await getQueueAuditLogs(requestContext.subredditId, limit);

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

export const getQueueSummaryHandler = async (c: HonoContext) => {
  const requestContext = await getRuntimeRequestContext(c);
  const summary = await getQueueSummary(requestContext.subredditId);

  return c.json(
    {
      success: true,
      data: {
        summary,
      },
    },
    200
  );
};
