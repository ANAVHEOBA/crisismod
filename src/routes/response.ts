import type { Context as HonoContext } from 'hono';
import type {
  ApiErrorResponse,
  ApiSuccessResponse,
} from '../shared/api-response';

type SuccessOptions = {
  message?: string;
  status?: number;
};

type ErrorOptions = {
  detail?: string;
  status?: number;
};

export const jsonSuccess = <T>(
  c: HonoContext,
  data: T,
  options?: SuccessOptions
) => {
  const body: ApiSuccessResponse<T> = {
    success: true,
    data,
    ...(options?.message ? { message: options.message } : {}),
  };

  return c.json(body, options?.status ?? 200);
};

export const jsonError = (
  c: HonoContext,
  errors: string[],
  options?: ErrorOptions
) => {
  const body: ApiErrorResponse = {
    success: false,
    errors,
    ...(options?.detail ? { detail: options.detail } : {}),
  };

  return c.json(body, options?.status ?? 400);
};
