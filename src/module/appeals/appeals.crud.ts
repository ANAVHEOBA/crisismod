import { readJson, writeJson } from '../../config/store';
import type { AppRequestContext } from '../../config/request-context';
import { getShieldModeConfig } from '../shield-mode/shield-mode.crud';
import type {
  AppealIntakePayload,
  AppealItem,
  AppealMetrics,
  AppealOutcome,
  AppealResolvePayload,
  AppealType,
} from './appeals.interface';

const appealsKey = (subredditId: string) => `appeals:items:${subredditId}`;

const now = () => new Date().toISOString();

const classifyAppealType = (
  payload: AppealIntakePayload
): AppealType => {
  const normalizedAppeal = payload.userAppeal.toLowerCase();

  if (payload.priorOffenses >= 3) {
    return 'repeat_offender';
  }

  if (
    normalizedAppeal.includes('idiot') ||
    normalizedAppeal.includes('power trip') ||
    normalizedAppeal.includes('stupid')
  ) {
    return 'hostile';
  }

  if (
    normalizedAppeal.includes('telegram') ||
    normalizedAppeal.includes('buy now') ||
    normalizedAppeal.includes('promo')
  ) {
    return 'spam';
  }

  if (
    normalizedAppeal.includes('wrong post') ||
    normalizedAppeal.includes('meant to') ||
    normalizedAppeal.includes('fixed it')
  ) {
    return 'valid_correction';
  }

  return 'confused';
};

const summarizeAppeal = (payload: AppealIntakePayload) => {
  const appealText = payload.userAppeal.replace(/\s+/g, ' ').trim();
  if (appealText.length <= 140) {
    return appealText;
  }

  return `${appealText.slice(0, 137)}...`;
};

const getRecommendedOutcome = (
  appealType: AppealType
): AppealOutcome => {
  switch (appealType) {
    case 'confused':
      return 'warn';
    case 'valid_correction':
      return 'reverse';
    case 'hostile':
      return 'uphold';
    case 'spam':
      return 'ban';
    case 'repeat_offender':
      return 'escalate';
  }
};

const renderAppealTemplate = (
  template: string,
  payload: AppealIntakePayload,
  appealType: AppealType,
  recommendedOutcome: AppealOutcome
) =>
  template
    .replaceAll('{{username}}', payload.username)
    .replaceAll('{{rule}}', payload.citedRule)
    .replaceAll('{{appeal_type}}', appealType)
    .replaceAll('{{recommended_outcome}}', recommendedOutcome)
    .replaceAll('{{content_summary}}', payload.contentSummary)
    .replaceAll(
      '{{explanation}}',
      `Original removal message: ${payload.removalMessage}`
    );

const buildSuggestedResponse = (
  payload: AppealIntakePayload,
  appealType: AppealType,
  recommendedOutcome: AppealOutcome,
  template: string | null
) => {
  if (template) {
    return renderAppealTemplate(
      template,
      payload,
      appealType,
      recommendedOutcome
    );
  }

  switch (appealType) {
    case 'confused':
      return `Clarify ${payload.citedRule}, explain the correct posting path, and link the relevant rule text.`;
    case 'valid_correction':
      return `Acknowledge the correction, explain ${payload.citedRule}, and restore the content if the fix is sufficient.`;
    case 'hostile':
      return `Keep the response brief, cite ${payload.citedRule}, and avoid debate.`;
    case 'spam':
      return `Do not reopen discussion. Confirm the spam enforcement under ${payload.citedRule}.`;
    case 'repeat_offender':
      return `Escalate to a senior mod and reference the repeated history under ${payload.citedRule}.`;
  }
};

export const getAppeals = async (subredditId: string) => {
  const appeals = await readJson<AppealItem[]>(appealsKey(subredditId), []);
  return [...appeals].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
};

export const intakeAppeal = async (
  requestContext: AppRequestContext,
  payload: AppealIntakePayload
) => {
  const appeals = await getAppeals(requestContext.subredditId);
  if (payload.sourceRef) {
    const existingAppeal = appeals.find(
      (appeal) => appeal.sourceRef === payload.sourceRef
    );
    if (existingAppeal) {
      return existingAppeal;
    }
  }

  const config = await getShieldModeConfig(requestContext.subredditId);
  const appealType = classifyAppealType(payload);
  const recommendedOutcome = getRecommendedOutcome(appealType);
  const createdAt = now();
  const nextAppeal: AppealItem = {
    id: `appeal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    subredditId: requestContext.subredditId,
    subredditName: requestContext.subredditName,
    sourceRef: payload.sourceRef ?? null,
    appealSummary: summarizeAppeal(payload),
    appealType,
    suggestedResponse: buildSuggestedResponse(
      payload,
      appealType,
      recommendedOutcome,
      config.appealResponseTemplate
    ),
    recommendedOutcome,
    status: 'open',
    resolvedBy: null,
    resolvedAt: null,
    finalOutcome: null,
    moderatorNote: null,
    createdAt,
    updatedAt: createdAt,
    ...payload,
  };

  await writeJson(appealsKey(requestContext.subredditId), [nextAppeal, ...appeals]);
  return nextAppeal;
};

export const resolveAppeal = async (
  requestContext: AppRequestContext,
  payload: AppealResolvePayload
) => {
  const appeals = await getAppeals(requestContext.subredditId);
  let resolvedAppeal: AppealItem | null = null;

  const nextAppeals = appeals.map((appeal) => {
    if (appeal.id !== payload.appealId) {
      return appeal;
    }

    resolvedAppeal = {
      ...appeal,
      status: 'resolved',
      resolvedBy: requestContext.moderatorUsername,
      resolvedAt: now(),
      finalOutcome: payload.outcome,
      moderatorNote: payload.moderatorNote ?? null,
      suggestedResponse: payload.responseOverride ?? appeal.suggestedResponse,
      updatedAt: now(),
    };

    return resolvedAppeal;
  });

  if (!resolvedAppeal) {
    return null;
  }

  await writeJson(appealsKey(requestContext.subredditId), nextAppeals);
  return resolvedAppeal;
};

export const getAppealMetrics = async (
  subredditId: string
): Promise<AppealMetrics> => {
  const appeals = await getAppeals(subredditId);
  const ruleCounts = new Map<string, number>();
  let openAppeals = 0;
  let resolvedAppeals = 0;
  let reversalCount = 0;

  for (const appeal of appeals) {
    ruleCounts.set(appeal.citedRule, (ruleCounts.get(appeal.citedRule) ?? 0) + 1);
    if (appeal.status === 'open') {
      openAppeals += 1;
    } else {
      resolvedAppeals += 1;
    }

    if (appeal.finalOutcome === 'reverse') {
      reversalCount += 1;
    }
  }

  const mostAppealedRules = [...ruleCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([rule, count]) => ({ rule, count }));

  return {
    totalAppeals: appeals.length,
    openAppeals,
    resolvedAppeals,
    reversalCount,
    mostAppealedRules,
  };
};
