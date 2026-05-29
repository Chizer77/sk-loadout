import { writeFile, readFile, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { LoadoutError, ErrorCode, isErrCode } from './errors.js';

// Lock lifetime: stale locks (>30s) from dead processes are auto-broken.
// Retry: 200ms intervals, up to 5s total before giving up.
const STALE_TIMEOUT_MS = 30_000;
const LOCK_RETRY_MS = 200;
const LOCK_MAX_WAIT_MS = 5_000;

interface LockData {
  pid: number;
  timestamp: number;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function lockPath(dir: string): string {
  return join(dir, '.lock');
}

async function readLock(dir: string): Promise<LockData | null> {
  try {
    const raw = await readFile(lockPath(dir), 'utf-8');
    return JSON.parse(raw) as LockData;
  } catch (err: unknown) {
    if (isErrCode(err, 'ENOENT')) return null;
    // Corrupt lock or permission error — log and treat as no lock rather than
    // crashing, since writeLock will overwrite it anyway.
    return null;
  }
}

async function writeLock(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  const data: LockData = { pid: process.pid, timestamp: Date.now() };
  await writeFile(lockPath(dir), JSON.stringify(data), 'utf-8');
}

let _lockDir: string | null = null;

export async function acquireLock(dir: string): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < LOCK_MAX_WAIT_MS) {
    const existing = await readLock(dir);

    if (!existing) {
      await writeLock(dir);
      _lockDir = dir;
      return;
    }

    const age = Date.now() - existing.timestamp;
    if (age > STALE_TIMEOUT_MS && !isProcessAlive(existing.pid)) {
      await writeLock(dir);
      _lockDir = dir;
      return;
    }

    // Re-entrant: same process already holds the lock
    if (existing.pid === process.pid) {
      _lockDir = dir;
      return;
    }

    await new Promise((r) => setTimeout(r, LOCK_RETRY_MS));
  }

  throw new LoadoutError(ErrorCode.LOCK_TIMEOUT, 'Unable to acquire config lock. Try again.');
}

export async function releaseLock(): Promise<void> {
  if (!_lockDir) return;
  try {
    await unlink(lockPath(_lockDir));
  } catch {
    // Lock file may have already been cleaned up — ignore
  }
  _lockDir = null;
}
