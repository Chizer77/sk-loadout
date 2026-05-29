import { describe, it, expect, vi, afterAll } from 'vitest';

const mocks = vi.hoisted(() => ({
  platform: vi.fn(),
  symlink: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock('node:os', () => ({
  default: { platform: mocks.platform },
  platform: mocks.platform,
}));

vi.mock('node:fs/promises', () => ({
  default: { symlink: mocks.symlink, mkdir: mocks.mkdir },
  symlink: mocks.symlink,
  mkdir: mocks.mkdir,
}));

import { createDirSymlink, isSubPath, getPlatform } from '../../src/utils/platform.js';
import { symlink } from 'node:fs/promises';

afterAll(() => {
  vi.restoreAllMocks();
});

describe('createDirSymlink', () => {
  it('Windows 上用 junction', async () => {
    mocks.platform.mockReturnValue('win32');

    await createDirSymlink('/target', '/link');

    expect(symlink).toHaveBeenCalledWith('/target', '/link', 'junction');
  });

  it('POSIX 上用 dir', async () => {
    mocks.platform.mockReturnValue('linux');

    await createDirSymlink('/target', '/link');

    expect(symlink).toHaveBeenCalledWith('/target', '/link', 'dir');
  });
});

describe('getPlatform', () => {
  it('返回当前平台值', () => {
    const p = getPlatform();
    expect(['win32', 'darwin', 'linux']).toContain(p);
  });
});

describe('isSubPath', () => {
  it('子路径在父目录内返回 true', () => {
    expect(isSubPath('/root', '/root/sub/file.md')).toBe(true);
  });

  it('子路径不在父目录内返回 false', () => {
    expect(isSubPath('/root', '/other/file.md')).toBe(false);
  });

  it('父路径自身返回 false', () => {
    expect(isSubPath('/root', '/root')).toBe(false);
  });
});
