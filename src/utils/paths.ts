import { homedir } from 'node:os';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  PLATFORM_REGISTRY,
  ENV_LOADOUT_HOME,
  ENV_PLATFORM_HOME,
  type PlatformId,
} from '../types.js';

export function getSkLoadoutDir(): string {
  return join(process.env[ENV_LOADOUT_HOME] ?? homedir(), '.sk-loadout');
}

function readPersistedHome(platform: PlatformId): string | undefined {
  try {
    const configPath = join(getSkLoadoutDir(), `${platform}.json`);
    const raw = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw) as { home?: string };
    if (config.home && existsSync(config.home)) return config.home;
  } catch {
    /* no config yet */
  }
}

function defaultPlatformHome(platform: PlatformId): string {
  return join(homedir(), PLATFORM_REGISTRY[platform].homeDir);
}

function getPlatformHomeDir(platform: PlatformId): string {
  // Resolution order: 1. env var → 2. persisted config → 3. OS default
  if (process.env[ENV_PLATFORM_HOME[platform]]) return process.env[ENV_PLATFORM_HOME[platform]]!;
  const persisted = readPersistedHome(platform);
  if (persisted) return persisted;
  return defaultPlatformHome(platform);
}

export interface Paths {
  home: string;
  storeDir: string;
  presetConfig: string;
  settingsPath: string;
  settingsFormat: 'json' | 'jsonc' | 'toml';
  skillsDir: string;
  skillFormat: 'flat-md' | 'folder-skill-md';
  commandsDir: string | undefined;
}

export function getPaths(platform: PlatformId): Paths {
  const skDir = getSkLoadoutDir();
  const def = PLATFORM_REGISTRY[platform];
  const homeDir = getPlatformHomeDir(platform);
  return {
    home: homeDir,
    storeDir: join(skDir, platform),
    presetConfig: join(skDir, `${platform}.json`),
    settingsPath: join(homeDir, def.settingsFile),
    settingsFormat: def.settingsFormat,
    skillsDir: join(homeDir, def.skillsDir),
    skillFormat: def.skillFormat,
    commandsDir: def.commandSubdir ? join(homeDir, def.commandSubdir) : undefined,
  };
}
