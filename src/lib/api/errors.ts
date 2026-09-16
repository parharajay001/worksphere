import "server-only";

const errorDefinitions = {
  BAD_REQUEST: { status: 400, message: "The request could not be processed." },
  INVALID_JSON: { status: 400, message: "Provide a valid JSON request body." },
  VALIDATION_ERROR: { status: 400, message: "Request validation failed." },
  UNAUTHENTICATED: { status: 401, message: "Authentication is required." },
  FORBIDDEN: {
    status: 403,
    message: "You do not have permission to perform this action.",
  },
  NOT_FOUND: { status: 404, message: "The requested resource was not found." },
  METHOD_NOT_ALLOWED: {
    status: 405,
    message: "This HTTP method is not allowed.",
  },
  CONFLICT: {
    status: 409,
    message: "The request conflicts with the current resource state.",
  },
  PAYLOAD_TOO_LARGE: { status: 413, message: "The request body is too large." },
  UNSUPPORTED_MEDIA_TYPE: {
    status: 415,
    message: "Use an application/json content type.",
  },
  RATE_LIMITED: { status: 429, message: "Too many requests. Try again later." },
  PLAN_LIMIT_REACHED: {
    status: 403,
    message: "This organization has reached its plan limit.",
  },
  INTERNAL_ERROR: { status: 500, message: "An unexpected error occurred." },
  SERVICE_UNAVAILABLE: {
    status: 503,
    message: "The service is temporarily unavailable.",
  },
} as const;

export type ErrorCode = keyof typeof errorDefinitions;
export type ValidationIssue = { path: string; code: string; message: string };

// Public messages come from this catalog, never from database or library errors.
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly issues?: ValidationIssue[];
  readonly headers?: HeadersInit;

  constructor(
    code: ErrorCode,
    options: {
      issues?: ValidationIssue[];
      headers?: HeadersInit;
      cause?: unknown;
    } = {},
  ) {
    super(errorDefinitions[code].message, { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.status = errorDefinitions[code].status;
    this.issues = options.issues;
    this.headers = options.headers;
  }
}

export function toAppError(error: unknown): AppError {
  return error instanceof AppError
    ? error
    : new AppError("INTERNAL_ERROR", { cause: error });
}
