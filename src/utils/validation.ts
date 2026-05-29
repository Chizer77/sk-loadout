import { LoadoutError, ErrorCode } from './errors.js';
import { color } from './logger.js';

// Alphanumeric start, then alphanumeric / dots / hyphens / underscores, up to 128 chars
const NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

export function validateName(name: string, label: string): void {
  if (!NAME_RE.test(name)) {
    throw new LoadoutError(
      ErrorCode.VALIDATION_ERROR,
      `Invalid ${label} name "${color.green(name)}": only alphanumeric, dots, hyphens, and underscores allowed.`,
    );
  }
}
