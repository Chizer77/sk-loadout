import { Command } from 'commander';
import { createLoadoutContext } from '../core/context.js';
import type { PlatformId } from '../types.js';
import { color } from '../utils/logger.js';

export function createSaveCommand(platform: PlatformId): Command {
  return new Command('save')
    .description('Save current state as a preset')
    .argument('[name]', 'preset name (omit to update current)')
    .option('-d, --desc <text>', 'set a description for the preset')
    .addHelpText(
      'after',
      `
Examples:
  $ sk ${platform} save
  $ sk ${platform} save my-preset --desc "Vue + Tailwind setup"
`,
    )
    .action(async (name?: string, options?: { desc?: string }) => {
      const ctx = createLoadoutContext(platform);

      const [modelConfig, skills] = await Promise.all([
        ctx.settingsFile.getCurrentConfig(),
        ctx.skillManager.listMounted(),
      ]);

      // No name → update the currently active preset in-place
      if (!name) {
        const currentActive = await ctx.configManager.getActive();

        await ctx.skillManager.collect((skill) => ctx.configManager.addSkill(currentActive, skill));

        const mounted = await ctx.skillManager.listMounted();
        const preset = await ctx.configManager.getPreset(currentActive);
        const description = options?.desc ?? preset.description;

        await ctx.configManager.setPreset({
          name: currentActive,
          description,
          modelConfig,
          skills: mounted,
        });

        ctx.logger.success(`Updated preset ${color.yellow(currentActive)}`);
        console.log(`\n${color.bold(color.yellow('o  ' + currentActive))}`);
        console.log(`   Description: ${description}`);
        console.log(`   Model: ${color.magenta(modelConfig.model)}`);
        console.log(`   Skills: ${color.bold(color.green(String(mounted.length)))}`);
        for (const s of mounted) {
          console.log(`    [${color.green('*')}]    ${color.green(s)}`);
        }
        return;
      }

      // Name provided → create or overwrite a named preset
      const existing = (await ctx.configManager.hasPreset(name))
        ? await ctx.configManager.getPreset(name)
        : null;
      const description = options?.desc ?? existing?.description ?? new Date().toISOString();

      await ctx.configManager.setPreset({
        name,
        description,
        modelConfig,
        skills,
      });
      await ctx.skillManager.sync(skills);
      await ctx.settingsFile.apply(modelConfig);
      await ctx.skillManager.collect((skill) => ctx.configManager.addSkill(name, skill));
      await ctx.configManager.setActive(name);

      const action = existing ? 'Overwritten & switched to' : 'Created & switched to';
      ctx.logger.success(`${action} preset ${color.yellow(name)}`);
      console.log(`\n${color.bold(color.yellow('o  ' + name))}`);
      console.log(`   Description: ${description}`);
      console.log(`   Model: ${color.magenta(modelConfig.model)}`);
      console.log(`   Skills: ${color.bold(color.green(String(skills.length)))}`);
      for (const s of skills) {
        console.log(`    [${color.green('*')}]    ${color.green(s)}`);
      }
    });
}
