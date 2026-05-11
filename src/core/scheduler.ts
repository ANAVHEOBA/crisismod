import { scheduler } from '@devvit/web/server';
import { readString, writeString } from '../config/store';

const localCurlTestMode = process.env.LOCAL_CURL_TEST === '1';

export const SHIELD_MODE_EXPIRE_TASK = 'shieldModeExpire';
export const WEEKLY_REPORT_GENERATE_TASK = 'weeklyReportGenerate';

const weeklyScheduleKey = (subredditId: string) =>
  `scheduler:weekly-report:${subredditId}`;

export const cancelScheduledJob = async (jobId: string | null | undefined) => {
  if (!jobId || localCurlTestMode) {
    return;
  }

  try {
    await scheduler.cancelJob(jobId);
  } catch (error) {
    console.warn(`Failed to cancel scheduled job ${jobId}.`, error);
  }
};

export const scheduleShieldModeExpiry = async (
  subredditId: string,
  subredditName: string,
  expiresAt: string
) => {
  if (localCurlTestMode) {
    return `local-shield-expiry-${subredditId}-${Date.now()}`;
  }

  return scheduler.runJob({
    name: SHIELD_MODE_EXPIRE_TASK,
    runAt: new Date(expiresAt),
    data: {
      subredditId,
      subredditName,
    },
  });
};

export const ensureWeeklyReportSchedule = async (
  subredditId: string,
  subredditName: string
) => {
  const existingJobId = await readString(weeklyScheduleKey(subredditId));
  await cancelScheduledJob(existingJobId);

  const nextJobId = localCurlTestMode
    ? `local-weekly-report-${subredditId}`
    : await scheduler.runJob({
        name: WEEKLY_REPORT_GENERATE_TASK,
        cron: '0 17 * * 1',
        data: {
          subredditId,
          subredditName,
          periodLabel: 'Scheduled weekly report',
          autoPublish: false,
        },
      });

  await writeString(weeklyScheduleKey(subredditId), nextJobId);
  return nextJobId;
};
