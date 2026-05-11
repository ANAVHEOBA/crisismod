import type {
  AppealIntakePayload,
  AppealOutcome,
  AppealResolvePayload,
} from './appeals.interface';

type ValidationSuccess<T> = {
  ok: true;
  data: T;
};

type ValidationFailure = {
  ok: false;
  errors: string[];
};

type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

const allowedOutcomes = new Set<AppealOutcome>([
  'uphold',
  'reverse',
  'warn',
  'ban',
  'escalate',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

export const validateAppealIntakePayload = (
  payload: unknown
): ValidationResult<AppealIntakePayload> => {
  if (!isRecord(payload)) {
    return { ok: false, errors: ['Request body must be an object.'] };
  }

  const username = normalizeString(payload.username);
  const contentSummary = normalizeString(payload.contentSummary);
  const citedRule = normalizeString(payload.citedRule);
  const removalMessage = normalizeString(payload.removalMessage);
  const userAppeal = normalizeString(payload.userAppeal);
  const priorOffenses = payload.priorOffenses;
  let sourceRef: string | undefined;

  const errors: string[] = [];

  if (!username) {
    errors.push('username must be a non-empty string.');
  }

  if (!contentSummary) {
    errors.push('contentSummary must be a non-empty string.');
  }

  if (!citedRule) {
    errors.push('citedRule must be a non-empty string.');
  }

  if (!removalMessage) {
    errors.push('removalMessage must be a non-empty string.');
  }

  if (!userAppeal) {
    errors.push('userAppeal must be a non-empty string.');
  }

  if (
    typeof priorOffenses !== 'number' ||
    !Number.isInteger(priorOffenses) ||
    priorOffenses < 0
  ) {
    errors.push('priorOffenses must be a non-negative integer.');
  }

  if ('sourceRef' in payload && payload.sourceRef !== undefined) {
    sourceRef = normalizeString(payload.sourceRef);
    if (!sourceRef) {
      errors.push('sourceRef must be a non-empty string when provided.');
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      username,
      contentSummary,
      citedRule,
      removalMessage,
      userAppeal,
      priorOffenses: priorOffenses as number,
      ...(sourceRef ? { sourceRef } : {}),
    },
  };
};

export const validateAppealResolvePayload = (
  payload: unknown
): ValidationResult<AppealResolvePayload> => {
  if (!isRecord(payload)) {
    return { ok: false, errors: ['Request body must be an object.'] };
  }

  const appealId = normalizeString(payload.appealId);
  const outcome = normalizeString(payload.outcome);
  if (!appealId) {
    return { ok: false, errors: ['appealId must be a non-empty string.'] };
  }

  if (!allowedOutcomes.has(outcome as AppealOutcome)) {
    return {
      ok: false,
      errors: ['outcome must be one of: uphold, reverse, warn, ban, escalate.'],
    };
  }

  const data: AppealResolvePayload = {
    appealId,
    outcome: outcome as AppealOutcome,
  };

  if ('moderatorNote' in payload && payload.moderatorNote !== undefined) {
    const moderatorNote = normalizeString(payload.moderatorNote);
    if (!moderatorNote) {
      return {
        ok: false,
        errors: ['moderatorNote must be a non-empty string when provided.'],
      };
    }

    data.moderatorNote = moderatorNote;
  }

  if ('responseOverride' in payload && payload.responseOverride !== undefined) {
    const responseOverride = normalizeString(payload.responseOverride);
    if (!responseOverride) {
      return {
        ok: false,
        errors: ['responseOverride must be a non-empty string when provided.'],
      };
    }

    data.responseOverride = responseOverride;
  }

  return { ok: true, data };
};
