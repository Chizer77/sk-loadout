import { vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { LoadoutContext } from '../../src/core/context.js';
import type { Paths } from '../../src/utils/paths.js';
import type { Logger } from '../../src/utils/logger.js';

export const silentLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  dryRun() {},
  success() {},
};

export function makeTestPaths(root?: string): Paths {
  const base = root ?? mkdtempSync(join(tmpdir(), 'sk-test-'));
  const platformDir = join(base, '.sk-loadout', 'claude');
  const claudeDir = join(base, '.claude');
  return {
    home: claudeDir,
    storeDir: platformDir,
    presetConfig: join(base, '.sk-loadout', 'claude.json'),
    settingsPath: join(claudeDir, 'settings.json'),
    skillsDir: join(claudeDir, 'skills'),
    settingsFormat: 'json' as const,
    skillFormat: 'flat-md' as const,
    commandsDir: join(claudeDir, 'commands', 'sk'),
  };
}

export function createMockContext(overrides: Partial<LoadoutContext> = {}): LoadoutContext {
  return {
    platform: 'claude',
    paths: makeTestPaths(),
    configManager: {
      getActive: vi.fn().mockResolvedValue('default'),
      getPreset: vi.fn().mockResolvedValue({
        name: 'default',
        description: 'test preset',
        modelConfig: { model: 'test-model', extra: {} },
        skills: ['skill-a.md'],
      }),
      listPresets: vi.fn().mockResolvedValue(['default']),
      setActive: vi.fn().mockResolvedValue(undefined),
      setPreset: vi.fn().mockResolvedValue(undefined),
      setSkills: vi.fn().mockResolvedValue(undefined),
      setModel: vi.fn().mockResolvedValue(undefined),
      addSkill: vi.fn().mockResolvedValue(undefined),
      addSkills: vi.fn().mockResolvedValue(undefined),
      removeSkill: vi.fn().mockResolvedValue(undefined),
      removeSkills: vi.fn().mockResolvedValue(undefined),
      removePreset: vi.fn().mockResolvedValue(undefined),
      init: vi.fn().mockResolvedValue(undefined),
    } as any,
    skillManager: {
      collect: vi.fn().mockResolvedValue([]),
      sync: vi.fn().mockResolvedValue(undefined),
      listStore: vi.fn().mockResolvedValue(['skill-a.md', 'skill-b.md']),
      listMounted: vi.fn().mockResolvedValue(['skill-a.md']),
      restore: vi.fn().mockResolvedValue(undefined),
    } as any,
    settingsFile: {
      read: vi.fn().mockResolvedValue({}),
      apply: vi.fn().mockResolvedValue(undefined),
      getCurrentConfig: vi.fn().mockResolvedValue({ model: 'test', extra: {} }),
    } as any,
    symlinkOps: {
      createLink: vi.fn().mockResolvedValue(undefined),
      removeLink: vi.fn().mockResolvedValue(undefined),
    } as any,
    logger: silentLogger,
    ...overrides,
  };
}
