import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';

const testRoot = mkdtempSync(join(tmpdir(), 'sk-paths-'));

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
  mkdirSync(testRoot, { recursive: true });
});

describe('getPaths', () => {
  it('resolves Claude Code paths with env var override', async () => {
    const { getPaths } = await import('../../src/utils/paths.js');
    const paths = getPaths('claude');

    expect(paths.home).toBe(join(testRoot, '.claude'));
    expect(paths.settingsFormat).toBe('json');
    expect(paths.skillFormat).toBe('flat-md');
    expect(paths.storeDir).toBe(join(testRoot, '.sk-loadout', 'claude'));
    expect(paths.presetConfig).toBe(join(testRoot, '.sk-loadout', 'claude.json'));
    expect(paths.commandsDir).toBe(join(testRoot, '.claude', 'commands', 'sk'));
  });

  it('resolves OpenCode paths', async () => {
    process.env.SK_OPENCODE_HOME = join(testRoot, '.config', 'opencode');
    const { getPaths } = await import('../../src/utils/paths.js');
    const paths = getPaths('opencode');

    expect(paths.settingsFormat).toBe('jsonc');
    expect(paths.skillFormat).toBe('folder-skill-md');
    expect(paths.commandsDir).toBeUndefined();
    delete process.env.SK_OPENCODE_HOME;
  });

  it('resolves Codex paths with env var override', async () => {
    process.env.SK_CODEX_HOME = join(testRoot, '.codex');
    const { getPaths } = await import('../../src/utils/paths.js');
    const paths = getPaths('codex');

    expect(paths.home).toBe(join(testRoot, '.codex'));
    expect(paths.settingsPath).toBe(join(testRoot, '.codex', 'config.toml'));
    expect(paths.settingsFormat).toBe('toml');
    expect(paths.skillFormat).toBe('folder-skill-md');
    // skillsHome defaults to ~/.agents (not affected by SK_CODEX_HOME)
    expect(paths.skillsDir).toBe(join(homedir(), '.agents', 'skills'));
    delete process.env.SK_CODEX_HOME;
  });

  it('resolves Codex skills home via SK_CODEX_SKILLS_HOME', async () => {
    process.env.SK_CODEX_HOME = join(testRoot, '.codex');
    process.env.SK_CODEX_SKILLS_HOME = join(testRoot, 'custom-skills');
    const { getPaths } = await import('../../src/utils/paths.js');
    const paths = getPaths('codex');

    expect(paths.home).toBe(join(testRoot, '.codex'));
    expect(paths.skillsDir).toBe(join(testRoot, 'custom-skills', 'skills'));
    delete process.env.SK_CODEX_HOME;
    delete process.env.SK_CODEX_SKILLS_HOME;
  });

  it('falls back to OS default when no env var set', async () => {
    // Temporarily unset, but since we're in a test the OS default
    // is the real homedir — verify the structure is correct at least
    delete process.env.SK_CLAUDE_HOME;
    const { getPaths } = await import('../../src/utils/paths.js');
    const paths = getPaths('claude');

    expect(paths.home).toBe(join(homedir(), '.claude'));
    expect(paths.settingsPath).toBe(join(homedir(), '.claude', 'settings.json'));
    // Restore
    process.env.SK_CLAUDE_HOME = join(testRoot, '.claude');
  });
});

describe('getSkLoadoutDir', () => {
  it('returns SK_LOADOUT_HOME when set', async () => {
    const { getSkLoadoutDir } = await import('../../src/utils/paths.js');
    const dir = getSkLoadoutDir();
    expect(dir).toBe(join(testRoot, '.sk-loadout'));
  });

  it('falls back to homedir when SK_LOADOUT_HOME is unset', async () => {
    delete process.env.SK_LOADOUT_HOME;
    const { getSkLoadoutDir } = await import('../../src/utils/paths.js');
    const dir = getSkLoadoutDir();
    expect(dir).toBe(join(homedir(), '.sk-loadout'));
    process.env.SK_LOADOUT_HOME = testRoot;
  });
});

describe('persisted home resolution', () => {
  it('reads home from persisted config when path exists', async () => {
    const persistedHome = join(testRoot, 'custom-claude-home');
    mkdirSync(join(testRoot, '.sk-loadout'), { recursive: true });
    mkdirSync(persistedHome, { recursive: true });
    writeFileSync(
      join(testRoot, '.sk-loadout', 'claude.json'),
      JSON.stringify({ currentActive: 'base', home: persistedHome, presets: {} }),
    );
    // Remove env var so it falls through to persisted
    delete process.env.SK_CLAUDE_HOME;

    const { getPaths } = await import('../../src/utils/paths.js');
    const paths = getPaths('claude');

    expect(paths.home).toBe(persistedHome);

    process.env.SK_CLAUDE_HOME = join(testRoot, '.claude');
  });

  it('ignores persisted home when path no longer exists', async () => {
    const staleHome = join(testRoot, 'stale-home');
    mkdirSync(join(testRoot, '.sk-loadout'), { recursive: true });
    writeFileSync(
      join(testRoot, '.sk-loadout', 'claude.json'),
      JSON.stringify({ currentActive: 'base', home: staleHome, presets: {} }),
    );
    // staleHome does not actually exist on disk
    delete process.env.SK_CLAUDE_HOME;

    const { getPaths } = await import('../../src/utils/paths.js');
    const paths = getPaths('claude');

    // Should fall through to OS default since persisted path is dead
    expect(paths.home).toBe(join(homedir(), '.claude'));

    process.env.SK_CLAUDE_HOME = join(testRoot, '.claude');
  });
});
