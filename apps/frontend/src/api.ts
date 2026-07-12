export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

type ApiErrorEnvelope = {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
    details?: unknown;
  };
};

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly requestId?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

type RequestOptions = RequestInit & {
  token?: string | null;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, headers, ...rest } = options;
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...rest,
    headers: {
      ...(rest.body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
  });

  const text = await response.text();
  let body: unknown = null;
  try {
    body = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const envelope = typeof body === "object" && body !== null ? (body as ApiErrorEnvelope) : undefined;
    throw new ApiRequestError(
      envelope?.error?.message ?? `Request failed with status ${response.status}`,
      response.status,
      envelope?.error?.code,
      envelope?.error?.requestId,
      envelope?.error?.details,
    );
  }

  return body as T;
}