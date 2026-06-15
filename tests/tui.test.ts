import { describe, it, expect, vi } from 'vitest';
import type { LoadoutContext } from '../src/core/context.js';
import { silentLogger } from './commands/helpers.js';
import { LoadoutError } from '../src/utils/errors.js';

const cancelSymbol = Symbol.for('clack:cancel');

let multiselectResult: unknown = [];
let selectResult: unknown = 'preset-a';

vi.mock('@clack/prompts', () => ({
  select: vi.fn().mockImplementation(() => selectResult),
  multiselect: vi.fn().mockImplementation(() => multiselectResult),
  isCancel: (v: unknown) => v === cancelSymbol,
}));

// Minimal LoadoutContext stub — all tests inject specific mocks as needed
const base = {
  platform: 'claude' as const,
  paths: {} as any,
  symlinkOps: {} as any,
  logger: silentLogger,
};

describe('manageSkills', () => {
  it('returns selected skills list', async () => {
    multiselectResult = ['skill-a.md', 'skill-c.md'];

    const { manageSkills } = await import('../src/tui.js');

    const ctx: LoadoutContext = {
      ...base,
      configManager: {} as any,
      skillManager: {
        listStore: vi.fn().mockResolvedValue(['skill-a.md', 'skill-b.md', 'skill-c.md']),
        listMounted: vi.fn().mockResolvedValue(['skill-a.md']),
      } as any,
    };

    const result = await manageSkills(ctx);
    expect(result).toEqual(['skill-a.md', 'skill-c.md']);
  });

  it('throws when store is empty', async () => {
    multiselectResult = [];

    const { manageSkills } = await import('../src/tui.js');

    const ctx: LoadoutContext = {
      ...base,
      configManager: {} as any,
      skillManager: {
        listStore: vi.fn().mockResolvedValue([]),
        listMounted: vi.fn().mockResolvedValue([]),
      } as any,
    };

    await expect(manageSkills(ctx)).rejects.toThrow(LoadoutError);
  });

  it('throws Cancelled error on cancel', async () => {
    multiselectResult = cancelSymbol;

    const { manageSkills } = await import('../src/tui.js');

    const ctx: LoadoutContext = {
      ...base,
      configManager: {} as any,
      skillManager: {
        listStore: vi.fn().mockResolvedValue(['skill-a.md']),
        listMounted: vi.fn().mockResolvedValue([]),
      } as any,
    };

    await expect(manageSkills(ctx)).rejects.toThrow('Cancelled');
  });
});

describe('selectPreset', () => {
  it('returns the selected preset name', async () => {
    selectResult = 'frontend';

    const { selectPreset } = await import('../src/tui.js');

    const ctx: LoadoutContext = {
      ...base,
      configManager: {
        listPresets: vi.fn().mockResolvedValue(['frontend', 'backend']),
        getPreset: vi.fn().mockImplementation((name: string) =>
          Promise.resolve({
            name,
            description: `${name} preset`,
            skills: [],
          }),
        ),
      } as any,
      skillManager: {} as any,
    };

    const result = await selectPreset(ctx);
    expect(result).toBe('frontend');
  });

  it('excludes default preset when excludeDefault is true', async () => {
    selectResult = 'custom';

    const { selectPreset } = await import('../src/tui.js');

    const ctx: LoadoutContext = {
      ...base,
      configManager: {
        listPresets: vi.fn().mockResolvedValue(['base', 'custom']),
        getPreset: vi.fn().mockImplementation((name: string) =>
          Promise.resolve({
            name,
            description: `${name} preset`,
            skills: [],
          }),
        ),
      } as any,
      skillManager: {} as any,
    };

    const result = await selectPreset(ctx, true);
    expect(result).toBe('custom');
  });

  it('throws when no presets are available', async () => {
    const { selectPreset } = await import('../src/tui.js');

    const ctx: LoadoutContext = {
      ...base,
      configManager: {
        listPresets: vi.fn().mockResolvedValue([]),
      } as any,
      skillManager: {} as any,
    };

    await expect(selectPreset(ctx)).rejects.toThrow('No presets available');
  });

  it('throws Cancelled error on cancel', async () => {
    selectResult = cancelSymbol;

    const { selectPreset } = await import('../src/tui.js');

    const ctx: LoadoutContext = {
      ...base,
      configManager: {
        listPresets: vi.fn().mockResolvedValue(['preset-a']),
        getPreset: vi.fn().mockResolvedValue({
          name: 'preset-a',
          description: 'a',
          skills: [],
        }),
      } as any,
      skillManager: {} as any,
    };

    await expect(selectPreset(ctx)).rejects.toThrow('Cancelled');
  });
});
