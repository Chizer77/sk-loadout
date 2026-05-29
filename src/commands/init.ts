import { Command } from 'commander';
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import figlet from 'figlet';
import gradient from 'gradient-string';

import { createLoadoutContext } from '../core/context.js';
import type { PlatformId } from '../types.js';
import { DEFAULT_PRESET_NAME, ENV_PLATFORM_HOME } from '../types.js';
import { color } from '../utils/logger.js';
import { pathExists, copyRecursive } from '../utils/fs.js';
import type { LoadoutConfig } from '../types.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export function createInitCommand(platform: PlatformId): Command {
  const envHome = ENV_PLATFORM_HOME[platform];
  return new Command('init')
    .description('Initialize or rebuild the sk-loadout environment')
    .option(
      '--home <path>',
      `custom ${platform} config directory (or set ${envHome} env var). Also accepts --home=<path>`,
    )
    .option('--dry-run', 'Preview what init would do without making changes')
    .addHelpText(
      'after',
      `
Examples:
  $ sk ${platform} init
  $ sk ${platform} init --home /custom/path/to/${platform}
  $ sk ${platform} init --home=/custom/path
  $ sk ${platform} init --dry-run
  $ ${envHome}=/custom/path/to/${platform} sk ${platform} init

Platform config directory (highest to lowest priority):
  1. --home flag (or --home=<path>)
  2. ${envHome} environment variable
  3. Persisted home from a previous init
  4. OS home directory (default)
`,
    )
    .action(async (options: { home?: string; dryRun?: boolean }) => {
      if (options.home) process.env[envHome] = options.home;
      const dry = options.dryRun ?? false;

      const banner = figlet.textSync('sk-lout', { font: 'ANSI Shadow' });
      const earth = gradient(['#c4956a', '#8b7355', '#6b8c42', '#5a8a4a']);
      console.log('\n');
      console.log(earth.multiline(banner));

      const ctx = createLoadoutContext(platform);

      // Re-init: config already exists, rebuild environment from existing state
      if (await pathExists(ctx.paths.presetConfig)) {
        if (options.home) await ctx.configManager.setPlatformHome(ctx.paths.home);
        const activePresetName = await ctx.configManager.getActive();
        const collected = await ctx.skillManager.collect((skill) =>
          ctx.configManager.addSkill(activePresetName, skill),
        );
        const preset = await ctx.configManager.getPreset(activePresetName);

        if (dry) {
          ctx.logger.dryRun(
            `Would rebuild from existing config at "${color.dim(ctx.paths.presetConfig)}".`,
          );
          if (!(await pathExists(ctx.paths.storeDir)))
            ctx.logger.dryRun(`Would create store at "${color.dim(ctx.paths.storeDir)}".`);
          if (!(await pathExists(ctx.paths.skillsDir)))
            ctx.logger.dryRun(`Would create skills dir at "${color.dim(ctx.paths.skillsDir)}".`);
          if (collected.length > 0)
            ctx.logger.dryRun(
              `Would adopt ${color.bold(color.green(String(collected.length)))} new skill(s): ${collected.map((s) => color.green(s)).join(', ')}.`,
            );
          ctx.logger.dryRun(
            `Would sync ${preset.skills.length} skill(s) for preset "${color.yellow(activePresetName)}".`,
          );
          ctx.logger.dryRun(`Would apply model "${color.magenta(preset.modelConfig.model)}".`);
          if (ctx.paths.commandsDir)
            ctx.logger.dryRun(`Would generate commands in "${color.dim(ctx.paths.commandsDir)}".`);
          else ctx.logger.dryRun(`Would generate commands in "${color.dim(ctx.paths.skillsDir)}".`);
          return;
        }

        await mkdir(ctx.paths.storeDir, { recursive: true });
        await mkdir(ctx.paths.skillsDir, { recursive: true });
        await ctx.skillManager.sync(preset.skills);
        await ctx.settingsFile.apply(preset.modelConfig);
        await ctx.configManager.setActive(preset.name);
        await generateCommandFiles(ctx);

        ctx.logger.success('sk-loadout rebuilt!');
        console.log(`\n  ${color.bold('Quick start:')}`);
        console.log(`    sk ${platform} ls              Show current state`);
        console.log(`    sk ${platform} use             Switch presets interactively`);
        console.log(`    sk ${platform} save <name>     Save current setup as a preset`);
        console.log(`    sk ${platform} skill           Manage skills for the current preset\n`);
        return;
      }

      // Fresh init: create default config from current platform settings
      const settingsExist = await pathExists(ctx.paths.settingsPath);
      if (!settingsExist) {
        ctx.logger.warn(`Platform settings not found at "${color.dim(ctx.paths.settingsPath)}".`);
        ctx.logger.warn(`Make sure ${platform} is installed.`);
        return;
      }
      const modelConfig = await ctx.settingsFile.getCurrentConfig();

      if (dry) {
        ctx.logger.dryRun(`Would create store at "${color.dim(ctx.paths.storeDir)}".`);
        ctx.logger.dryRun(`Would create skills dir at "${color.dim(ctx.paths.skillsDir)}".`);
        ctx.logger.dryRun(
          `Would create default preset "${color.yellow(DEFAULT_PRESET_NAME)}" with model "${color.magenta(modelConfig.model || '(none)')}".`,
        );
        ctx.logger.dryRun(`Would write config to "${color.dim(ctx.paths.presetConfig)}".`);
        if (ctx.paths.commandsDir)
          ctx.logger.dryRun(`Would generate commands in "${color.dim(ctx.paths.commandsDir)}".`);
        else ctx.logger.dryRun(`Would generate commands in "${color.dim(ctx.paths.skillsDir)}".`);
        return;
      }

      await mkdir(ctx.paths.storeDir, { recursive: true });
      await mkdir(ctx.paths.skillsDir, { recursive: true });

      const storeFiles = await readdir(ctx.paths.storeDir).catch(() => [] as string[]);
      if (storeFiles.some((f) => !f.startsWith('.'))) {
        ctx.logger.warn(
          `Orphaned files in "${color.dim(ctx.paths.storeDir)}" detected, but no config found.`,
        );
        ctx.logger.warn(
          `To clean up, manually delete "${color.dim(ctx.paths.storeDir)}" if needed.`,
        );
      }

      const defaultConfig: LoadoutConfig = {
        currentActive: DEFAULT_PRESET_NAME,
        home: ctx.paths.home,
        presets: {
          [DEFAULT_PRESET_NAME]: {
            name: DEFAULT_PRESET_NAME,
            description: `Default preset created by sk ${platform} init.`,
            modelConfig,
            skills: [],
          },
        },
      };
      await ctx.configManager.init(defaultConfig);
      await ctx.skillManager.collect((skill) =>
        ctx.configManager.addSkill(DEFAULT_PRESET_NAME, skill),
      );
      await ctx.configManager.setActive(DEFAULT_PRESET_NAME);
      await generateCommandFiles(ctx);

      ctx.logger.success('sk-loadout init!');
      console.log(`\n  ${color.bold('Quick start:')}`);
      console.log(`    sk ${platform} ls              Show current state`);
      console.log(`    sk ${platform} use             Switch presets`);
      console.log(`    sk ${platform} save <name>     Save current setup as a preset`);
      console.log(`    sk ${platform} skill           Manage skills for the current preset\n`);
    });
}

// Copy platform-specific slash-command templates into the target directory.
// Records generated names in .sk-own so collect() skips them.
async function generateCommandFiles(ctx: ReturnType<typeof createLoadoutContext>): Promise<void> {
  const srcDir = join(__dirname, '..', 'templates', ctx.platform);
  const dstDir = ctx.paths.commandsDir ?? ctx.paths.skillsDir;

  await mkdir(dstDir, { recursive: true });
  await copyRecursive(srcDir, dstDir);

  // Record generated names in .sk-own so collect() and restore() can find them
  const names: string[] = [];
  const entries = await readdir(dstDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      names.push(entry.name);
    }
  }
  await writeFile(join(ctx.paths.storeDir, '.sk-own'), names.join('\n'), 'utf-8');
}
