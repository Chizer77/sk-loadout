import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const testRoot = mkdtempSync(join(tmpdir(), 'sk-lock-'));

// The lock module uses module-level state (_lockDir). Import once and reuse.
let acquireLock: typeof import('../../src/utils/lock.js').acquireLock;
let releaseLock: typeof import('../../src/utils/lock.js').releaseLock;

beforeAll(async () => {
  const mod = await import('../../src/utils/lock.js');
  acquireLock = mod.acquireLock;
  releaseLock = mod.releaseLock;
});

afterAll(() => {
  // Ensure any leaked lock is released
  releaseLock().catch(() => {});
  rmSync(testRoot, { recursive: true, force: true });
});

beforeEach(async () => {
  // Release any held lock before each test, then clean up
  await releaseLock().catch(() => {});
  rmSync(testRoot, { recursive: true, force: true });
  mkdirSync(testRoot, { recursive: true });
});

describe('acquireLock', () => {
  it('acquires lock on a clean directory', async () => {
    const lockDir = join(testRoot, 'lock-1');
    mkdirSync(lockDir, { recursive: true });

    await acquireLock(lockDir);

    // Lock file should exist
    const lockFile = join(lockDir, '.lock');
    const raw = readFileSync(lockFile, 'utf-8');
    const data = JSON.parse(raw);
    expect(data.pid).toBe(process.pid);
    expect(typeof data.timestamp).toBe('number');

    await releaseLock();
  });

  it('releases lock and removes lock file', async () => {
    const lockDir = join(testRoot, 'lock-2');
    mkdirSync(lockDir, { recursive: true });

    await acquireLock(lockDir);
    await releaseLock();

    // Lock file should be gone
    const { existsSync } = await import('node:fs');
    expect(existsSync(join(lockDir, '.lock'))).toBe(false);
  });

  it('releaseLock is idempotent', async () => {
    const lockDir = join(testRoot, 'lock-3');
    mkdirSync(lockDir, { recursive: true });

    await acquireLock(lockDir);
    await releaseLock();
    // Second release should not throw
    await expect(releaseLock()).resolves.toBeUndefined();
  });

  it('is re-entrant for the same process', async () => {
    const lockDir = join(testRoot, 'lock-4');
    mkdirSync(lockDir, { recursive: true });

    await acquireLock(lockDir);
    // Same process acquiring again should succeed immediately
    await acquireLock(lockDir);

    await releaseLock();
  });

  it('breaks stale lock from a dead process', async () => {
    const lockDir = join(testRoot, 'lock-5');
    mkdirSync(lockDir, { recursive: true });

    // Write a fake stale lock from a nonexistent PID
    const staleData = { pid: 99999, timestamp: Date.now() - 60_000 };
    writeFileSync(join(lockDir, '.lock'), JSON.stringify(staleData), 'utf-8');

    await acquireLock(lockDir);

    // Should have overwritten the stale lock
    const raw = readFileSync(join(lockDir, '.lock'), 'utf-8');
    const data = JSON.parse(raw);
    expect(data.pid).toBe(process.pid);

    await releaseLock();
  });
});
