import { readFile } from 'node:fs/promises';

import type { LoadoutConfig, Preset } from '../types.js';
import { DEFAULT_PRESET_NAME } from '../types.js';
import type { Paths } from '../utils/paths.js';
import { safeWrite } from '../utils/fs.js';
import { LoadoutError, ErrorCode, isErrCode } from '../utils/errors.js';
import { acquireLock, releaseLock } from '../utils/lock.js';
import { validateName } from '../utils/validation.js';
import { color } from '../utils/logger.js';

function validate(raw: unknown): LoadoutConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new LoadoutError(
      ErrorCode.CONFIG_CORRUPT,
      'Invalid config format: expected a JSON object.',
    );
  }
  const cfg = raw as Record<string, unknown>;
  if (typeof cfg.currentActive !== 'string' || !cfg.currentActive) {
    throw new LoadoutError(
      ErrorCode.CONFIG_CORRUPT,
      'Config missing required field: currentActive.',
    );
  }
  if (!cfg.presets || typeof cfg.presets !== 'object' || Array.isArray(cfg.presets)) {
    throw new LoadoutError(ErrorCode.CONFIG_CORRUPT, 'Config missing required field: presets.');
  }
  return raw as LoadoutConfig;
}

export class ConfigManager {
  private cached: LoadoutConfig | null = null;
  private readonly paths: Paths;

  constructor(paths: Paths) {
    this.paths = paths;
  }

  private hydratePresetNames(config: LoadoutConfig): void {
    for (const key of Object.keys(config.presets)) {
      const preset = config.presets[key];
      if (preset) preset.name = key;
    }
  }

  async init(config: LoadoutConfig): Promise<void> {
    this.cached = config;
    this.hydratePresetNames(config);
    await this.save(config);
  }

  private async load(): Promise<LoadoutConfig> {
    if (this.cached) return this.cached;
    try {
      const raw = await readFile(this.paths.presetConfig, 'utf-8');
      const config = validate(JSON.parse(raw));
      this.hydratePresetNames(config);
      this.cached = config;
      return this.cached;
    } catch (err: unknown) {
      if (err instanceof LoadoutError) throw err;
      if (err instanceof SyntaxError) {
        throw new LoadoutError(ErrorCode.CONFIG_CORRUPT, 'Config corrupted: invalid JSON syntax.');
      }
      if (isErrCode(err, 'ENOENT')) {
        throw new LoadoutError(
          ErrorCode.CONFIG_MISSING,
          'Config not found. Run sk <platform> init first.',
        );
      }
      throw err;
    }
  }

  // Writes config via safeWrite under a file lock. Strips the `name` field from
  // presets before saving — it is derived from the map key, not stored on disk.
  private async save(config: LoadoutConfig): Promise<void> {
    const cleanPresets: Record<string, unknown> = {};
    for (const [key, p] of Object.entries(config.presets)) {
      const { name: _, ...rest } = p;
      cleanPresets[key] = rest;
    }
    const clean: Record<string, unknown> = {
      currentActive: config.currentActive,
      presets: cleanPresets,
      home: config.home,
    };

    await acquireLock(this.paths.storeDir);
    try {
      await safeWrite(this.paths.presetConfig, JSON.stringify(clean, null, 2));
      this.cached = config;
    } finally {
      await releaseLock();
    }
  }

  private requirePreset(config: LoadoutConfig, presetName: string): Preset {
    if (config.presets[presetName]) return config.presets[presetName];
    const lower = presetName.toLowerCase();
    const key = Object.keys(config.presets).find((k) => k.toLowerCase().includes(lower));
    if (key) {
      throw new LoadoutError(
        ErrorCode.PRESET_NOT_FOUND,
        `Preset "${color.yellow(presetName)}" not found. Did you mean "${color.yellow(key)}"?`,
      );
    }
    throw new LoadoutError(
      ErrorCode.PRESET_NOT_FOUND,
      `Preset "${color.yellow(presetName)}" not found.`,
    );
  }

  async addSkill(presetName: string, skill: string): Promise<void> {
    return this.addSkills(presetName, [skill]);
  }

  async removeSkill(presetName: string, skillFilename: string): Promise<void> {
    return this.removeSkills(presetName, [skillFilename]);
  }

  async getActive(): Promise<string> {
    const config = await this.load();
    const name = config.currentActive;
    if (!config.presets[name]) {
      throw new LoadoutError(
        ErrorCode.PRESET_NOT_FOUND,
        `Active preset "${color.yellow(name)}" not found.`,
      );
    }
    return name;
  }

  async setActive(name: string): Promise<void> {
    validateName(name, 'preset');
    const config = await this.load();
    this.requirePreset(config, name);
    config.currentActive = name;
    await this.save(config);
  }

  async hasPreset(name: string): Promise<boolean> {
    const config = await this.load();
    return Object.keys(config.presets).some((k) => k === name);
  }

  async getPreset(name: string): Promise<Preset> {
    const config = await this.load();
    return this.requirePreset(config, name);
  }

  async setPreset(preset: Preset): Promise<void> {
    validateName(preset.name, 'preset');
    const config = await this.load();
    config.presets[preset.name] = preset;
    await this.save(config);
  }

  async removePreset(name: string): Promise<void> {
    validateName(name, 'preset');
    if (name === DEFAULT_PRESET_NAME) {
      throw new LoadoutError(
        ErrorCode.VALIDATION_ERROR,
        `Cannot delete the default preset "${color.yellow(DEFAULT_PRESET_NAME)}".`,
      );
    }
    const config = await this.load();
    this.requirePreset(config, name);
    config.presets = Object.fromEntries(Object.entries(config.presets).filter(([k]) => k !== name));
    await this.save(config);
  }

  async listPresets(): Promise<string[]> {
    const config = await this.load();
    return Object.keys(config.presets);
  }

  async addSkills(presetName: string, skills: string[]): Promise<void> {
    validateName(presetName, 'preset');
    const config = await this.load();
    const preset = this.requirePreset(config, presetName);
    preset.skills = [...new Set([...preset.skills, ...skills])];
    await this.save(config);
  }

  async removeSkills(presetName: string, skills: string[]): Promise<void> {
    validateName(presetName, 'preset');
    const config = await this.load();
    const preset = this.requirePreset(config, presetName);
    const removeSet = new Set(skills);
    preset.skills = preset.skills.filter((s) => !removeSet.has(s));
    await this.save(config);
  }

  async setPlatformHome(home: string): Promise<void> {
    const config = await this.load();
    config.home = home;
    await this.save(config);
  }

  async setSkills(presetName: string, skills: string[]): Promise<void> {
    validateName(presetName, 'preset');
    const config = await this.load();
    const preset = this.requirePreset(config, presetName);
    preset.skills = [...skills];
    await this.save(config);
  }
}
