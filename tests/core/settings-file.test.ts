import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { SettingsFile } from '../../src/core/settings-file.js';
import type { Paths } from '../../src/utils/paths.js';
import type { Logger } from '../../src/utils/logger.js';

const testRoot = mkdtempSync(join(tmpdir(), 'sk-settings-'));

const silentLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  dryRun() {},
  success() {},
};

function makePaths(platform: string): Paths {
  const base = join(testRoot, platform);
  mkdirSync(base, { recursive: true });
  const settingsFile =
    platform === 'opencode'
      ? 'opencode.jsonc'
      : platform === 'codex'
        ? 'config.toml'
        : 'settings.json';
  const format =
    platform === 'opencode'
      ? ('jsonc' as const)
      : platform === 'codex'
        ? ('toml' as const)
        : ('json' as const);
  return {
    storeDir: join(testRoot, '.sk-loadout', platform),
    skillsDir: join(base, 'skills'),
    settingsPath: join(base, settingsFile),
    presetConfig: join(testRoot, '.sk-loadout', `${platform}.json`),
    settingsFormat: format,
    skillFormat: 'flat-md',
    commandsDir: join(base, 'commands', 'sk'),
    home: base,
  };
}

beforeAll(() => {
  process.env.SK_LOADOUT_HOME = testRoot;
  mkdirSync(testRoot, { recursive: true });
});

afterAll(() => {
  rmSync(testRoot, { recursive: true, force: true });
  delete process.env.SK_LOADOUT_HOME;
});

// ── Claude Code (JSON) ──

describe('SettingsFile — Claude Code', () => {
  let file: SettingsFile;
  const paths = makePaths('claude');

  beforeAll(async () => {
    const mod = await import('../../src/core/settings-file.js');
    file = new mod.SettingsFile(paths, 'claude', silentLogger);
  });

  beforeEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
    mkdirSync(join(paths.home), { recursive: true });
    writeFileSync(
      paths.settingsPath,
      JSON.stringify({
        model: 'original-model',
        env: { ANTHROPIC_BASE_URL: 'https://old.api.com' },
        permissions: { allow: ['read'] },
      }),
    );
  });

  it('reads model and env from settings', async () => {
    const settings = await file.read();
    expect(settings.model).toBe('original-model');
  });

  it('returns empty object when settings file is missing', async () => {
    rmSync(paths.settingsPath);
    const settings = await file.read();
    expect(settings).toEqual({});
  });

  it('applies model config with deep merge of env', async () => {
    await file.apply({
      model: 'new-model',
      extra: { ANTHROPIC_BASE_URL: 'https://new.api.com', ANTHROPIC_MODEL: 'x' },
    });

    const result = await file.read();
    expect(result.model).toBe('new-model');
    const env = result.env as Record<string, string>;
    expect(env.ANTHROPIC_BASE_URL).toBe('https://new.api.com');
    expect(env.ANTHROPIC_MODEL).toBe('x');
  });

  it('preserves existing env keys not in override', async () => {
    await file.apply({ model: 'm', extra: { NEW_KEY: 'value' } });
    const result = await file.read();
    const env = result.env as Record<string, string>;
    expect(env.ANTHROPIC_BASE_URL).toBe('https://old.api.com');
    expect(env.NEW_KEY).toBe('value');
  });

  it('extracts current model config', async () => {
    const config = await file.getCurrentConfig();
    expect(config.model).toBe('original-model');
    expect(config.extra.ANTHROPIC_BASE_URL).toBe('https://old.api.com');
  });
});

// ── OpenCode (JSONC) ──

