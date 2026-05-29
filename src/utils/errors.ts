export const ErrorCode = {
  CONFIG_MISSING: 'CONFIG_MISSING',
  CONFIG_CORRUPT: 'CONFIG_CORRUPT',
  PRESET_NOT_FOUND: 'PRESET_NOT_FOUND',
  SKILL_NOT_FOUND: 'SKILL_NOT_FOUND',
  SKILL_ALREADY_EXISTS: 'SKILL_ALREADY_EXISTS',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  IO_ERROR: 'IO_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  LOCK_TIMEOUT: 'LOCK_TIMEOUT',
  TTY_REQUIRED: 'TTY_REQUIRED',
  CANCELLED: 'CANCELLED',
  UNKNOWN: 'UNKNOWN',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Check whether `err` is a Node.js system error with the given code. */
export function isErrCode(err: unknown, code: string): boolean {
  return err instanceof Error && (err as NodeJS.ErrnoException).code === code;
}

export const EXIT_CODE: Record<string, number> = {
  [ErrorCode.CONFIG_MISSING]: 1,
  [ErrorCode.CONFIG_CORRUPT]: 1,
  [ErrorCode.PRESET_NOT_FOUND]: 1,
  [ErrorCode.SKILL_NOT_FOUND]: 2,
  [ErrorCode.SKILL_ALREADY_EXISTS]: 2,
  [ErrorCode.VALIDATION_ERROR]: 4,
  [ErrorCode.IO_ERROR]: 3,
  [ErrorCode.PERMISSION_DENIED]: 3,
  [ErrorCode.LOCK_TIMEOUT]: 5,
  [ErrorCode.TTY_REQUIRED]: 1,
  [ErrorCode.CANCELLED]: 130,
  [ErrorCode.UNKNOWN]: 1,
};

export class LoadoutError extends Error {
  public readonly code: ErrorCodeType;

  constructor(code: ErrorCodeType, message: string) {
    super(message);
    this.name = 'LoadoutError';
    this.code = code;
  }

  get exitCode(): number {
    return EXIT_CODE[this.code] ?? 1;
  }
}
