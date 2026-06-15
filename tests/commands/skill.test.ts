import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// hoisted mock: 替换 tui 模块避免真实终端交互
vi.mock('../../src/tui.js', () => ({
  manageSkills: vi.fn().mockResolvedValue(['skill-a.md']),
  selectPreset: vi.fn(),
}));

const testRoot = mkdtempSync(join(tmpdir(), 'sk-skill-'));
const configPath = join(testRoot, '.sk-loadout', 'claude.json');
const storeDir = join(testRoot, '.sk-loadout', 'claude');
const skillsDir = join(testRoot, '.claude', 'skills');

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
  writeFileSync(
    configPath,
    JSON.stringify(
      {
        currentActive: 'base',
        presets: {
          base: {
            description: 'default',
            skills: [],
          },
        },
      },
      null,
      2,
    ),
  );
});

describe('skill command', () => {
  it('非 TTY 环境抛出错误', async () => {
    const originalTTY = process.stdout.isTTY;
    process.stdout.isTTY = false;

    try {
      const { createSkillCommand } = await import('../../src/commands/skill.js');
      const cmd = createSkillCommand('claude').exitOverride(() => {});

      await expect(cmd.parseAsync(['node', 'skill'])).rejects.toThrow(
        'TUI mode requires a terminal',
      );
    } finally {
      process.stdout.isTTY = originalTTY;
    }
  });

  it('TTY 环境正常执行技能管理', async () => {
    const originalTTY = process.stdout.isTTY;
    process.stdout.isTTY = true;

    try {
      writeFileSync(join(storeDir, 'skill-a.md'), '# Skill A', 'utf-8');
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { createSkillCommand } = await import('../../src/commands/skill.js');
      const cmd = createSkillCommand('claude').exitOverride(() => {});

      await cmd.parseAsync(['node', 'skill']);

      // 验证预设中的 skills 被 tui 返回值替换
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(config.presets.base.skills).toEqual(['skill-a.md']);
      logSpy.mockRestore();
    } finally {
      process.stdout.isTTY = originalTTY;
    }
  });
});
