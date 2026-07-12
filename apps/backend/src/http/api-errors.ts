import { z, ZodError } from "zod";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

export type ApiErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "FORBIDDEN"
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";

type ApiErrorPayload = {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
    requestId: string;
  };
};

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function badRequest(message: string, details?: unknown): ApiError {
  return new ApiError(400, "INVALID_REQUEST", message, details);
}

export function authenticationRequired(message = "Authentication required"): ApiError {
  return new ApiError(401, "AUTHENTICATION_REQUIRED", message);
}

export function forbidden(message = "Forbidden", details?: unknown): ApiError {
  return new ApiError(403, "FORBIDDEN", message, details);
}

export function notFound(message: string): ApiError {
  return new ApiError(404, "NOT_FOUND", message);
}

export function conflict(message: string, details?: unknown): ApiError {
  return new ApiError(409, "CONFLICT", message, details);
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function normalizeError(error: unknown): ApiError {
  if (isApiError(error)) {
    return error;
  }

  if (error instanceof ZodError) {
    return badRequest("Invalid request", error.issues);
  }

  if (error instanceof Error) {
    return new ApiError(500, "INTERNAL_ERROR", error.message || "Internal server error");
  }

  return new ApiError(500, "INTERNAL_ERROR", "Internal server error");
}

export function sendApiError(reply: FastifyReply, requestId: string, error: ApiError) {
  const payload: ApiErrorPayload = {
    error: {
      code: error.code,
      message: error.message,
      requestId,
      ...(error.details === undefined ? {} : { details: error.details }),
    },
  };

  return reply.status(error.statusCode).send(payload);
}

export function registerApiErrorHandler(app: {
  setErrorHandler(handler: (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => void): void;
  log: { error(payload: unknown, message?: string): void };
}) {
  app.setErrorHandler((error, request, reply) => {
    const normalized = normalizeError(error);

    if (normalized.statusCode >= 500) {
      app.log.error({ err: error, requestId: request.id }, "request failed");
    }

    void sendApiError(reply, request.id, normalized);
  });
}