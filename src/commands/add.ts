import { Command } from 'commander';
import { createLoadoutContext } from '../core/context.js';
import type { PlatformId } from '../types.js';
import { LoadoutError, ErrorCode } from '../utils/errors.js';
import { validateName } from '../utils/validation.js';
import { color } from '../utils/logger.js';

export function createAddCommand(platform: PlatformId): Command {
  return new Command('add')
    .description('Add skills to the current preset')
    .argument('<skills...>', 'skill names to add')
    .addHelpText(
      'after',
      `
Examples:
  $ sk ${platform} add vue-helper.md
  $ sk ${platform} add skill-a skill-b
`,
    )
    .action(async (skills: string[]) => {
      const ctx = createLoadoutContext(platform);

      const currentActive = await ctx.configManager.getActive();
      await ctx.skillManager.collect((skill) => ctx.configManager.addSkill(currentActive, skill));
      const entries = await ctx.skillManager.listStore();

      // Validate all skills exist in store before making any changes
      for (const skill of skills) {
        validateName(skill, 'skill');
        if (!entries.includes(skill)) {
          throw new LoadoutError(
            ErrorCode.SKILL_NOT_FOUND,
            `Skill "${color.green(skill)}" not found in store.`,
          );
        }
      }

      for (const skill of skills) {
        await ctx.symlinkOps.createLink(skill);
        await ctx.configManager.addSkill(currentActive, skill);
      }

      ctx.logger.success(
        `Added ${color.bold(color.green(String(skills.length)))} skill(s) to preset ${color.yellow(currentActive)}: ${color.green(skills.join(', '))}.`,
      );
    });
}
