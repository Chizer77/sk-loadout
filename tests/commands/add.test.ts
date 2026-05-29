import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, lstatSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAddCommand } from '../../src/commands/add.js';

const testRoot = mkdtempSync(join(tmpdir(), 'sk-add-'));
const configPath = join(testRoot, '.sk-loadout', 'claude.json');
const storeDir = join(testRoot, '.sk-loadout', 'claude');
const skillsDir = join(testRoot, '.claude', 'skills');

const baseConfig = {
  currentActive: 'base',
  presets: {
    base: {
      description: 'default',
      modelConfig: { model: 'claude', extra: {} },
      skills: [],
    },
  },
};

beforeAll(() => {
  process.env.SK_LOADOUT_HOME = testRoot;
  process.env.SK_CLAUDE_HOME = join(testRoot, '.claude');
});

afterAll(() => {
  rmSync(testRoot, { recursive: true, force: true });
  delete process.env.SK_LOADOUT_HOME;
  delete process.env.SK_CLAUDE_HOME;
});

beforeEach(() => {
  rmSync(testRoot, { recursive: true, force: true });
  mkdirSync(join(testRoot, '.sk-loadout'), { recursive: true });
  mkdirSync(storeDir, { recursive: true });
  mkdirSync(skillsDir, { recursive: true });
  writeFileSync(configPath, JSON.stringify(baseConfig, null, 2));
});

function exists(p: string): boolean {
  try {
    lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

describe('add command', () => {
  it('挂载有效技能到当前预设', async () => {
    writeFileSync(join(storeDir, 'helper.md'), '# Helper', 'utf-8');

    const cmd = createAddCommand('claude').exitOverride(() => {});
    await cmd.parseAsync(['node', 'add', 'helper.md']);

    // 验证软链接已创建
    expect(exists(join(skillsDir, 'helper.md'))).toBe(true);
    // 验证配置文件已更新
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(config.presets.base.skills).toContain('helper.md');
  });

  it('批量挂载多个技能', async () => {
    writeFileSync(join(storeDir, 'a.md'), '# A', 'utf-8');
    writeFileSync(join(storeDir, 'b.md'), '# B', 'utf-8');

    const cmd = createAddCommand('claude').exitOverride(() => {});
    await cmd.parseAsync(['node', 'add', 'a.md', 'b.md']);

    expect(exists(join(skillsDir, 'a.md'))).toBe(true);
    expect(exists(join(skillsDir, 'b.md'))).toBe(true);
  });

  it('技能不在 store 中时抛出错误', async () => {
    const cmd = createAddCommand('claude').exitOverride(() => {});
    await expect(cmd.parseAsync(['node', 'add', 'nonexistent.md'])).rejects.toThrow(
      'not found in store',
    );
  });

  it('非法技能名抛出验证错误', async () => {
    const cmd = createAddCommand('claude').exitOverride(() => {});
    await expect(cmd.parseAsync(['node', 'add', '../../../etc/passwd'])).rejects.toThrow('Invalid');
  });
});
