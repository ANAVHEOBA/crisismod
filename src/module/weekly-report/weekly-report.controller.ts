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

export const getCurrentWeeklyReportHandler = async (c: HonoContext) => {
  const requestContext = await getRuntimeRequestContext(c);
  const report = await getCurrentWeeklyReport(requestContext.subredditId);

  return c.json(
    {
      success: true,
      data: {
        report,
      },
    },
    200
  );
};

export const generateWeeklyReportHandler = async (c: HonoContext) => {
  const payload = validateGenerateWeeklyReportPayload(await c.req.json());
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
  const report = await generateWeeklyReport(requestContext, payload.data);

  return c.json(
    {
      success: true,
      message: 'Weekly report generated.',
      data: {
        report,
      },
    },
    200
  );
};

export const getWeeklyReportHistoryHandler = async (c: HonoContext) => {
  const requestContext = await getRuntimeRequestContext(c);
  const limit = validateLimit(c.req.query('limit'));
  const reports = await getWeeklyReports(requestContext.subredditId);

  return c.json(
    {
      success: true,
      data: {
        reports: reports.slice(0, limit),
      },
    },
    200
  );
};

export const publishWeeklyReportHandler = async (c: HonoContext) => {
  const payload = validatePublishWeeklyReportPayload(await c.req.json());
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
  const report = await publishWeeklyReport(requestContext, payload.data);
  if (!report) {
    return c.json(
      {
        success: false,
        errors: ['Weekly report not found.'],
      },
      404
    );
  }

  return c.json(
    {
      success: true,
      message: 'Weekly report marked as published.',
      data: {
        report,
      },
    },
    200
  );
};
