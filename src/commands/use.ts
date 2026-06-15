import { Command } from 'commander';
import { createLoadoutContext } from '../core/context.js';
import type { PlatformId } from '../types.js';
import { color } from '../utils/logger.js';
import { selectPreset } from '../tui.js';
import { LoadoutError, ErrorCode } from '../utils/errors.js';

export function createUseCommand(platform: PlatformId): Command {
  return new Command('use')
    .description('Switch to a preset')
    .argument('[name]', 'preset name')
    .addHelpText(
      'after',
      `
Examples:
  $ sk ${platform} use
  $ sk ${platform} use my-preset
`,
    )
    .action(async (name?: string) => {
      const ctx = createLoadoutContext(platform);

      // No name argument → launch interactive preset picker (requires TTY)
      if (!name) {
        if (!process.stdout.isTTY) {
          throw new LoadoutError(
            ErrorCode.TTY_REQUIRED,
            'TUI mode requires a terminal. Use add/rm for scripting.',
          );
        }
        name = await selectPreset(ctx);
      }

      const targetPreset = await ctx.configManager.getPreset(name);
      const currentActive = await ctx.configManager.getActive();
      await ctx.skillManager.collect((skill) => ctx.configManager.addSkill(currentActive, skill));
      await ctx.skillManager.sync(targetPreset.skills);
      await ctx.configManager.setActive(name);

      ctx.logger.success(`Switched to preset ${color.yellow(name)}`);
      console.log(`\n${color.bold(color.yellow('o  ' + name))}`);
      console.log(`   Description: ${targetPreset.description}`);
      console.log(`   Skills: ${color.bold(color.green(String(targetPreset.skills.length)))}`);
      for (const s of targetPreset.skills) {
        console.log(`    [${color.green('*')}]    ${color.green(s)}`);
      }
    });
}
