export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
  message?: string;
};

export type ApiErrorResponse = {
  success: false;
  errors: string[];
  detail?: string;
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
