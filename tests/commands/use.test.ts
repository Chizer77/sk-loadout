import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createUseCommand } from '../../src/commands/use.js';

const testRoot = mkdtempSync(join(tmpdir(), 'sk-use-'));
const configPath = join(testRoot, '.sk-loadout', 'claude.json');
const storeDir = join(testRoot, '.sk-loadout', 'claude');
const skillsDir = join(testRoot, '.claude', 'skills');
const settingsPath = join(testRoot, '.claude', 'settings.json');

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

describe('use command', () => {
  it('切换到指定预设并应用模型和技能', async () => {
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
            target: {
              description: 'target preset',
              skills: [],
            },
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(settingsPath, JSON.stringify({ model: 'old-model', env: {} }, null, 2));

    const cmd = createUseCommand('claude').exitOverride(() => {});
    await cmd.parseAsync(['node', 'use', 'target']);

    // 验证 currentActive 已切换
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(config.currentActive).toBe('target');
  });

  it('预设不存在时抛出错误', async () => {
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

    const cmd = createUseCommand('claude').exitOverride(() => {});
    await expect(cmd.parseAsync(['node', 'use', 'nonexistent'])).rejects.toThrow('not found');
  });
});
