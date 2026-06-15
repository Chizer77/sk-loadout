import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, lstatSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { SymlinkOps } from '../../src/core/symlink-ops.js';
import type { ConfigManager } from '../../src/core/config-manager.js';
import type { Paths } from '../../src/utils/paths.js';
import type { Logger } from '../../src/utils/logger.js';

const testRoot = mkdtempSync(join(tmpdir(), 'sk-e2e-'));
const skLoadoutDir = join(testRoot, '.sk-loadout');
const claudeDir = join(testRoot, '.claude');
const skillsDir = join(claudeDir, 'skills');
const storeDir = join(skLoadoutDir, 'claude');

const testPaths: Paths = {
  home: claudeDir,
  storeDir,
  skillsDir,
  settingsPath: join(claudeDir, 'settings.json'),
  presetConfig: join(skLoadoutDir, 'claude.json'),
  settingsFormat: 'json',
  skillFormat: 'flat-md',
  commandsDir: join(claudeDir, 'commands', 'sk'),
};

let configManager: ConfigManager;
let CfgManagerClass: typeof ConfigManager;
let ops: SymlinkOps;
let skillManager: import('../../src/core/skill-manager.js').SkillManager;
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
  process.env.SK_CLAUDE_HOME = join(testRoot, '.claude');
  const [cfgMod, psMod] = await Promise.all([
    import('../../src/core/config-manager.js'),
    import('../../src/core/skill-manager.js'),
  ]);
  CfgManagerClass = cfgMod.ConfigManager;
  skillManager = new psMod.SkillManager(testPaths, silentLogger);
  ops = skillManager.symlinkOps;
  configManager = new CfgManagerClass(testPaths);
});

beforeEach(() => {
  rmSync(testRoot, { recursive: true, force: true });
  mkdirSync(storeDir, { recursive: true });
  mkdirSync(skillsDir, { recursive: true });
  writeFileSync(join(skillsDir, 'existing-skill.md'), '# Existing', 'utf-8');
  writeFileSync(
    join(claudeDir, 'settings.json'),
    JSON.stringify({
      model: 'claude-sonnet',
      env: { ANTHROPIC_BASE_URL: 'https://api.anthropic.com' },
    }),
    'utf-8',
  );
  configManager = new CfgManagerClass(testPaths);
});

afterAll(() => {
  rmSync(testRoot, { recursive: true, force: true });
  delete process.env.SK_LOADOUT_HOME;
  delete process.env.SK_CLAUDE_HOME;
});

describe('User Journey', () => {
  it(
    'init → create → switch → mount → ls → unmount → delete → uninstall',
    { timeout: 15000 },
    async () => {
      const configPath = join(skLoadoutDir, 'claude.json');

      // 1. Init
      await configManager.init({
        currentActive: 'default',
        presets: {
          default: {
            name: 'default',
            description: '默认',
            skills: [],
          },
        },
      });
      await configManager.setActive('default');
      await skillManager.collect(async () => {});
      await skillManager.sync([]);

      expect(existsSync(configPath)).toBe(true);

      // 2. Create: 新建 frontend 预设
      writeFileSync(join(storeDir, 'new-skill.md'), '# New', 'utf-8');
      await ops.createLink('new-skill.md');
      await configManager.addSkill('default', 'new-skill.md');

      await configManager.setPreset({
        name: 'frontend',
        description: '前端开发背包',
        skills: ['existing-skill.md'],
      });
      expect((await configManager.getPreset('frontend')).description).toBe('前端开发背包');

      // 3. Switch
      const fp = await configManager.getPreset('frontend');
      await skillManager.sync(fp.skills);
      await configManager.setActive('frontend');

      // 4. Mount
      writeFileSync(join(storeDir, 'vue-helper.md'), '# Vue', 'utf-8');
      await ops.createLink('vue-helper.md');
      await configManager.addSkill('frontend', 'vue-helper.md');
      expect(await skillManager.listMounted()).toContain('vue-helper.md');

      // 5. Ls
      expect(await configManager.listPresets()).toHaveLength(2);

      // 6. Unmount
      await ops.removeLink('vue-helper.md');
      await configManager.removeSkill('frontend', 'vue-helper.md');
      expect(await skillManager.listMounted()).not.toContain('vue-helper.md');
      expect(await skillManager.listStore()).toContain('vue-helper.md');

      // 7. Delete
      await configManager.removePreset('frontend');
      await expect(configManager.getPreset('frontend')).rejects.toThrow();

      // 8. Default intact
      expect(await configManager.listPresets()).toContain('default');
    },
  );

  it('盲盒文件提取和重建', async () => {
    await configManager.init({
      currentActive: 'default',
      presets: {
        default: {
          name: 'default',
          description: '默认',
          skills: [],
        },
      },
    });

    writeFileSync(join(skillsDir, 'third-party-skill.md'), '# Third party', 'utf-8');
    mkdirSync(join(skillsDir, 'multi-file-skill'), { recursive: true });
    writeFileSync(join(skillsDir, 'multi-file-skill', 'main.md'), '# multi', 'utf-8');

    const extracted = await skillManager.collect(async () => {});
    await skillManager.sync([]);

    expect(extracted).toContain('third-party-skill.md');
    expect(extracted).toContain('multi-file-skill');
    expect(existsSync(join(storeDir, 'third-party-skill.md'))).toBe(true);
    expect(existsSync(join(storeDir, 'multi-file-skill', 'main.md'))).toBe(true);
    expect(await skillManager.listMounted()).toHaveLength(0);
  });
});
