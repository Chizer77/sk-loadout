import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLsCommand } from '../../src/commands/list.js';

const testRoot = mkdtempSync(join(tmpdir(), 'sk-ls-'));
const configPath = join(testRoot, '.sk-loadout', 'claude.json');
const storeDir = join(testRoot, '.sk-loadout', 'claude');
const skillsDir = join(testRoot, '.claude', 'skills');

const baseConfig = {
  currentActive: 'base',
  presets: {
    base: {
      description: 'my preset',
      modelConfig: { model: 'claude-sonnet', extra: {} },
      skills: ['helper.md'],
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
  writeFileSync(join(storeDir, 'helper.md'), '# Helper', 'utf-8');
  writeFileSync(configPath, JSON.stringify(baseConfig, null, 2));
});

describe('ls command', () => {
  it('以人类可读格式输出当前状态', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const cmd = createLsCommand('claude').exitOverride(() => {});

    await cmd.parseAsync(['node', 'ls']);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('base');
    expect(output).toContain('my preset');
    expect(output).toContain('claude-sonnet');
    logSpy.mockRestore();
  });

  it('以 JSON 格式输出状态', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const cmd = createLsCommand('claude').exitOverride(() => {});

    await cmd.parseAsync(['node', 'ls', '--json']);

    const jsonArg = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(jsonArg);
    expect(parsed.activePreset).toBe('base');
    expect(parsed.model).toBe('claude-sonnet');
    expect(parsed.platform).toBe('claude');
    expect(parsed.presets).toBeInstanceOf(Array);
    logSpy.mockRestore();
  });
});
