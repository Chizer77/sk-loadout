import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSaveCommand } from '../../src/commands/save.js';

const testRoot = mkdtempSync(join(tmpdir(), 'sk-save-'));
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
  writeFileSync(settingsPath, JSON.stringify({ model: 'claude-sonnet', env: {} }, null, 2));
});

function readConfig() {
  return JSON.parse(readFileSync(configPath, 'utf-8'));
}

describe('save command', () => {
  it('无参数时更新当前预设', async () => {
    writeFileSync(
      configPath,
      JSON.stringify(
        {
          currentActive: 'base',
          presets: {
            base: {
              description: 'old desc',
              modelConfig: { model: 'claude', extra: {} },
              skills: [],
            },
          },
        },
        null,
        2,
      ),
    );

    const cmd = createSaveCommand('claude').exitOverride(() => {});
    await cmd.parseAsync(['node', 'save']);

    const config = readConfig();
    expect(config.presets.base.modelConfig.model).toBe('claude-sonnet');
  });

  it('有参数时创建新预设', async () => {
    writeFileSync(
      configPath,
      JSON.stringify(
        {
          currentActive: 'base',
          presets: {
            base: {
              description: 'default',
              modelConfig: { model: 'claude', extra: {} },
              skills: [],
            },
          },
        },
        null,
        2,
      ),
    );

    const cmd = createSaveCommand('claude').exitOverride(() => {});
    await cmd.parseAsync(['node', 'save', 'new-preset', '--desc', 'my new preset']);

    const config = readConfig();
    expect(config.presets).toHaveProperty('new-preset');
    expect(config.presets['new-preset'].description).toBe('my new preset');
    expect(config.currentActive).toBe('new-preset');
  });

  it('覆盖已存在预设', async () => {
    writeFileSync(
      configPath,
      JSON.stringify(
        {
          currentActive: 'base',
          presets: {
            base: {
              description: 'default',
              modelConfig: { model: 'claude', extra: {} },
              skills: [],
            },
            existing: {
              description: 'old desc',
              modelConfig: { model: 'old-model', extra: {} },
              skills: [],
            },
          },
        },
        null,
        2,
      ),
    );

    const cmd = createSaveCommand('claude').exitOverride(() => {});
    await cmd.parseAsync(['node', 'save', 'existing', '--desc', 'new desc']);

    const config = readConfig();
    expect(config.presets.existing.description).toBe('new desc');
  });
});
