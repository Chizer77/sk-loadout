import { homedir } from 'node:os';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Preset {
  name: string;
  description: string;
  skills: string[];
}

export interface LoadoutConfig {
  currentActive: string;
  presets: Record<string, Preset>;
  home?: string;
}

export type OsPlatform = 'win32' | 'darwin' | 'linux';

export const DEFAULT_PRESET_NAME = 'base';

// ── Multi-platform support ──

export type PlatformId = 'claude' | 'opencode' | 'codex';

// ── Configurable environment variables ──

export const ENV_LOADOUT_HOME = 'SK_LOADOUT_HOME';
export const ENV_LOG_LEVEL = 'SK_LOADOUT_LOG_LEVEL';
export const ENV_PLATFORM_HOME: Record<PlatformId, string> = {
  claude: 'SK_CLAUDE_HOME',
  opencode: 'SK_OPENCODE_HOME',
  codex: 'SK_CODEX_HOME',
};

/** Per-platform env var that overrides the skills base directory. */
export const ENV_PLATFORM_SKILLS_HOME: Partial<Record<PlatformId, string>> = {
  codex: 'SK_CODEX_SKILLS_HOME',
};

export interface PlatformDef {
  id: PlatformId;
  label: string;
  homeDir: string;
  /** Base directory for skills, relative to OS home. Defaults to homeDir. */
  skillsHome?: string;
  settingsFile: string;
  settingsFormat: 'json' | 'jsonc' | 'toml';
  skillsDir: string;
  skillFormat: 'flat-md' | 'folder-skill-md';
  commandSubdir?: string;
}

export const PLATFORM_REGISTRY: Record<PlatformId, PlatformDef> = {
  claude: {
    id: 'claude',
    label: 'Claude Code',
    homeDir: '.claude',
    settingsFile: 'settings.json',
    settingsFormat: 'json',
    skillsDir: 'skills',
    skillFormat: 'flat-md',
    commandSubdir: 'commands/sk',
  },
  opencode: {
    id: 'opencode',
    label: 'OpenCode',
    homeDir: '.config/opencode',
    settingsFile: 'opencode.jsonc',
    settingsFormat: 'jsonc',
    skillsDir: 'skills',
    skillFormat: 'folder-skill-md',
  },
  codex: {
    id: 'codex',
    label: 'Codex',
    homeDir: '.codex',
    skillsHome: '.agents',
    settingsFile: 'config.toml',
    settingsFormat: 'toml',
    skillsDir: 'skills',
    skillFormat: 'folder-skill-md',
  },
};

function readPersistedHome(platform: PlatformId): string | undefined {
  try {
    const skDir = join(process.env[ENV_LOADOUT_HOME] ?? homedir(), '.sk-loadout');
    const raw = readFileSync(join(skDir, `${platform}.json`), 'utf-8');
    const config = JSON.parse(raw) as { home?: string };
    if (config.home && existsSync(config.home)) return config.home;
  } catch {
    /* no config yet */
  }
}

export function detectPlatform(customHome?: string): PlatformId | null {
  for (const [, def] of Object.entries(PLATFORM_REGISTRY)) {
    const base =
      customHome ??
      process.env[ENV_PLATFORM_HOME[def.id]] ??
      readPersistedHome(def.id) ??
      join(homedir(), def.homeDir);
    if (existsSync(join(base, def.settingsFile))) return def.id;
  }
  return null;
}
