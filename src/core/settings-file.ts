import { readFile } from 'node:fs/promises';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { parse as parseJsonc } from 'jsonc-parser';

import type { ModelConfig, PlatformId } from '../types.js';
import type { Paths } from '../utils/paths.js';
import { safeWrite } from '../utils/fs.js';
import { LoadoutError, ErrorCode, isErrCode } from '../utils/errors.js';
import { color, type Logger } from '../utils/logger.js';

// ── Platform config readers/writers ──
// Each platform stores model config differently:
//   Claude → settings.model + settings.env
//   OpenCode → settings.model + settings.provider.<name>.options
//   Codex → settings.model + settings.model_providers.<name>

function applyClaude(settings: Record<string, unknown>, config: ModelConfig): void {
  settings.model = config.model;
  const existing = settings.env;
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  settings.env = { ...base, ...config.extra };
}

function readClaude(settings: Record<string, unknown>): ModelConfig {
  const env = settings.env;
  const extra =
    env && typeof env === 'object' && !Array.isArray(env) ? (env as Record<string, string>) : {};
  return { model: (settings.model as string) || '', extra };
}

function applyOpenCode(settings: Record<string, unknown>, config: ModelConfig): void {
  settings.model = config.model;
  if (Object.keys(config.extra).length === 0) return;
  const provider = settings.provider as Record<string, Record<string, unknown>> | undefined;
  if (!provider) return;
  const key = Object.keys(provider)[0];
  if (!key) return;
  const p = provider[key]!;
  const opts = p.options;
  const options: Record<string, unknown> =
    opts && typeof opts === 'object' && !Array.isArray(opts)
      ? (opts as Record<string, unknown>)
      : {};
  // Map generic extra keys to OpenCode provider option names
  for (const [k, v] of Object.entries(config.extra as Record<string, unknown>)) {
    if (k.includes('BASE_URL') || k.includes('ENDPOINT')) options.baseURL = v;
    else if (k.includes('API_KEY') || k.includes('AUTH_TOKEN')) options.apiKey = v;
  }
  p.options = options;
}

function readOpenCode(settings: Record<string, unknown>): ModelConfig {
  const extra: Record<string, string> = {};
  const provider = settings.provider as Record<string, Record<string, unknown>> | undefined;
  if (provider) {
    const key = Object.keys(provider)[0];
    if (key) {
      const opts = provider[key]!.options as Record<string, unknown> | undefined;
      if (opts) {
        if (typeof opts.baseURL === 'string') extra.baseURL = opts.baseURL;
        if (typeof opts.apiKey === 'string') extra.apiKey = opts.apiKey;
      }
    }
  }
  return { model: (settings.model as string) || '', extra };
}

function applyCodex(settings: Record<string, unknown>, config: ModelConfig): void {
  settings.model = config.model;
  if (Object.keys(config.extra).length === 0) return;
  const providers = settings.model_providers as Record<string, Record<string, unknown>> | undefined;
  if (!providers) return;
  const key = Object.keys(providers)[0];
  if (!key) return;
  const p = providers[key]!;
  // Map generic extra keys to Codex provider config fields
  for (const [k, v] of Object.entries(config.extra as Record<string, unknown>)) {
    if (k.includes('BASE_URL') || k.includes('ENDPOINT')) p.base_url = v;
    else if (k.includes('API_KEY') || k.includes('AUTH_TOKEN')) p.env_key = k;
  }
}

function readCodex(settings: Record<string, unknown>): ModelConfig {
  const extra: Record<string, string> = {};
  const providers = settings.model_providers as Record<string, Record<string, unknown>> | undefined;
  if (providers) {
    const key = Object.keys(providers)[0];
    if (key) {
      const p = providers[key]!;
      if (typeof p.base_url === 'string') extra.base_url = p.base_url;
      if (typeof p.env_key === 'string') extra.env_key = p.env_key;
    }
  }
  return { model: (settings.model as string) || '', extra };
}

type ConfigWriter = (settings: Record<string, unknown>, config: ModelConfig) => void;
type ConfigReader = (settings: Record<string, unknown>) => ModelConfig;

const APPLIERS: Record<PlatformId, ConfigWriter> = {
  claude: applyClaude,
  opencode: applyOpenCode,
  codex: applyCodex,
};

const READERS: Record<PlatformId, ConfigReader> = {
  claude: readClaude,
  opencode: readOpenCode,
  codex: readCodex,
};

// ── SettingsFile ──

export class SettingsFile {
  private readonly paths: Paths;
  private readonly platformId: PlatformId;
  private readonly logger: Logger;

  constructor(paths: Paths, platformId: PlatformId, logger: Logger) {
    this.paths = paths;
    this.platformId = platformId;
    this.logger = logger;
  }

  private parse(raw: string): Record<string, unknown> {
    if (this.paths.settingsFormat === 'toml') return parseToml(raw);
    if (this.paths.settingsFormat === 'jsonc') return parseJsonc(raw) as Record<string, unknown>;
    return JSON.parse(raw) as Record<string, unknown>;
  }

  private stringify(data: Record<string, unknown>): string {
    if (this.paths.settingsFormat === 'toml') {
      return stringifyToml(data);
    }
    return JSON.stringify(data, null, 2);
  }

  async read(): Promise<Record<string, unknown>> {
    try {
      const raw = await readFile(this.paths.settingsPath, 'utf-8');
      return this.parse(raw);
    } catch (err: unknown) {
      if (isErrCode(err, 'ENOENT')) {
        return {};
      }
      this.logger.warn(
        `"${color.dim(this.paths.settingsPath)}" parse failed: ${err instanceof Error ? err.message : String(err)}.`,
      );
      throw new LoadoutError(
        ErrorCode.CONFIG_CORRUPT,
        `"${color.dim(this.paths.settingsPath)}" is malformed. Fix it manually and retry.`,
      );
    }
  }

  async apply(modelConfig: ModelConfig): Promise<void> {
    const settings = await this.read();
    APPLIERS[this.platformId](settings, modelConfig);
    await safeWrite(this.paths.settingsPath, this.stringify(settings));
    this.logger.debug(
      `wrote "${color.dim(this.paths.settingsPath)}": model="${color.magenta(modelConfig.model)}".`,
    );
  }

  async getCurrentConfig(): Promise<ModelConfig> {
    const settings = await this.read();
    return READERS[this.platformId](settings);
  }
}
