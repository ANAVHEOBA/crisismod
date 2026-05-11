import { Hono } from 'hono';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import type { Form, FormField } from '@devvit/shared-types/shared/form.js';
import { getShieldModeConfig } from '../module/shield-mode/shield-mode.crud';

export const menu = new Hono();

const buildDurationField = (name: string, value: number): FormField => ({
  name,
  label: 'Duration (hours)',
  type: 'number',
  helpText: 'Use one of: 1, 3, 6, 12, 24.',
  required: true,
  defaultValue: value,
});

const buildCrisisModConfigForm = async (subredditId: string): Promise<Form> => {
  const config = await getShieldModeConfig(subredditId);

  return {
    title: 'Configure CrisisMod',
    description:
      'Set the default moderation thresholds, Shield Mode preset, appeal template, and alert destination for this subreddit.',
    acceptLabel: 'Save',
    cancelLabel: 'Cancel',
    fields: [
      {
        name: 'presetName',
        label: 'Shield preset name',
        type: 'string',
        required: true,
        defaultValue: config.presetName,
      },
      buildDurationField('defaultDurationHours', config.defaultDurationHours),
      {
        name: 'subredditRules',
        label: 'Subreddit rules',
        type: 'paragraph',
        helpText: 'One rule per line. Used for suggested rule selection.',
        required: true,
        defaultValue: config.subredditRules.join('\n'),
      },
      {
        name: 'minAccountAgeDays',
        label: 'Minimum account age (days)',
        type: 'number',
        required: true,
        defaultValue: config.minAccountAgeDays,
      },
      {
        name: 'minSubredditKarma',
        label: 'Minimum subreddit karma',
        type: 'number',
        required: true,
        defaultValue: config.minSubredditKarma,
      },
      {
        name: 'holdLinks',
        label: 'Hold links during Shield Mode',
        type: 'boolean',
        defaultValue: config.holdLinks,
      },
      {
        name: 'triggerPhrases',
        label: 'Trigger phrases',
        type: 'paragraph',
        helpText: 'One trigger phrase per line.',
        required: true,
        defaultValue: config.triggerPhrases.join('\n'),
      },
      {
        name: 'strictRules',
        label: 'Strictly enforced rules',
        type: 'paragraph',
        helpText: 'One rule label per line.',
        required: true,
        defaultValue: config.strictRules.join('\n'),
      },
      {
        name: 'appealResponseTemplate',
        label: 'Appeal response template',
        type: 'paragraph',
        helpText:
          'Supports {{username}}, {{rule}}, {{appeal_type}}, {{recommended_outcome}}, {{content_summary}}, {{explanation}}.',
        required: true,
        defaultValue: config.appealResponseTemplate,
      },
      {
        name: 'alertWebhookUrl',
        label: 'Alert webhook URL',
        type: 'string',
        helpText: 'Optional. Leave blank if you do not want outbound alerts.',
        defaultValue: config.alertWebhookUrl ?? '',
      },
    ],
  };
};

const buildShieldActivationForm = async (subredditId: string): Promise<Form> => {
  const config = await getShieldModeConfig(subredditId);

  return {
    title: 'Activate Shield Mode',
    description:
      'Temporarily tighten moderation thresholds for raids, brigading, or sudden traffic spikes.',
    acceptLabel: 'Activate',
    cancelLabel: 'Cancel',
    fields: [
      buildDurationField('durationHours', config.defaultDurationHours),
      {
        name: 'reason',
        label: 'Activation reason',
        type: 'string',
        helpText: 'Example: Viral controversy, spam wave, or raid risk.',
        defaultValue: 'Spike in reports and new-account activity.',
      },
    ],
  };
};

const buildShieldDeactivationForm = (): Form => ({
  title: 'Deactivate Shield Mode',
  description: 'Turn off incident-response enforcement and restore normal moderation thresholds.',
  acceptLabel: 'Deactivate',
  cancelLabel: 'Cancel',
  fields: [
    {
      name: 'reason',
      label: 'Deactivation note',
      type: 'string',
      helpText: 'Optional note for the audit trail.',
      defaultValue: 'Incident stabilized.',
    },
  ],
});

const buildManualTriageForm = (
  title: string,
  targetId: string,
  kind: 'post' | 'comment'
): Form => ({
  title,
  description:
    'Score this item with the CrisisMod triage engine and add it to the moderation queue.',
  acceptLabel: 'Triage',
  cancelLabel: 'Cancel',
  fields: [
    {
      name: 'targetId',
      label: 'Target ID',
      type: 'string',
      required: true,
      defaultValue: targetId,
    },
    {
      name: 'kind',
      label: 'Target kind',
      type: 'string',
      required: true,
      defaultValue: kind,
    },
    {
      name: 'note',
      label: 'Moderator note',
      type: 'string',
      helpText: 'Optional note to help explain why this item was manually triaged.',
    },
  ],
});

const buildWeeklyReportForm = (): Form => ({
  title: 'Generate Weekly Report',
  description:
    'Create a new moderation health report from the current queue, appeal, and Shield Mode data.',
  acceptLabel: 'Generate',
  cancelLabel: 'Cancel',
  fields: [
    {
      name: 'periodLabel',
      label: 'Period label',
      type: 'string',
      defaultValue: 'Current week',
    },
    {
      name: 'publishNow',
      label: 'Mark the report as published',
      type: 'boolean',
      defaultValue: false,
    },
  ],
});

menu.post('/configure-crisismod', async (c) => {
  const request = await c.req.json<MenuItemRequest>();
  return c.json<UiResponse>(
    {
      showForm: {
        name: 'configureCrisisMod',
        form: await buildCrisisModConfigForm(request.targetId),
      },
    },
    200
  );
});

menu.post('/activate-shield-mode', async (c) => {
  const request = await c.req.json<MenuItemRequest>();
  return c.json<UiResponse>(
    {
      showForm: {
        name: 'activateShieldMode',
        form: await buildShieldActivationForm(request.targetId),
      },
    },
    200
  );
});

menu.post('/deactivate-shield-mode', async (_c) =>
  _c.json<UiResponse>(
    {
      showForm: {
        name: 'deactivateShieldMode',
        form: buildShieldDeactivationForm(),
      },
    },
    200
  )
);

menu.post('/triage-post', async (c) => {
  const request = await c.req.json<MenuItemRequest>();
  return c.json<UiResponse>(
    {
      showForm: {
        name: 'manualTriagePost',
        form: buildManualTriageForm(
          'Send Post To CrisisMod Triage',
          request.targetId,
          'post'
        ),
      },
    },
    200
  );
});

menu.post('/triage-comment', async (c) => {
  const request = await c.req.json<MenuItemRequest>();
  return c.json<UiResponse>(
    {
      showForm: {
        name: 'manualTriageComment',
        form: buildManualTriageForm(
          'Send Comment To CrisisMod Triage',
          request.targetId,
          'comment'
        ),
      },
    },
    200
  );
});

menu.post('/generate-weekly-report', async (c) =>
  c.json<UiResponse>(
    {
      showForm: {
        name: 'generateWeeklyReport',
        form: buildWeeklyReportForm(),
      },
    },
    200
  )
);
