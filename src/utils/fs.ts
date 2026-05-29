import { mkdir, writeFile, rename, lstat, copyFile, readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { isErrCode } from './errors.js';

export async function pathExists(p: string): Promise<boolean> {
  try {
    await lstat(p);
    return true;
  } catch (err: unknown) {
    if (isErrCode(err, 'ENOENT')) return false;
    if (isErrCode(err, 'EACCES') || isErrCode(err, 'EPERM')) return true;
    throw err;
  }
}

// Near-atomic write: write to a temp file first, then rename over the target.
// rename() is atomic on the same filesystem.
export async function safeWrite(filePath: string, content: string): Promise<void> {
  const tmpPath = `${filePath}.tmp`;
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(tmpPath, content, 'utf-8');
  await rename(tmpPath, filePath);
}

export async function copyRecursive(src: string, dest: string): Promise<void> {
  const stat = await lstat(src);
  if (stat.isFile()) {
    await copyFile(src, dest);
  } else if (stat.isDirectory()) {
    await mkdir(dest, { recursive: true });
    const entries = await readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.' || entry.name === '..') continue;
      await copyRecursive(join(src, entry.name), join(dest, entry.name));
    }
  }
}

// Moves a file or directory. Prefers rename (atomic, O(1) on same device).
// Falls back to copy+delete for cross-device moves (EXDEV) and handles
// Windows rename-not-overwriting (EPERM/EEXIST).
export async function move(src: string, dest: string): Promise<void> {
  try {
    await rename(src, dest);
  } catch (err: unknown) {
    const code: string | undefined =
      err instanceof Error ? (err as NodeJS.ErrnoException).code : undefined;
    if (code === 'EXDEV') {
      // Cross-device — rename not possible, fall back to copy + delete
      await copyRecursive(src, dest);
      await rm(src, { recursive: true, force: true });
    } else if (code === 'EPERM' || code === 'EEXIST') {
      // Windows: rename does not overwrite existing destinations
      await rm(dest, { recursive: true, force: true });
      await rename(src, dest);
    } else {
      throw err;
    }
  }
}
