import type {
  QueueActionPayload,
  QueueItemSource,
  QueueRecommendedAction,
  QueueScoreInput,
} from './queue-triage.interface';

type ValidationSuccess<T> = {
  ok: true;
  data: T;
};

type ValidationFailure = {
  ok: false;
  errors: string[];
};

type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

const allowedActions = new Set<QueueRecommendedAction>([
  'approve',
  'remove',
  'lock',
  'escalate',
  'watch',
]);

const allowedSources = new Set<QueueItemSource>([
  'manual',
  'post_submit',
  'comment_submit',
  'post_report',
  'comment_report',
  'automod_post',
  'automod_comment',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

const validateStringArray = (
  value: unknown,
  fieldName: string
): ValidationResult<string[]> => {
  if (!Array.isArray(value)) {
    return { ok: false, errors: [`${fieldName} must be an array of strings.`] };
  }

  const normalized: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') {
      return {
        ok: false,
        errors: [`${fieldName} must contain only strings.`],
      };
    }

    const trimmed = entry.trim();
    if (trimmed.length > 0) {
      normalized.push(trimmed);
    }
  }

  return { ok: true, data: normalized };
};

export const validateQueueScorePayload = (
  payload: unknown
): ValidationResult<QueueScoreInput> => {
  if (!isRecord(payload)) {
    return { ok: false, errors: ['Request body must be an object.'] };
  }

  const errors: string[] = [];

  const targetId = normalizeString(payload.targetId);
  if (!targetId) {
    errors.push('targetId must be a non-empty string.');
  }

  let targetPermalink: string | null | undefined;
  if ('targetPermalink' in payload) {
    if (payload.targetPermalink === null) {
      targetPermalink = null;
    } else {
      targetPermalink = normalizeString(payload.targetPermalink);
      if (!targetPermalink) {
        errors.push('targetPermalink must be a non-empty string or null.');
      }
    }
  }

  let source: QueueItemSource | undefined;
  if ('source' in payload && payload.source !== undefined) {
    const normalizedSource = normalizeString(payload.source);
    if (!allowedSources.has(normalizedSource as QueueItemSource)) {
      errors.push(
        'source must be one of: manual, post_submit, comment_submit, post_report, comment_report, automod_post, automod_comment.'
      );
    } else {
      source = normalizedSource as QueueItemSource;
    }
  }

  const kind = normalizeString(payload.kind);
  if (kind !== 'post' && kind !== 'comment') {
    errors.push('kind must be either "post" or "comment".');
  }

  const author = normalizeString(payload.author);
  if (!author) {
    errors.push('author must be a non-empty string.');
  }

  const contentSummary = normalizeString(payload.contentSummary);
  if (!contentSummary) {
    errors.push('contentSummary must be a non-empty string.');
  }

  const numericFields = [
    'reportCount',
    'accountAgeDays',
    'subredditKarma',
    'commentVelocity',
    'repeatedSimilarComments',
    'priorIncidentRemovals',
  ] as const;

  for (const field of numericFields) {
    const value = payload[field];
    if (typeof value !== 'number' || Number.isNaN(value)) {
      errors.push(`${field} must be a number.`);
    }
  }

  if (typeof payload.containsLink !== 'boolean') {
    errors.push('containsLink must be a boolean.');
  }

  if (typeof payload.threadLocked !== 'boolean') {
    errors.push('threadLocked must be a boolean.');
  }

  const reportReasons = validateStringArray(payload.reportReasons, 'reportReasons');
  if (!reportReasons.ok) {
    errors.push(...reportReasons.errors);
  }

  const controversialKeywords = validateStringArray(
    payload.controversialKeywords,
    'controversialKeywords'
  );
  if (!controversialKeywords.ok) {
    errors.push(...controversialKeywords.errors);
  }

  let labels: string[] = [];
  if ('labels' in payload && payload.labels !== undefined) {
    const result = validateStringArray(payload.labels, 'labels');
    if (!result.ok) {
      errors.push(...result.errors);
    } else {
      labels = result.data;
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      targetId,
      targetPermalink: targetPermalink ?? null,
      ...(source ? { source } : {}),
      kind: kind as 'post' | 'comment',
      author,
      contentSummary,
      reportCount: payload.reportCount as number,
      reportReasons: reportReasons.ok ? reportReasons.data : [],
      accountAgeDays: payload.accountAgeDays as number,
      subredditKarma: payload.subredditKarma as number,
      containsLink: payload.containsLink as boolean,
      commentVelocity: payload.commentVelocity as number,
      controversialKeywords: controversialKeywords.ok
        ? controversialKeywords.data
        : [],
      repeatedSimilarComments: payload.repeatedSimilarComments as number,
      threadLocked: payload.threadLocked as boolean,
      priorIncidentRemovals: payload.priorIncidentRemovals as number,
      labels,
    },
  };
};

export const validateQueueActionPayload = (
  payload: unknown
): ValidationResult<QueueActionPayload> => {
  if (!isRecord(payload)) {
    return { ok: false, errors: ['Request body must be an object.'] };
  }

  const itemId = normalizeString(payload.itemId);
  if (!itemId) {
    return { ok: false, errors: ['itemId must be a non-empty string.'] };
  }

  const action = normalizeString(payload.action);
  if (!allowedActions.has(action as QueueRecommendedAction)) {
    return {
      ok: false,
      errors: ['action must be one of: approve, remove, lock, escalate, watch.'],
    };
  }

  let note: string | undefined;
  if ('note' in payload && payload.note !== undefined) {
    note = normalizeString(payload.note);
    if (!note) {
      return {
        ok: false,
        errors: ['note must be a non-empty string when provided.'],
      };
    }
  }

  const data: QueueActionPayload = {
    itemId,
    action: action as QueueRecommendedAction,
  };

  if (note) {
    data.note = note;
  }

  return { ok: true, data };
};

export const validateLimit = (value: string | undefined) => {
  if (!value) {
    return 20;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return 20;
  }

  return Math.min(parsed, 100);
};