describe('SettingsFile — OpenCode', () => {
  let file: SettingsFile;
  const paths = makePaths('opencode');

  beforeAll(async () => {
    const mod = await import('../../src/core/settings-file.js');
    file = new mod.SettingsFile(paths, 'opencode', silentLogger);
  });

  beforeEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
    mkdirSync(join(paths.home), { recursive: true });
    writeFileSync(
      paths.settingsPath,
      JSON.stringify({
        model: 'gpt-4',
        provider: {
          openai: {
            name: 'OpenAI',
            options: {
              baseURL: 'https://api.openai.com/v1',
              apiKey: 'sk-xxx',
            },
          },
        },
      }),
    );
  });

  it('reads model and provider options from JSONC settings', async () => {
    const settings = await file.read();
    expect(settings.model).toBe('gpt-4');
    const provider = settings.provider as Record<string, Record<string, unknown>>;
    expect(provider.openai!.options).toBeDefined();
  });

  it('applies model config mapping extra keys to provider options', async () => {
    await file.apply({
      model: 'gpt-5',
      extra: { OPENAI_BASE_URL: 'https://new.openai.com', OPENAI_API_KEY: 'new-key' },
    });

    const result = await file.read();
    expect(result.model).toBe('gpt-5');
    const provider = result.provider as Record<string, Record<string, unknown>>;
    const opts = provider.openai!.options as Record<string, unknown>;
    expect(opts.baseURL).toBe('https://new.openai.com');
    expect(opts.apiKey).toBe('new-key');
  });

  it('getCurrentConfig reads model and extracts provider fields', async () => {
    const config = await file.getCurrentConfig();
    expect(config.model).toBe('gpt-4');
    expect(config.extra.baseURL).toBe('https://api.openai.com/v1');
    expect(config.extra.apiKey).toBe('sk-xxx');
  });

  it('handles settings without a provider block', async () => {
    writeFileSync(paths.settingsPath, JSON.stringify({ model: 'local-model' }));
    await file.apply({ model: 'updated', extra: { KEY: 'val' } });
    // Should not throw — extra keys are ignored when no provider exists
    const result = await file.read();
    expect(result.model).toBe('updated');
  });
});

// ── Codex (TOML) ──

describe('SettingsFile — Codex', () => {
  let file: SettingsFile;
  const paths = makePaths('codex');

  beforeAll(async () => {
    const mod = await import('../../src/core/settings-file.js');
    file = new mod.SettingsFile(paths, 'codex', silentLogger);
  });

  beforeEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
    mkdirSync(join(paths.home), { recursive: true });
    writeFileSync(
      paths.settingsPath,
      `model = "claude-sonnet"\n\n[model_providers.openai]\nname = "OpenAI"\nbase_url = "https://api.openai.com"\nenv_key = "OPENAI_API_KEY"\n`,
    );
  });

  it('reads model from TOML settings', async () => {
    const settings = await file.read();
    expect(settings.model).toBe('claude-sonnet');
    const providers = settings.model_providers as Record<string, Record<string, unknown>>;
    expect(providers.openai).toBeDefined();
  });

  it('applies model config to TOML model_providers', async () => {
    await file.apply({
      model: 'gpt-5',
      extra: { OPENAI_BASE_URL: 'https://new.api.com', OPENAI_API_KEY: 'sk-new' },
    });

    const result = await file.read();
    expect(result.model).toBe('gpt-5');
    const providers = result.model_providers as Record<string, Record<string, unknown>>;
    expect(providers.openai!.base_url).toBe('https://new.api.com');
    expect(providers.openai!.env_key).toBe('OPENAI_API_KEY');
  });

  it('getCurrentConfig reads model from TOML', async () => {
    const config = await file.getCurrentConfig();
    expect(config.model).toBe('claude-sonnet');
    expect(config.extra.base_url).toBe('https://api.openai.com');
    expect(config.extra.env_key).toBe('OPENAI_API_KEY');
  });

  it('round-trips TOML settings', async () => {
    await file.apply({ model: 'updated', extra: {} });

    const result = await file.read();
    expect(result.model).toBe('updated');
    // Re-read from disk to verify TOML format
    const raw = readFileSync(paths.settingsPath, 'utf-8');
    expect(raw).toContain('updated');
  });
});
