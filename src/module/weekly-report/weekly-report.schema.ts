import type {
  GenerateWeeklyReportPayload,
  PublishWeeklyReportPayload,
} from './weekly-report.interface';

type ValidationSuccess<T> = {
  ok: true;
  data: T;
};

type ValidationFailure = {
  ok: false;
  errors: string[];
};

type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

export const validateGenerateWeeklyReportPayload = (
  payload: unknown
): ValidationResult<GenerateWeeklyReportPayload> => {
  if (!isRecord(payload)) {
    return { ok: false, errors: ['Request body must be an object.'] };
  }

  const periodLabel = normalizeString(payload.periodLabel);
  if (!periodLabel) {
    return {
      ok: true,
      data: {},
    };
  }

  return {
    ok: true,
    data: {
      periodLabel,
    },
  };
};

export const validatePublishWeeklyReportPayload = (
  payload: unknown
): ValidationResult<PublishWeeklyReportPayload> => {
  if (!isRecord(payload)) {
    return { ok: false, errors: ['Request body must be an object.'] };
  }

  const reportId = normalizeString(payload.reportId);
  if (!reportId) {
    return { ok: false, errors: ['reportId must be a non-empty string.'] };
  }

  return {
    ok: true,
    data: {
      reportId,
    },
  };
};

export const validateLimit = (value: string | undefined) => {
  if (!value) {
    return 10;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return 10;
  }

  return Math.min(parsed, 50);
};
