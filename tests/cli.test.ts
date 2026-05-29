import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const testRoot = mkdtempSync(join(tmpdir(), 'sk-cli-'));

afterAll(() => {
  rmSync(testRoot, { recursive: true, force: true });
});

describe('platform detection', () => {
  let detectPlatform: typeof import('../src/types.js').detectPlatform;

  beforeAll(async () => {
    const typesMod = await import('../src/types.js');
    detectPlatform = typesMod.detectPlatform;
  });

  it('returns null when no platform settings file exists at a fake path', () => {
    const result = detectPlatform('/nonexistent/path/that/does/not/exist');
    expect(result).toBeNull();
  });

  it('detects claude when settings.json exists under customHome', () => {
    const claudeHome = join(testRoot, 'claude-config');
    mkdirSync(claudeHome, { recursive: true });
    writeFileSync(join(claudeHome, 'settings.json'), '{}');
    const result = detectPlatform(claudeHome);
    expect(result).toBe('claude');
  });
});

describe('LoadoutError', () => {
  it('maps error codes to correct exit codes', async () => {
    const { LoadoutError, ErrorCode } = await import('../src/utils/errors.js');

    expect(new LoadoutError(ErrorCode.CONFIG_MISSING, 'test').exitCode).toBe(1);
    expect(new LoadoutError(ErrorCode.CONFIG_MISSING, 'test').code).toBe('CONFIG_MISSING');
    expect(new LoadoutError(ErrorCode.CONFIG_MISSING, 'test').name).toBe('LoadoutError');
    expect(new LoadoutError(ErrorCode.CANCELLED, 'cancelled').exitCode).toBe(130);
    expect(new LoadoutError(ErrorCode.LOCK_TIMEOUT, 'timeout').exitCode).toBe(5);
    expect(new LoadoutError(ErrorCode.SKILL_NOT_FOUND, 'not found').exitCode).toBe(2);
    expect(new LoadoutError(ErrorCode.VALIDATION_ERROR, 'bad').exitCode).toBe(4);
  });
});
