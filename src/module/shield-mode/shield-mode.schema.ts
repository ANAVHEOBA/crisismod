import type {
  ActivateShieldModePayload,
  DeactivateShieldModePayload,
  ShieldModeConfigPatch,
  ShieldModeDurationHours,
} from './shield-mode.interface';

type ValidationSuccess<T> = {
  ok: true;
  data: T;
};

type ValidationFailure = {
  ok: false;
  errors: string[];
};

type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

const allowedDurations = new Set<ShieldModeDurationHours>([1, 3, 6, 12, 24]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeOptionalString = (value: unknown) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

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

export const validateShieldModeConfigPatch = (
  payload: unknown
): ValidationResult<ShieldModeConfigPatch> => {
  if (!isRecord(payload)) {
    return { ok: false, errors: ['Request body must be an object.'] };
  }

  const patch: ShieldModeConfigPatch = {};
  const errors: string[] = [];

  if ('presetName' in payload) {
    const presetName = normalizeOptionalString(payload.presetName);
    if (!presetName) {
      errors.push('presetName must be a non-empty string.');
    } else {
      patch.presetName = presetName;
    }
  }

  if ('defaultDurationHours' in payload) {
    if (
      typeof payload.defaultDurationHours !== 'number' ||
      !allowedDurations.has(payload.defaultDurationHours as ShieldModeDurationHours)
    ) {
      errors.push('defaultDurationHours must be one of: 1, 3, 6, 12, 24.');
    } else {
      patch.defaultDurationHours =
        payload.defaultDurationHours as ShieldModeDurationHours;
    }
  }

  if ('subredditRules' in payload) {
    const result = validateStringArray(payload.subredditRules, 'subredditRules');
    if (!result.ok) {
      errors.push(...result.errors);
    } else {
      patch.subredditRules = result.data;
    }
  }

  if ('minAccountAgeDays' in payload) {
    if (
      typeof payload.minAccountAgeDays !== 'number' ||
      !Number.isInteger(payload.minAccountAgeDays) ||
      payload.minAccountAgeDays < 0
    ) {
      errors.push('minAccountAgeDays must be a non-negative integer.');
    } else {
      patch.minAccountAgeDays = payload.minAccountAgeDays;
    }
  }

  if ('minSubredditKarma' in payload) {
    if (
      typeof payload.minSubredditKarma !== 'number' ||
      !Number.isInteger(payload.minSubredditKarma)
    ) {
      errors.push('minSubredditKarma must be an integer.');
    } else {
      patch.minSubredditKarma = payload.minSubredditKarma;
    }
  }

  if ('holdLinks' in payload) {
    if (typeof payload.holdLinks !== 'boolean') {
      errors.push('holdLinks must be a boolean.');
    } else {
      patch.holdLinks = payload.holdLinks;
    }
  }

  if ('triggerPhrases' in payload) {
    const result = validateStringArray(payload.triggerPhrases, 'triggerPhrases');
    if (!result.ok) {
      errors.push(...result.errors);
    } else {
      patch.triggerPhrases = result.data;
    }
  }

  if ('strictRules' in payload) {
    const result = validateStringArray(payload.strictRules, 'strictRules');
    if (!result.ok) {
      errors.push(...result.errors);
    } else {
      patch.strictRules = result.data;
    }
  }

  if ('appealResponseTemplate' in payload) {
    const appealResponseTemplate = normalizeOptionalString(
      payload.appealResponseTemplate
    );
    if (!appealResponseTemplate) {
      errors.push('appealResponseTemplate must be a non-empty string.');
    } else {
      patch.appealResponseTemplate = appealResponseTemplate;
    }
  }

  if ('alertWebhookUrl' in payload) {
    if (payload.alertWebhookUrl === null) {
      patch.alertWebhookUrl = null;
    } else {
      const alertWebhookUrl = normalizeOptionalString(payload.alertWebhookUrl);
      if (!alertWebhookUrl) {
        errors.push('alertWebhookUrl must be a non-empty string or null.');
      } else {
        patch.alertWebhookUrl = alertWebhookUrl;
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  if (Object.keys(patch).length === 0) {
    return {
      ok: false,
      errors: ['At least one config field must be provided.'],
    };
  }

  return { ok: true, data: patch };
};

export const validateActivateShieldModePayload = (
  payload: unknown
): ValidationResult<ActivateShieldModePayload> => {
  if (!isRecord(payload)) {
    return { ok: false, errors: ['Request body must be an object.'] };
  }

  const errors: string[] = [];

  if (
    typeof payload.durationHours !== 'number' ||
    !allowedDurations.has(payload.durationHours as ShieldModeDurationHours)
  ) {
    errors.push('durationHours must be one of: 1, 3, 6, 12, 24.');
  }

  let reason: string | undefined;
  if ('reason' in payload && payload.reason !== undefined) {
    const normalizedReason = normalizeOptionalString(payload.reason);
    if (!normalizedReason) {
      errors.push('reason must be a non-empty string when provided.');
    } else {
      reason = normalizedReason;
    }
  }

  let configOverride: ShieldModeConfigPatch | undefined;
  if ('configOverride' in payload && payload.configOverride !== undefined) {
    const configResult = validateShieldModeConfigPatch(payload.configOverride);
    if (!configResult.ok) {
      errors.push(...configResult.errors);
    } else {
      configOverride = configResult.data;
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const data: ActivateShieldModePayload = {
    durationHours: payload.durationHours as ShieldModeDurationHours,
  };

  if (reason) {
    data.reason = reason;
  }

  if (configOverride) {
    data.configOverride = configOverride;
  }

  return { ok: true, data };
};

export const validateDeactivateShieldModePayload = (
  payload: unknown
): ValidationResult<DeactivateShieldModePayload> => {
  if (!isRecord(payload)) {
    return { ok: false, errors: ['Request body must be an object.'] };
  }

  const data: DeactivateShieldModePayload = {};

  if ('reason' in payload && payload.reason !== undefined) {
    const reason = normalizeOptionalString(payload.reason);
    if (!reason) {
      return {
        ok: false,
        errors: ['reason must be a non-empty string when provided.'],
      };
    }

    data.reason = reason;
  }

  return { ok: true, data };
};

export const validateAuditLimit = (value: string | undefined) => {
  if (value === undefined) {
    return 20;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return 20;
  }

  return Math.min(parsed, 100);
};
