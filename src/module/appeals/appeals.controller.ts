import type { Context as HonoContext } from 'hono';
import { getRuntimeRequestContext } from '../../config/request-context';
import {
  getAppealMetrics,
  getAppeals,
  intakeAppeal,
  resolveAppeal,
} from './appeals.crud';
import {
  validateAppealIntakePayload,
  validateAppealResolvePayload,
} from './appeals.schema';

export const listAppealsHandler = async (c: HonoContext) => {
  const requestContext = await getRuntimeRequestContext(c);
  const appeals = await getAppeals(requestContext.subredditId);

  return c.json(
    {
      success: true,
      data: {
        appeals,
      },
    },
    200
  );
};

export const intakeAppealHandler = async (c: HonoContext) => {
  const payload = validateAppealIntakePayload(await c.req.json());
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
  const appeal = await intakeAppeal(requestContext, payload.data);

  return c.json(
    {
      success: true,
      message: 'Appeal intake stored.',
      data: {
        appeal,
      },
    },
    200
  );
};

export const resolveAppealHandler = async (c: HonoContext) => {
  const payload = validateAppealResolvePayload(await c.req.json());
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
  const appeal = await resolveAppeal(requestContext, payload.data);
  if (!appeal) {
    return c.json(
      {
        success: false,
        errors: ['Appeal not found.'],
      },
      404
    );
  }

  return c.json(
    {
      success: true,
      message: 'Appeal resolved.',
      data: {
        appeal,
      },
    },
    200
  );
};

export const getAppealMetricsHandler = async (c: HonoContext) => {
  const requestContext = await getRuntimeRequestContext(c);
  const metrics = await getAppealMetrics(requestContext.subredditId);

  return c.json(
    {
      success: true,
      data: {
        metrics,
      },
    },
    200
  );
};
