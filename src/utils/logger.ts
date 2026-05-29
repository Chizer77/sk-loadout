import { appendFileSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ENV_LOG_LEVEL } from '../types.js';

const ansi =
  (...codes: number[]) =>
  (text: string) =>
    `\x1b[${codes.join(';')}m${text}\x1b[0m`;

export const color = {
  green: ansi(32),
  red: ansi(31),
  yellow: ansi(93),
  cyan: ansi(36),
  magenta: ansi(95),
  dim: ansi(90),
  bold: ansi(1),
};

export interface Logger {
  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  dryRun(msg: string): void;
  success(msg: string): void;
}

let _logDir: string | undefined;

export function setLogDir(dir: string): void {
  _logDir = dir;
}

// Log level controlled by SK_LOADOUT_LOG_LEVEL env var:
// debug > info > warn > error > silent
export class ConsoleLogger implements Logger {
  private static _instance: ConsoleLogger | null = null;

  /** Reset the singleton — only needed in tests. */
  static reset(): void {
    ConsoleLogger._instance = null;
  }

  // Fields are initialized after the singleton guard so they only run once.
  private readonly level!: 'debug' | 'info' | 'warn' | 'error' | 'silent';
  private readonly logPath!: string | null;

  constructor() {
    if (ConsoleLogger._instance) return ConsoleLogger._instance;

    // First call — normal construction
    this.logPath = null;
    const raw = process.env[ENV_LOG_LEVEL]?.toLowerCase();
    switch (raw) {
      case 'debug':
        this.level = 'debug';
        break;
      case 'info':
        this.level = 'info';
        break;
      case 'warn':
        this.level = 'warn';
        break;
      case 'error':
        this.level = 'error';
        break;
      case 'silent':
        this.level = 'silent';
        break;
      default:
        this.level = 'info';
    }

    if (_logDir) {
      const logsDir = join(_logDir, 'logs');
      mkdirSync(logsDir, { recursive: true });
      this.pruneOldLogs(logsDir, 30);

      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      this.logPath = join(logsDir, `${ts}.log`);
    }
    ConsoleLogger._instance = this;
  }

  private pruneOldLogs(logsDir: string, keep: number): void {
    try {
      const files = readdirSync(logsDir)
        .filter((f) => f.endsWith('.log'))
        .map((f) => ({ name: f, mtime: statSync(join(logsDir, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);

      for (const f of files.slice(keep)) {
        rmSync(join(logsDir, f.name), { force: true });
      }
    } catch {
      // don't block the command over log cleanup
    }
  }

  private write(prefix: string, msg: string): void {
    if (!this.logPath) return;
    try {
      appendFileSync(this.logPath, `${prefix} ${msg}\n`, 'utf-8');
    } catch {
      // never crash because of log file issues
    }
  }

  debug(msg: string): void {
    this.write('[DEBUG]', msg);
    if (this.level === 'debug') {
      process.stderr.write(`${color.dim('[DEBUG]')} ${msg}\n`);
    }
  }

  info(msg: string): void {
    this.write('[INFO]', msg);
    if (this.level === 'debug' || this.level === 'info') {
      process.stderr.write(`${color.cyan('[INFO]')} ${msg}\n`);
    }
  }

  warn(msg: string): void {
    this.write('[WARN]', msg);
    if (this.level !== 'silent' && this.level !== 'error') {
      process.stderr.write(`${color.yellow('[WARN]')} ${msg}\n`);
    }
  }

  error(msg: string): void {
    this.write('[ERROR]', msg);
    if (this.level !== 'silent') {
      process.stderr.write(`${color.red('[ERROR]')} ${msg}\n`);
    }
  }

  // Always write to stdout, ignoring log level — used for --dry-run preview
  dryRun(msg: string): void {
    this.write('[DRY RUN]', msg);
    process.stdout.write(`${color.magenta('[DRY RUN]')} ${msg}\n`);
  }

  // Always write to stdout, ignoring log level — used for operation success confirmation
  success(msg: string): void {
    this.write('[SUCCESS]', msg);
    process.stdout.write(`\n${color.green('✓')} ${msg}\n`);
  }
}
