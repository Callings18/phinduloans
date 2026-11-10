type EdgeFunctionErrorLike = {
  message?: string;
  context?: unknown;
};

/** Read the server's JSON error body when supabase-js wraps a non-2xx response. */
export async function getEdgeFunctionErrorMessage(
  error: unknown,
  fallback: string,
): Promise<string> {
  const wrapped = (error ?? {}) as EdgeFunctionErrorLike;
  const context = wrapped.context;

  if (context instanceof Response) {
    try {
      const body = await context.clone().json();
      if (typeof body?.error === "string" && body.error.trim()) return body.error;
      if (typeof body?.message === "string" && body.message.trim()) return body.message;
    } catch {
      // Keep the SDK's message when the response body is not JSON.
    }
  }

  const message = wrapped.message?.trim();
  return message && !message.toLowerCase().includes("non-2xx") ? message : fallback;
}
