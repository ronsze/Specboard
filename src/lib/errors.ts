export class AppError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "권한이 없습니다.") {
    super(403, message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "대상을 찾을 수 없습니다.") {
    super(404, message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message);
  }
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
}
