import { Command } from 'commander';
import { createLoadoutContext } from '../core/context.js';
import type { PlatformId } from '../types.js';
import { LoadoutError, ErrorCode } from '../utils/errors.js';
import { validateName } from '../utils/validation.js';
import { color } from '../utils/logger.js';
import { DEFAULT_PRESET_NAME } from '../types.js';
import { confirmAction } from '../tui.js';

export function createRmCommand(platform: PlatformId): Command {
  return new Command('rm')
    .description('Remove skills or delete a preset')
    .argument('[skills...]', 'skill names to remove')
    .option('-p, --preset <name>', 'delete a preset')
    .option('-y, --yes', 'skip confirmation prompt')
    .addHelpText(
      'after',
      `
Examples:
  $ sk ${platform} rm vue-helper.md
  $ sk ${platform} rm -p my-preset
  $ sk ${platform} rm -p my-preset --yes
`,
    )
    .action(async (skills: string[], options: { preset?: string; yes?: boolean }) => {
      const ctx = createLoadoutContext(platform);

      // -p flag → delete a preset (not a skill), requires confirmation
      if (options.preset) {
        const name = options.preset;

        if (name === DEFAULT_PRESET_NAME) {
          throw new LoadoutError(
            ErrorCode.VALIDATION_ERROR,
            `Cannot delete the default preset ${color.yellow(`"${DEFAULT_PRESET_NAME}"`)}.`,
          );
        }

        await confirmAction(`Delete preset "${color.yellow(name)}"?`, options.yes);

        const currentActive = await ctx.configManager.getActive();
        // If deleting the active preset, fall back to the default preset first
        if (currentActive === name) {
          await ctx.configManager.setActive(DEFAULT_PRESET_NAME);
          ctx.logger.success(`Switched active preset to ${color.yellow(DEFAULT_PRESET_NAME)}.`);
        }

        await ctx.configManager.removePreset(name);
        ctx.logger.success(`Deleted preset ${color.yellow(name)}.`);
        return;
      }

      if (skills.length === 0) {
        throw new LoadoutError(
          ErrorCode.VALIDATION_ERROR,
          'Specify skills to remove, or use "sk skill" for interactive mode.',
        );
      }

      const currentActive = await ctx.configManager.getActive();

      await ctx.skillManager.collect((skill) => ctx.configManager.addSkill(currentActive, skill));

      for (const skill of skills) {
        validateName(skill, 'skill');
      }

      const mounted = new Set(await ctx.skillManager.listMounted());
      const toRemove = skills.filter((s) => mounted.has(s));
      const notMounted = skills.filter((s) => !mounted.has(s));

      if (notMounted.length > 0) {
        ctx.logger.warn(
          `Some skills are not in the current preset, skipping: ${notMounted.map((s) => color.green(s)).join(', ')}.`,
        );
      }

      if (toRemove.length === 0) {
        ctx.logger.success('No skills to remove.');
        return;
      }

      for (const skill of toRemove) {
        await ctx.symlinkOps.removeLink(skill);
      }
      await ctx.configManager.removeSkills(currentActive, toRemove);

      ctx.logger.success(
        `Removed ${color.bold(color.green(String(toRemove.length)))} skill(s) from preset ${color.yellow(currentActive)}: ${toRemove.map((s) => color.green(s)).join(', ')}.`,
      );
    });
}
