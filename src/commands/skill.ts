import { Command } from 'commander';
import { createLoadoutContext } from '../core/context.js';
import type { PlatformId } from '../types.js';
import { color } from '../utils/logger.js';
import { LoadoutError, ErrorCode } from '../utils/errors.js';
import { manageSkills } from '../tui.js';

export function createSkillCommand(platform: PlatformId): Command {
  return new Command('skill')
    .alias('sk')
    .description('Manage skills interactively')
    .addHelpText(
      'after',
      `
Examples:
  $ sk ${platform} skill
`,
    )
    .action(async () => {
      const ctx = createLoadoutContext(platform);

      const currentActive = await ctx.configManager.getActive();
      console.log(`\nPreset: ${color.yellow(currentActive)}`);

      await ctx.skillManager.collect((skill) => ctx.configManager.addSkill(currentActive, skill));

      if (!process.stdout.isTTY) {
        throw new LoadoutError(
          ErrorCode.TTY_REQUIRED,
          'TUI mode requires a terminal. Use add/rm for scripting.',
        );
      }

      const selected = await manageSkills(ctx);

      await ctx.skillManager.sync(selected);
      await ctx.configManager.setSkills(currentActive, selected);

      ctx.logger.success(
        `Skills updated for preset ${color.yellow(currentActive)} (${color.bold(color.green(String(selected.length)))} mounted)`,
      );
    });
}
