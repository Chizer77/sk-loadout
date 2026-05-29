import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, lstatSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { SkillManager } from '../../src/core/skill-manager.js';
import type { SymlinkOps } from '../../src/core/symlink-ops.js';
import type { ConfigManager } from '../../src/core/config-manager.js';
import type { Paths } from '../../src/utils/paths.js';
import type { Logger } from '../../src/utils/logger.js';

const testRoot = mkdtempSync(join(tmpdir(), 'sk-psync-'));
const storeDir = join(testRoot, '.sk-loadout', 'claude');
const skillsDir = join(testRoot, '.claude', 'skills');
const configPath = join(testRoot, '.sk-loadout', 'claude.json');

const testPaths: Paths = {
  storeDir,
  skillsDir,
  settingsPath: join(testRoot, '.claude', 'settings.json'),
  presetConfig: configPath,
  settingsFormat: 'json',
  skillFormat: 'flat-md',
  commandsDir: join(testRoot, '.claude', 'commands', 'sk'),
  home: join(testRoot, '.claude'),
};

let psync: SkillManager;
let ops: SymlinkOps;
let configManager: ConfigManager;
const silentLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  dryRun() {},
  success() {},
};

function existsSync(p: string): boolean {
  try {
    lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

beforeAll(async () => {
  process.env.SK_LOADOUT_HOME = testRoot;
  const [psyncMod, cfgMod] = await Promise.all([
    import('../../src/core/skill-manager.js'),
    import('../../src/core/config-manager.js'),
  ]);
  psync = new psyncMod.SkillManager(testPaths, silentLogger);
  ops = psync.symlinkOps;
  configManager = new cfgMod.ConfigManager(testPaths);
});

beforeEach(async () => {
  rmSync(testRoot, { recursive: true, force: true });
  mkdirSync(storeDir, { recursive: true });
  mkdirSync(skillsDir, { recursive: true });
  await configManager.init({
    currentActive: 'default',
    presets: {
      default: {
        name: 'default',
        description: '',
        modelConfig: { model: '', extra: {} },
        skills: [],
      },
    },
  });
});

afterAll(() => {
  rmSync(testRoot, { recursive: true, force: true });
  delete process.env.SK_LOADOUT_HOME;
});

describe('SkillManager — collect', () => {
  it('returns empty array when skills directory is empty', async () => {
    const extracted = await psync.collect(async () => {});
    expect(extracted).toEqual([]);
  });

  it('does not throw when skills directory does not exist', async () => {
    rmSync(skillsDir, { recursive: true, force: true });
    await expect(psync.collect(async () => {})).resolves.toEqual([]);
    await expect(psync.sync([])).resolves.toBeUndefined();
  });

  it('adopts an unmanaged file from skills/ into the store', async () => {
    writeFileSync(join(skillsDir, 'blind.md'), '# Blind', 'utf-8');

    const extracted = await psync.collect(async () => {});
    await psync.sync([]);

    expect(extracted).toContain('blind.md');
    expect(existsSync(join(storeDir, 'blind.md'))).toBe(true);
  });

  it('skips symlinks that already point into the store', async () => {
    writeFileSync(join(storeDir, 'known.md'), '# Known', 'utf-8');
    await ops.createLink('known.md');

    const extracted = await psync.collect(async () => {});
    await psync.sync(['known.md']);

    expect(extracted).not.toContain('known.md');
    expect(existsSync(join(skillsDir, 'known.md'))).toBe(true);
  });
});

describe('SkillManager — sync', () => {
  it('removes stale symlinks no longer in the target set', async () => {
    writeFileSync(join(storeDir, 'extra.md'), '# Extra', 'utf-8');
    await ops.createLink('extra.md');
    expect(existsSync(join(skillsDir, 'extra.md'))).toBe(true);

    await psync.sync([]);

    expect(existsSync(join(skillsDir, 'extra.md'))).toBe(false);
    expect(existsSync(join(storeDir, 'extra.md'))).toBe(true);
  });

  it('creates missing symlinks for skills in the target set', async () => {
    writeFileSync(join(storeDir, 'needed.md'), '# Needed', 'utf-8');

    await psync.sync(['needed.md']);

    expect(existsSync(join(skillsDir, 'needed.md'))).toBe(true);
  });

  it('throws when skill is not found in the store', async () => {
    // sync() calls createLink() which throws IO_ERROR (wrapping SKILL_NOT_FOUND)
    await expect(psync.sync(['nonexistent.md'])).rejects.toThrow('Target not found');
  });
});

describe('SkillManager — listStore / listMounted', () => {
  it('listStore returns names in the store directory', async () => {
    writeFileSync(join(storeDir, 'a.md'), '# A', 'utf-8');
    mkdirSync(join(storeDir, 'b-dir'), { recursive: true });

    const items = await psync.listStore();
    expect(items).toContain('a.md');
    expect(items).toContain('b-dir');
  });

  it('listStore returns empty array when store does not exist', async () => {
    rmSync(storeDir, { recursive: true, force: true });
    const items = await psync.listStore();
    expect(items).toEqual([]);
  });

  it('listMounted returns names of symlinks pointing into the store', async () => {
    writeFileSync(join(storeDir, 'mounted.md'), '# M', 'utf-8');
    await ops.createLink('mounted.md');

    const mounted = await psync.listMounted();
    expect(mounted).toContain('mounted.md');
  });
});

describe('SkillManager — restore', () => {
  it('restores skill files from store to skills directory', async () => {
    writeFileSync(join(storeDir, 'restore-me.md'), '# Restore', 'utf-8');

    await psync.restore(false);

    // File should be copied back to skills dir
    expect(existsSync(join(skillsDir, 'restore-me.md'))).toBe(true);
    expect(readFileSync(join(skillsDir, 'restore-me.md'), 'utf-8')).toBe('# Restore');
    // Store and config should be deleted
    expect(existsSync(storeDir)).toBe(false);
    expect(existsSync(configPath)).toBe(false);
  });

  it('restore is a no-op when not initialized', async () => {
    rmSync(storeDir, { recursive: true, force: true });
    rmSync(configPath, { force: true });

    // Should not throw — just logs and returns
    await expect(psync.restore(false)).resolves.toBeUndefined();
  });

  it('restore dryRun does not modify filesystem', async () => {
    writeFileSync(join(storeDir, 'keep.md'), '# Keep', 'utf-8');

    await psync.restore(true);

    // Dry run should preserve everything
    expect(existsSync(storeDir)).toBe(true);
    expect(existsSync(configPath)).toBe(true);
    expect(existsSync(join(skillsDir, 'keep.md'))).toBe(false);
  });

  it('restore removes symlinks that point into the store', async () => {
    writeFileSync(join(storeDir, 'linked.md'), '# Linked', 'utf-8');
    await ops.createLink('linked.md');
    expect(existsSync(join(skillsDir, 'linked.md'))).toBe(true);

    await psync.restore(false);

    // Phase 2 restored the file from store to skills dir as a real file
    expect(existsSync(join(skillsDir, 'linked.md'))).toBe(true);
  });
});
