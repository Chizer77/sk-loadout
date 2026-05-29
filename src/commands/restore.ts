import { Command } from 'commander';
import { createLoadoutContext } from '../core/context.js';
import type { PlatformId } from '../types.js';
import { confirmAction } from '../tui.js';

export function createRestoreCommand(platform: PlatformId): Command {
  return new Command('restore')
    .description('Uninstall sk-loadout and restore original state')
    .option('--dry-run', 'Preview without making changes')
    .option('-y, --yes', 'skip confirmation prompt')
    .addHelpText(
      'after',
      `
Examples:
  $ sk ${platform} restore
  $ sk ${platform} restore --dry-run
  $ sk ${platform} restore --yes
`,
    )
    .action(async (options: { dryRun?: boolean; yes?: boolean }) => {
      const ctx = createLoadoutContext(platform);

      const dryRun = options.dryRun ?? false;

      if (!dryRun) {
        await confirmAction('Uninstall sk-loadout and restore all skills?', options.yes);
      }

      await ctx.skillManager.restore(dryRun);
      if (!dryRun) {
        ctx.logger.success('sk-loadout uninstalled.');
      }
    });
}
