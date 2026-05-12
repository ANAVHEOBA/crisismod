import type { Context as HonoContext } from 'hono';
import { getRuntimeRequestContext } from '../../config/request-context';
import {
  generateWeeklyReport,
  getCurrentWeeklyReport,
  getWeeklyReports,
  publishWeeklyReport,
} from './weekly-report.crud';
import {
  validateGenerateWeeklyReportPayload,
  validateLimit,
  validatePublishWeeklyReportPayload,
} from './weekly-report.schema';
import { jsonError, jsonSuccess } from '../../routes/response';

export const getCurrentWeeklyReportHandler = async (c: HonoContext) => {
  const requestContext = await getRuntimeRequestContext(c);
  const report = await getCurrentWeeklyReport(requestContext.subredditId);

  return jsonSuccess(c, {
    report,
  });
};

export const generateWeeklyReportHandler = async (c: HonoContext) => {
  const payload = validateGenerateWeeklyReportPayload(await c.req.json());
  if (!payload.ok) {
    return jsonError(c, payload.errors);
  }

  const requestContext = await getRuntimeRequestContext(c);
  const report = await generateWeeklyReport(requestContext, payload.data);

  return jsonSuccess(
    c,
    {
      report,
    },
    {
      message: 'Weekly report generated.',
    }
  );
};

export const getWeeklyReportHistoryHandler = async (c: HonoContext) => {
  const requestContext = await getRuntimeRequestContext(c);
  const limit = validateLimit(c.req.query('limit'));
  const reports = await getWeeklyReports(requestContext.subredditId);

  return jsonSuccess(c, {
    reports: reports.slice(0, limit),
  });
};

export const publishWeeklyReportHandler = async (c: HonoContext) => {
  const payload = validatePublishWeeklyReportPayload(await c.req.json());
  if (!payload.ok) {
    return jsonError(c, payload.errors);
  }

  const requestContext = await getRuntimeRequestContext(c);
  const report = await publishWeeklyReport(requestContext, payload.data);
  if (!report) {
    return jsonError(c, ['Weekly report not found.'], {
      status: 404,
    });
  }

  return jsonSuccess(
    c,
    {
      report,
    },
    {
      message: 'Weekly report marked as published.',
    }
  );
};
