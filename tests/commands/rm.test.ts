import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRmCommand } from '../../src/commands/rm.js';

const testRoot = mkdtempSync(join(tmpdir(), 'sk-rm-'));
const configPath = join(testRoot, '.sk-loadout', 'claude.json');
const storeDir = join(testRoot, '.sk-loadout', 'claude');
const skillsDir = join(testRoot, '.claude', 'skills');

function baseConfig(extra?: Record<string, unknown>) {
  return {
    currentActive: 'base',
    presets: {
      base: {
        description: 'default',
        skills: ['skill.md'],
      },
      ...extra,
    },
  };
}

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
});

function readConfig() {
  return JSON.parse(readFileSync(configPath, 'utf-8'));
}

describe('rm command', () => {
  it('卸载未挂载技能时保留配置不变', async () => {
    // skill 在 config 中但未实际挂载（无 symlink），rm 应跳过
    writeFileSync(configPath, JSON.stringify(baseConfig(), null, 2));
    writeFileSync(join(storeDir, 'skill.md'), '# Skill', 'utf-8');

    const cmd = createRmCommand('claude').exitOverride(() => {});
    await cmd.parseAsync(['node', 'rm', 'skill.md']);

    // 未挂载的技能不应从 config 中移除
    expect(readConfig().presets.base.skills).toContain('skill.md');
  });

  it('删除预设（非 base）', async () => {
    writeFileSync(
      configPath,
      JSON.stringify(
        baseConfig({
          mypreset: {
            description: 'custom',
            skills: [],
          },
        }),
        null,
        2,
      ),
    );

    const cmd = createRmCommand('claude').exitOverride(() => {});
    await cmd.parseAsync(['node', 'rm', '-p', 'mypreset', '--yes']);

    expect(readConfig().presets).not.toHaveProperty('mypreset');
  });

  it('不允许删除 base 预设', async () => {
    writeFileSync(configPath, JSON.stringify(baseConfig(), null, 2));

    const cmd = createRmCommand('claude').exitOverride(() => {});
    await expect(cmd.parseAsync(['node', 'rm', '-p', 'base'])).rejects.toThrow('Cannot delete');
  });

  it('卸载未挂载的技能时跳过不抛错', async () => {
    writeFileSync(configPath, JSON.stringify(baseConfig(), null, 2));
    writeFileSync(join(storeDir, 'other.md'), '# Other', 'utf-8');

    const cmd = createRmCommand('claude').exitOverride(() => {});
    // 不应抛错
    await cmd.parseAsync(['node', 'rm', 'other.md']);
    // 验证 config 未被修改
    expect(readConfig().presets.base.skills).toEqual(['skill.md']);
  });

  it('无参数且非预设模式抛出错误', async () => {
    writeFileSync(configPath, JSON.stringify(baseConfig(), null, 2));

    const cmd = createRmCommand('claude').exitOverride(() => {});
    await expect(cmd.parseAsync(['node', 'rm'])).rejects.toThrow('Specify skills to remove');
  });
});
