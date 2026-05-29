import { describe, it, expect, vi, afterEach } from 'vitest';
import { ENV_LOG_LEVEL } from '../../src/types.js';

async function createLogger() {
  const mod = await import('../../src/utils/logger.js');
  mod.ConsoleLogger.reset();
  return new mod.ConsoleLogger();
}

afterEach(() => {
  delete process.env.ENV_LOG_LEVEL;
  vi.restoreAllMocks();
});

describe('ConsoleLogger', () => {
  it('defaults to info level', async () => {
    const logger = await createLogger();
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    logger.debug('debug msg');
    logger.info('info msg');
    logger.warn('warn msg');

    const output = stderr.mock.calls.map((c) => c[0]).join('');
    expect(output).toContain('[INFO]');
    expect(output).toContain('[WARN]');
    expect(output).not.toContain('[DEBUG]');
  });

  it('debug level shows all messages', async () => {
    process.env[ENV_LOG_LEVEL] = 'debug';
    const logger = await createLogger();
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    logger.debug('dbg');
    logger.info('inf');
    logger.warn('wrn');
    logger.error('err');

    const output = stderr.mock.calls.map((c) => c[0]).join('');
    expect(output).toContain('[DEBUG]');
    expect(output).toContain('[INFO]');
    expect(output).toContain('[WARN]');
    expect(output).toContain('[ERROR]');
  });

  it('error level shows only errors', async () => {
    process.env[ENV_LOG_LEVEL] = 'error';
    const logger = await createLogger();
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    logger.warn('wrn');
    logger.error('err');

    const output = stderr.mock.calls.map((c) => c[0]).join('');
    expect(output).not.toContain('[WARN]');
    expect(output).toContain('[ERROR]');
  });

  it('silent level shows nothing on stderr', async () => {
    process.env[ENV_LOG_LEVEL] = 'silent';
    const logger = await createLogger();
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    logger.info('inf');
    logger.error('err');

    expect(stderr).not.toHaveBeenCalled();
  });

  it('dryRun always writes to stdout regardless of level', async () => {
    process.env[ENV_LOG_LEVEL] = 'silent';
    const logger = await createLogger();
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    logger.dryRun('preview');

    expect(stdout).toHaveBeenCalled();
    const output = stdout.mock.calls.map((c) => c[0]).join('');
    expect(output).toContain('preview');
  });

  it('success always writes to stdout regardless of level', async () => {
    process.env[ENV_LOG_LEVEL] = 'silent';
    const logger = await createLogger();
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    logger.success('done');

    expect(stdout).toHaveBeenCalled();
    const output = stdout.mock.calls.map((c) => c[0]).join('');
    expect(output).toContain('done');
  });
});
