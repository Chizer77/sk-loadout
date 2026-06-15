import { Command } from 'commander';
import { createLoadoutContext } from '../core/context.js';
import type { PlatformId } from '../types.js';
import { color } from '../utils/logger.js';

export function createLsCommand(platform: PlatformId): Command {
  return new Command('ls')
    .description('Show current preset and available skills')
    .option('--json', 'Output as JSON')
    .addHelpText(
      'after',
      `
Examples:
  $ sk ${platform} ls
  $ sk ${platform} ls --json
`,
    )
    .action(async (options: { json?: boolean }) => {
      const ctx = createLoadoutContext(platform);

      const currentActive = await ctx.configManager.getActive();
      await ctx.skillManager.collect((skill) => ctx.configManager.addSkill(currentActive, skill));
      const activePreset = await ctx.configManager.getPreset(currentActive);
      // Repair dead links — skills manually deleted from the directory are restored
      await ctx.skillManager.sync(activePreset.skills);
      const mountedSkills = await ctx.skillManager.listMounted();
      const allSkills = await ctx.skillManager.listStore();
      const presets = await ctx.configManager.listPresets();

      if (options.json) {
        const output = {
          platform,
          activePreset: currentActive,
          description: activePreset.description,
          mountedSkills,
          allSkills,
          presets: presets.map((name) => name),
        };
        console.log(JSON.stringify(output, null, 2));
        return;
      }

      console.log(`\n${color.yellow('o  ' + currentActive)}`);
      console.log(`   Description: ${activePreset.description}`);
      console.log(
        `   Skills: ${color.bold(color.green(String(mountedSkills.length)))}/${color.bold(color.green(String(allSkills.length)))}`,
      );

      if (allSkills.length > 0) {
        for (const s of allSkills) {
          const icon = mountedSkills.includes(s) ? `[${color.green('*')}]` : '[ ]';
          const ss = mountedSkills.includes(s) ? color.green(s) : s;
          console.log(`    ${icon}    ${ss}`);
        }
      } else {
        console.log(`  (none)`);
      }

      console.log(`\n${color.yellow('o  Preset ' + `(${String(presets.length)})`)}`);
      for (const name of presets) {
        const icon = name === currentActive ? `[${color.yellow('*')}]` : '[ ]';
        const label = name === currentActive ? color.yellow(name) : name;
        console.log(`    ${icon}    ${label}`);
      }
    });
}
