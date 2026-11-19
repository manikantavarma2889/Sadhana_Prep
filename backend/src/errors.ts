export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function missing(): never {
  throw new AppError(404, 'NOT_FOUND', 'This resource could not be found.');
}

export function conflict(message: string): never {
  throw new AppError(409, 'CONFLICT', message);
}

export function unavailable(message = 'The AI provider is temporarily unavailable. Try again shortly.'): never {
  throw new AppError(503, 'PROVIDER_UNAVAILABLE', message);
}
