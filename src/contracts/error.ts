export const EXIT = {
  internal: 1,
  usage: 2,
  access: 3,
  notFound: 4,
  conflict: 5,
  transient: 6,
  protocol: 7,
  network: 8,
  partial: 9,
  io: 10,
  interrupted: 130,
  terminated: 143,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

export interface ErrorDetails {
  code: string;
  message: string;
  exitCode: ExitCode;
  retryable?: boolean;
  hint?: string;
  field?: string;
  identifier?: string;
  service?: string;
  httpStatus?: number;
  requestId?: string;
  retryAfterSeconds?: number;
  outcomeUnknown?: boolean;
}

export function processSignalError(signal: 'SIGINT' | 'SIGTERM'): CliError {
  const interrupted = signal === 'SIGINT';
  return new CliError({
    code: interrupted ? 'INTERRUPTED' : 'TERMINATED',
    message: interrupted ? 'Operation interrupted by SIGINT' : 'Operation terminated by SIGTERM',
    exitCode: interrupted ? EXIT.interrupted : EXIT.terminated,
    retryable: true,
    hint: 'Resume the operation using its documented identifier',
  });
}

export class CliError extends Error {
  readonly details: ErrorDetails;

  constructor(details: ErrorDetails, options?: ErrorOptions) {
    super(details.message, options);
    this.name = 'CliError';
    this.details = details;
  }
}

export function usageError(message: string, hint: string, field?: string): CliError {
  return new CliError({
    code: 'INVALID_USAGE',
    message,
    exitCode: EXIT.usage,
    retryable: false,
    hint,
    ...(field === undefined ? {} : { field }),
  });
}
