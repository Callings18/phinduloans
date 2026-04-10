export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function toErrorResponse(
  error: unknown,
  fallback: { status?: number; code?: string; message?: string } = {},
) {
  if (error instanceof HttpError) {
    return {
      status: error.status,
      body: {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? null,
        },
      },
    };
  }
  const status = fallback.status ?? 500;
  return {
    status,
    body: {
      ok: false,
      error: {
        code: fallback.code ?? "INTERNAL_ERROR",
        message: fallback.message ?? "Unexpected server error",
      },
    },
  };
}
