import { Hono } from 'hono';
import type { TaskRequest, TaskResponse } from '@devvit/scheduler';
import { makeRequestContext } from '../config/request-context';
import { expireShieldModeSession } from '../module/shield-mode/shield-mode.crud';
import {
  generateWeeklyReport,
  publishWeeklyReport,
} from '../module/weekly-report/weekly-report.crud';

type ShieldModeExpireTaskData = {
  subredditId: string;
  subredditName: string;
};

type WeeklyReportTaskData = {
  subredditId: string;
  subredditName: string;
  periodLabel?: string;
  autoPublish?: boolean;
};

export const tasks = new Hono();

tasks.post('/shield-mode-expire', async (c) => {
  const input = await c.req.json<TaskRequest<ShieldModeExpireTaskData>>();
  if (input.data?.subredditId && input.data?.subredditName) {
    await expireShieldModeSession(
      input.data.subredditId,
      input.data.subredditName
    );
  }

  return c.json<TaskResponse>({}, 200);
});

tasks.post('/weekly-report-generate', async (c) => {
  const input = await c.req.json<TaskRequest<WeeklyReportTaskData>>();
  if (input.data?.subredditId && input.data?.subredditName) {
    const requestContext = makeRequestContext(
      input.data.subredditId,
      input.data.subredditName,
      'crisismod_system'
    );
    const report = await generateWeeklyReport(requestContext, input.data.periodLabel
      ? { periodLabel: input.data.periodLabel }
      : {});

    if (input.data.autoPublish) {
      await publishWeeklyReport(requestContext, {
        reportId: report.id,
      });
    }
  }

  return c.json<TaskResponse>({}, 200);
});
