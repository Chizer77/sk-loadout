import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PlatformId } from '../../src/types.js';

const testRoot = mkdtempSync(join(tmpdir(), 'sk-init-test-'));

let createInitCommand: (platform: PlatformId) => import('commander').Command;

beforeAll(async () => {
  process.env.SK_LOADOUT_HOME = testRoot;
  process.env.SK_CLAUDE_HOME = join(testRoot, '.claude');
  const mod = await import('../../src/commands/init.js');
  createInitCommand = mod.createInitCommand;
});

afterAll(() => {
  rmSync(testRoot, { recursive: true, force: true });
  delete process.env.SK_LOADOUT_HOME;
  delete process.env.SK_CLAUDE_HOME;
});

describe('init command', () => {
  it('首次 init 创建配置和目录', async () => {
    rmSync(testRoot, { recursive: true, force: true });
    mkdirSync(testRoot, { recursive: true });
    // init requires platform settings to exist
    const claudeDir = join(testRoot, '.claude');
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(join(claudeDir, 'settings.json'), '{}');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const cmd = createInitCommand('claude').exitOverride(() => {});

    await cmd.parseAsync(['node', 'init']);

    const configPath = join(testRoot, '.sk-loadout', 'claude.json');
    expect(existsSync(configPath)).toBe(true);
    logSpy.mockRestore();
  });

  it('重建已有配置环境', async () => {
    rmSync(testRoot, { recursive: true, force: true });
    const configDir = join(testRoot, '.sk-loadout');
    const skillsDir = join(testRoot, '.claude', 'skills');
    mkdirSync(configDir, { recursive: true });
    mkdirSync(skillsDir, { recursive: true });
    writeFileSync(
      join(configDir, 'claude.json'),
      JSON.stringify({
        currentActive: 'base',
        presets: {
          base: {
            description: 'existing preset',
            skills: [],
          },
        },
      }),
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const cmd = createInitCommand('claude').exitOverride(() => {});

    await cmd.parseAsync(['node', 'init']);

    logSpy.mockRestore();
  });
});
