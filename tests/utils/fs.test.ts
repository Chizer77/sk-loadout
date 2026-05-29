import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  readFileSync,
  lstatSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { pathExists, copyRecursive, safeWrite, move } from '../../src/utils/fs.js';

const testRoot = mkdtempSync(join(tmpdir(), 'sk-loadout-fs-'));

beforeAll(() => {
  mkdirSync(testRoot, { recursive: true });
});

afterAll(() => {
  rmSync(testRoot, { recursive: true, force: true });
});

describe('pathExists', () => {
  it('真实文件返回 true', async () => {
    const f = join(testRoot, 'real-file.txt');
    writeFileSync(f, 'hello', 'utf-8');
    await expect(pathExists(f)).resolves.toBe(true);
  });

  it('真实目录返回 true', async () => {
    const d = join(testRoot, 'real-dir');
    mkdirSync(d, { recursive: true });
    await expect(pathExists(d)).resolves.toBe(true);
  });

  it('不存在的路径返回 false', async () => {
    await expect(pathExists(join(testRoot, 'nope'))).resolves.toBe(false);
  });

  it('断开的 symlink 返回 true', async () => {
    const target = join(testRoot, 'ghost-target');
    const link = join(testRoot, 'broken-link');
    try {
      symlinkSync(target, link, 'file');
    } catch {
      // Windows 无开发者模式时 symlink 创建会失败，跳过该测试
      return;
    }
    await expect(pathExists(link)).resolves.toBe(true);
  });

  it('有效的 symlink 返回 true', async () => {
    const target = join(testRoot, 'real-target.txt');
    const link = join(testRoot, 'valid-link');
    writeFileSync(target, 'content', 'utf-8');
    try {
      symlinkSync(target, link, 'file');
    } catch {
      return;
    }
    await expect(pathExists(link)).resolves.toBe(true);
  });
});

describe('copyRecursive', () => {
  it('复制单个文件', async () => {
    const src = join(testRoot, 'src-file.txt');
    const dest = join(testRoot, 'dest-file.txt');
    writeFileSync(src, 'hello', 'utf-8');

    await copyRecursive(src, dest);

    await expect(pathExists(dest)).resolves.toBe(true);
  });

  it('递归复制目录', async () => {
    const srcDir = join(testRoot, 'src-dir');
    const destDir = join(testRoot, 'dest-dir');
    mkdirSync(join(srcDir, 'sub'), { recursive: true });
    writeFileSync(join(srcDir, 'a.md'), 'a', 'utf-8');
    writeFileSync(join(srcDir, 'sub', 'b.md'), 'b', 'utf-8');

    await copyRecursive(srcDir, destDir);

    await expect(pathExists(join(destDir, 'a.md'))).resolves.toBe(true);
    await expect(pathExists(join(destDir, 'sub', 'b.md'))).resolves.toBe(true);
  });
});

describe('safeWrite', () => {
  it('写入文件内容正确', async () => {
    const f = join(testRoot, 'atomic.txt');
    await safeWrite(f, 'hello');

    expect(readFileSync(f, 'utf-8')).toBe('hello');
  });

  it('父目录不存在时自动创建', async () => {
    const f = join(testRoot, 'new-dir', 'nested', 'file.txt');
    await safeWrite(f, 'auto-created');

    expect(readFileSync(f, 'utf-8')).toBe('auto-created');
  });
});

describe('move', () => {
  it('同盘符下 rename 移动文件', async () => {
    const src = join(testRoot, 'move-src.txt');
    const dest = join(testRoot, 'move-dest.txt');
    writeFileSync(src, 'movable');

    await move(src, dest);

    expect(lstatSync(dest).isFile()).toBe(true);
    // 源文件应在原有位置消失
    const srcExists = await pathExists(src).catch(() => false);
    expect(srcExists).toBe(false);
  });

  it('移动到已存在的目标时覆盖', async () => {
    const src = join(testRoot, 'overwrite-src.txt');
    const dest = join(testRoot, 'overwrite-dest.txt');
    writeFileSync(src, 'new');
    writeFileSync(dest, 'old');

    await move(src, dest);

    expect(readFileSync(dest, 'utf-8')).toBe('new');
  });
});
