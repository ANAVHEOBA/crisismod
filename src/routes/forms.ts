import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { getRuntimeRequestContext } from '../config/request-context';
import { triageTargetById } from '../core/runtime';
import {
  cancelScheduledJob,
  scheduleShieldModeExpiry,
} from '../core/scheduler';
import {
  activateShieldMode,
  deactivateShieldMode,
  getShieldModeSession,
  setShieldModeExpiryJobId,
  updateShieldModeConfig,
} from '../module/shield-mode/shield-mode.crud';
import {
  generateWeeklyReport,
  publishWeeklyReport,
} from '../module/weekly-report/weekly-report.crud';

type ConfigureCrisisModValues = {
  presetName?: string;
  defaultDurationHours?: number;
  subredditRules?: string;
  minAccountAgeDays?: number;
  minSubredditKarma?: number;
  holdLinks?: boolean;
  triggerPhrases?: string;
  strictRules?: string;
  appealResponseTemplate?: string;
  alertWebhookUrl?: string;
};

type ShieldActivationValues = {
  durationHours?: number;
  reason?: string;
};

type ShieldDeactivationValues = {
  reason?: string;
};

type ManualTriageValues = {
  targetId?: string;
  kind?: string;
  note?: string;
};

type WeeklyReportValues = {
  periodLabel?: string;
  publishNow?: boolean;
};

export const forms = new Hono();

const allowedDurations = new Set([1, 3, 6, 12, 24]);

const splitLines = (value: string | undefined) =>
  (value ?? '')
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);

const normalizeOptionalString = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const showToast = (message: string, status = 200) =>
  ({ status, body: { showToast: message } });

forms.post('/configure-crisismod-submit', async (c) => {
  const values = await c.req.json<ConfigureCrisisModValues>();
  const requestContext = await getRuntimeRequestContext(c);

  if (
    typeof values.defaultDurationHours !== 'number' ||
    !allowedDurations.has(values.defaultDurationHours)
  ) {
    return c.json<UiResponse>(
      showToast('Duration must be one of: 1, 3, 6, 12, 24.', 400).body,
      400
    );
  }

  if (
    typeof values.minAccountAgeDays !== 'number' ||
    typeof values.minSubredditKarma !== 'number' ||
    !values.presetName?.trim() ||
    !values.appealResponseTemplate?.trim()
  ) {
    return c.json<UiResponse>(
      showToast('Missing required configuration fields.', 400).body,
      400
    );
  }

  await updateShieldModeConfig(
    requestContext.subredditId,
    requestContext.moderatorUsername,
    {
      presetName: values.presetName.trim(),
      defaultDurationHours: values.defaultDurationHours as 1 | 3 | 6 | 12 | 24,
      subredditRules: splitLines(values.subredditRules),
      minAccountAgeDays: values.minAccountAgeDays,
      minSubredditKarma: values.minSubredditKarma,
      holdLinks: Boolean(values.holdLinks),
      triggerPhrases: splitLines(values.triggerPhrases),
      strictRules: splitLines(values.strictRules),
      appealResponseTemplate: values.appealResponseTemplate.trim(),
      alertWebhookUrl: normalizeOptionalString(values.alertWebhookUrl),
    }
  );

  return c.json<UiResponse>(
    {
      showToast: 'CrisisMod configuration saved.',
    },
    200
  );
});

forms.post('/activate-shield-mode-submit', async (c) => {
  const values = await c.req.json<ShieldActivationValues>();
  const requestContext = await getRuntimeRequestContext(c);

  if (
    typeof values.durationHours !== 'number' ||
    !allowedDurations.has(values.durationHours)
  ) {
    return c.json<UiResponse>(
      showToast('Duration must be one of: 1, 3, 6, 12, 24.', 400).body,
      400
    );
  }

  const currentSession = await getShieldModeSession(
    requestContext.subredditId,
    requestContext.subredditName
  );
  await cancelScheduledJob(currentSession.expiryJobId);

  const session = await activateShieldMode(requestContext, {
    durationHours: values.durationHours as 1 | 3 | 6 | 12 | 24,
    ...(values.reason?.trim() ? { reason: values.reason.trim() } : {}),
  });

  const expiryJobId = session.expiresAt
    ? await scheduleShieldModeExpiry(
        requestContext.subredditId,
        requestContext.subredditName,
        session.expiresAt
      )
    : null;

  await setShieldModeExpiryJobId(
    requestContext.subredditId,
    requestContext.subredditName,
    expiryJobId
  );

  return c.json<UiResponse>(
    {
      showToast: `Shield Mode activated for ${values.durationHours} hour(s).`,
    },
    200
  );
});

forms.post('/deactivate-shield-mode-submit', async (c) => {
  const values = await c.req.json<ShieldDeactivationValues>();
  const requestContext = await getRuntimeRequestContext(c);
  const currentSession = await getShieldModeSession(
    requestContext.subredditId,
    requestContext.subredditName
  );
  await cancelScheduledJob(currentSession.expiryJobId);
  await deactivateShieldMode(
    requestContext,
    normalizeOptionalString(values.reason)
  );

  return c.json<UiResponse>(
    {
      showToast: 'Shield Mode deactivated.',
    },
    200
  );
});

forms.post('/manual-triage-submit', async (c) => {
  const values = await c.req.json<ManualTriageValues>();
  const requestContext = await getRuntimeRequestContext(c);
  const targetId = values.targetId?.trim();

  if (!targetId) {
    return c.json<UiResponse>(
      showToast('targetId is required.', 400).body,
      400
    );
  }

  try {
    const item = await triageTargetById(
      requestContext,
      targetId,
      normalizeOptionalString(values.note)
    );
    return c.json<UiResponse>(
      {
        showToast: `Queued for CrisisMod triage as ${item.priority} (${item.score}).`,
      },
      200
    );
  } catch (error) {
    return c.json<UiResponse>(
      {
        showToast:
          error instanceof Error
            ? error.message
            : 'Failed to triage the selected item.',
      },
      200
    );
  }
});

forms.post('/generate-weekly-report-submit', async (c) => {
  const values = await c.req.json<WeeklyReportValues>();
  const requestContext = await getRuntimeRequestContext(c);
  const report = await generateWeeklyReport(requestContext, {
    periodLabel: values.periodLabel?.trim() || 'Current week',
  });

  if (values.publishNow) {
    await publishWeeklyReport(requestContext, {
      reportId: report.id,
    });
  }

  return c.json<UiResponse>(
    {
      showToast: `Weekly report ${values.publishNow ? 'generated and published' : 'generated'}.`,
    },
    200
  );
});
