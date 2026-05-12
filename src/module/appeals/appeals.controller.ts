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
import { jsonError, jsonSuccess } from '../../routes/response';

export const listAppealsHandler = async (c: HonoContext) => {
  const requestContext = await getRuntimeRequestContext(c);
  const appeals = await getAppeals(requestContext.subredditId);

  return jsonSuccess(c, {
    appeals,
  });
};

export const intakeAppealHandler = async (c: HonoContext) => {
  const payload = validateAppealIntakePayload(await c.req.json());
  if (!payload.ok) {
    return jsonError(c, payload.errors);
  }

  const requestContext = await getRuntimeRequestContext(c);
  const appeal = await intakeAppeal(requestContext, payload.data);

  return jsonSuccess(
    c,
    {
      appeal,
    },
    {
      message: 'Appeal intake stored.',
    }
  );
};

export const resolveAppealHandler = async (c: HonoContext) => {
  const payload = validateAppealResolvePayload(await c.req.json());
  if (!payload.ok) {
    return jsonError(c, payload.errors);
  }

  const requestContext = await getRuntimeRequestContext(c);
  const appeal = await resolveAppeal(requestContext, payload.data);
  if (!appeal) {
    return jsonError(c, ['Appeal not found.'], {
      status: 404,
    });
  }

  return jsonSuccess(
    c,
    {
      appeal,
    },
    {
      message: 'Appeal resolved.',
    }
  );
};

export const getAppealMetricsHandler = async (c: HonoContext) => {
  const requestContext = await getRuntimeRequestContext(c);
  const metrics = await getAppealMetrics(requestContext.subredditId);

  return jsonSuccess(c, {
    metrics,
  });
};
