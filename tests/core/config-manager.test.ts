import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Paths } from '../../src/utils/paths.js';
import type { LoadoutConfig } from '../../src/types.js';
import type { ConfigManager } from '../../src/core/config-manager.js';

const testRoot = mkdtempSync(join(tmpdir(), 'sk-config-'));
const configPath = join(testRoot, '.sk-loadout', 'claude.json');

const testPaths: Paths = {
  home: join(testRoot, '.claude'),
  storeDir: join(testRoot, '.sk-loadout', 'claude'),
  skillsDir: join(testRoot, '.claude', 'skills'),
  settingsPath: join(testRoot, '.claude', 'settings.json'),
  presetConfig: configPath,
  settingsFormat: 'json',
  skillFormat: 'flat-md',
  commandsDir: join(testRoot, '.claude', 'commands', 'sk'),
};

let Manager: typeof import('../../src/core/config-manager.js').ConfigManager;
let manager: ConfigManager;

beforeAll(async () => {
  process.env.SK_LOADOUT_HOME = testRoot;
  mkdirSync(join(testRoot, '.sk-loadout'), { recursive: true });
  const mod = await import('../../src/core/config-manager.js');
  Manager = mod.ConfigManager;
});

const sampleConfig: LoadoutConfig = {
  currentActive: 'default',
  presets: {
    default: {
      name: 'default',
      description: '默认',
      modelConfig: { model: 'test-model', extra: {} },
      skills: [],
    },
  },
};

beforeEach(async () => {
  writeFileSync(configPath, JSON.stringify(sampleConfig, null, 2));
  manager = new Manager(testPaths);
  await (manager as any).load();
});

afterAll(() => {
  rmSync(testRoot, { recursive: true, force: true });
  delete process.env.SK_LOADOUT_HOME;
});

describe('ConfigManager', () => {
  it('loads config and provides active preset', async () => {
    expect(await manager.getActive()).toBe('default');
    expect(await manager.listPresets()).toContain('default');
  });

  it('init writes full config', async () => {
    const m = new Manager(testPaths);
    await m.init({
      currentActive: 'custom',
      presets: {
        custom: {
          name: 'custom',
          description: '',
          modelConfig: { model: 'x', extra: {} },
          skills: [],
        },
      },
    });
    expect(await m.getActive()).toBe('custom');
  });

  it('adds and removes skills incrementally', async () => {
    await manager.addSkill('default', 'vue-helper.md');
    expect((await manager.getPreset('default')).skills).toContain('vue-helper.md');

    await manager.removeSkill('default', 'vue-helper.md');
    expect((await manager.getPreset('default')).skills).not.toContain('vue-helper.md');
  });

  it('addSkills 批量添加并去重', async () => {
    await manager.addSkills('default', ['a.md', 'b.md', 'a.md']);
    const skills = (await manager.getPreset('default')).skills;
    expect(skills).toContain('a.md');
    expect(skills).toContain('b.md');
    expect(skills.filter((s) => s === 'a.md').length).toBe(1);
  });

  it('removeSkills 批量移除', async () => {
    await manager.addSkills('default', ['x.md', 'y.md', 'z.md']);
    await manager.removeSkills('default', ['x.md', 'z.md']);
    expect((await manager.getPreset('default')).skills).toEqual(['y.md']);
  });

  it('manages presets lifecycle', async () => {
    await manager.setPreset({
      name: 'backend',
      description: '后端',
      modelConfig: { model: 'gpt', extra: {} },
      skills: [],
    });
    expect((await manager.getPreset('backend')).description).toBe('后端');

    await manager.removePreset('backend');
    await expect(manager.getPreset('backend')).rejects.toThrow();
  });

  it('gets and sets current active', async () => {
    expect(await manager.getActive()).toBe('default');
    await manager.setPreset({
      name: 'frontend',
      description: '前端',
      modelConfig: { model: 'claude', extra: {} },
      skills: [],
    });
    await manager.setActive('frontend');
    expect(await manager.getActive()).toBe('frontend');
  });

  it('损坏的 JSON 抛出语法错误', async () => {
    writeFileSync(configPath, '{bad json}', 'utf-8');
    const m = new Manager(testPaths);
    await expect((m as any).load()).rejects.toThrow('invalid JSON');
  });

  it('不存在的配置文件抛出提示', async () => {
    rmSync(configPath);
    const m = new Manager(testPaths);
    await expect((m as any).load()).rejects.toThrow('Run sk');
  });

  it('save 后 load 返回最新数据（缓存生效）', async () => {
    const m = new Manager(testPaths);
    await m.init({
      currentActive: 'mode-x',
      presets: {
        'mode-x': {
          name: 'mode-x',
          description: 'test',
          modelConfig: { model: 'test', extra: {} },
          skills: [],
        },
      },
    });
    expect(await m.getActive()).toBe('mode-x');
  });
});
