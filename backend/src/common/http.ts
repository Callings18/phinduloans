import { HttpException, HttpStatus } from "@nestjs/common";

export class ApiError extends HttpException {
  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(
      {
        ok: false,
        error: {
          code,
          message,
          details: details ?? null,
        },
      },
      status,
    );
  }
}

export function apiFail(
  status: HttpStatus | number,
  code: string,
  message: string,
  details?: unknown,
): never {
  throw new ApiError(status, code, message, details);
}
