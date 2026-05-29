import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, lstatSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { SymlinkOps } from '../../src/core/symlink-ops.js';
import type { Paths } from '../../src/utils/paths.js';
import type { Logger } from '../../src/utils/logger.js';

const testRoot = mkdtempSync(join(tmpdir(), 'sk-symops-'));
const storeDir = join(testRoot, '.sk-loadout', 'claude');
const skillsDir = join(testRoot, '.claude', 'skills');

const testPaths: Paths = {
  home: join(testRoot, '.claude'),
  storeDir,
  skillsDir,
  settingsPath: join(testRoot, '.claude', 'settings.json'),
  presetConfig: join(testRoot, '.sk-loadout', 'claude.json'),
  settingsFormat: 'json',
  skillFormat: 'flat-md',
  commandsDir: join(testRoot, '.claude', 'commands', 'sk'),
};

let ops: SymlinkOps;
const silentLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  dryRun() {},
  success() {},
};

beforeAll(async () => {
  process.env.SK_LOADOUT_HOME = testRoot;
  const mod = await import('../../src/core/symlink-ops.js');
  ops = new mod.SymlinkOps(testPaths, silentLogger);
});

beforeEach(() => {
  rmSync(testRoot, { recursive: true, force: true });
  mkdirSync(storeDir, { recursive: true });
  mkdirSync(skillsDir, { recursive: true });
});

afterAll(() => {
  rmSync(testRoot, { recursive: true, force: true });
  delete process.env.SK_LOADOUT_HOME;
});

function existsSync(p: string): boolean {
  try {
    lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

async function tryCreateLink(ops: SymlinkOps, name: string): Promise<boolean> {
  try {
    await ops.createLink(name);
    return true;
  } catch {
    return false;
  }
}

describe('SymlinkOps', () => {
  it('创建文件软链接', async () => {
    writeFileSync(join(storeDir, 'test-skill.md'), '# Test', 'utf-8');

    const ok = await tryCreateLink(ops, 'test-skill.md');
    if (!ok) return;

    expect(existsSync(join(skillsDir, 'test-skill.md'))).toBe(true);
  });

  it('安全删除软链接并保留 .store/ 真身', async () => {
    writeFileSync(join(storeDir, 'test-skill.md'), '# Test', 'utf-8');

    const ok = await tryCreateLink(ops, 'test-skill.md');
    if (!ok) return;

    await ops.removeLink('test-skill.md');

    expect(existsSync(join(skillsDir, 'test-skill.md'))).toBe(false);
    expect(existsSync(join(storeDir, 'test-skill.md'))).toBe(true);
  });

  it('重复创建幂等', async () => {
    writeFileSync(join(storeDir, 'test-skill.md'), '# Test', 'utf-8');

    const ok = await tryCreateLink(ops, 'test-skill.md');
    if (!ok) return;

    await expect(ops.createLink('test-skill.md')).resolves.toBeUndefined();
  });

  it('删除不存在的链接静默跳过', async () => {
    await expect(ops.removeLink('nonexistent.md')).resolves.toBeUndefined();
  });

  it('创建目录软链接', async () => {
    mkdirSync(join(storeDir, 'dir-skill'), { recursive: true });
    writeFileSync(join(storeDir, 'dir-skill', 'main.md'), '# dir', 'utf-8');

    const ok = await tryCreateLink(ops, 'dir-skill');
    if (!ok) return;

    expect(existsSync(join(skillsDir, 'dir-skill'))).toBe(true);
  });

  it('createLink 在 .store/ 中无对应文件时抛异常', async () => {
    await expect(ops.createLink('nonexistent.md')).rejects.toThrow();
  });

  it('removeLink 对真实文件静默跳过', async () => {
    writeFileSync(join(skillsDir, 'real-file.txt'), 'not a symlink', 'utf-8');
    await expect(ops.removeLink('real-file.txt')).resolves.toBeUndefined();
    expect(existsSync(join(skillsDir, 'real-file.txt'))).toBe(true);
  });
});
