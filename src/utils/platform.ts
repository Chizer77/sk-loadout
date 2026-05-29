import { platform as osPlatform } from 'node:os';
import { symlink, mkdir } from 'node:fs/promises';
import { dirname, relative, isAbsolute } from 'node:path';

import type { OsPlatform } from '../types.js';

const PLATFORM_MAP: Record<string, OsPlatform> = {
  win32: 'win32',
  darwin: 'darwin',
  linux: 'linux',
};

export function getPlatform(): OsPlatform {
  return PLATFORM_MAP[osPlatform()] ?? 'linux';
}

// Create a directory symlink. Uses `junction` type on Windows because
// standard `dir` symlinks require Developer Mode (admin by default).
export async function createDirSymlink(target: string, path: string): Promise<void> {
  const type = getPlatform() === 'win32' ? 'junction' : 'dir';

  await mkdir(dirname(path), { recursive: true });

  await symlink(target, path, type);
}

// Check whether `child` is a strict subpath of `parent` (does not follow symlinks).
export function isSubPath(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}
