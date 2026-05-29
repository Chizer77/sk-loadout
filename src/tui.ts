import { select, multiselect, confirm, isCancel } from '@clack/prompts';

import type { LoadoutContext } from './core/context.js';
import { LoadoutError, ErrorCode } from './utils/errors.js';
import { DEFAULT_PRESET_NAME } from './types.js';

// Assert that a @clack/prompts result was not cancelled. Cancellation
// throws LoadoutError(CANCELLED) so callers don't need to handle it.
function handleCancel<T>(result: T | symbol): asserts result is T {
  if (isCancel(result)) {
    throw new LoadoutError(ErrorCode.CANCELLED, 'Cancelled.');
  }
}

/**
 * Require explicit confirmation for a destructive action.
 *
 * - `--yes`: skip prompt (AI / scripting mode)
 * - TTY: interactive confirm dialog
 * - non-TTY without `--yes`: throw TTY_REQUIRED with a hint
 */
export async function confirmAction(message: string, yes?: boolean): Promise<void> {
  if (yes) return;

  if (!process.stdout.isTTY) {
    throw new LoadoutError(
      ErrorCode.TTY_REQUIRED,
      'Use --yes to confirm this action in non-interactive mode.',
    );
  }

  const ok = await confirm({ message });
  handleCancel(ok);
  if (!ok) {
    throw new LoadoutError(ErrorCode.CANCELLED, 'Cancelled.');
  }
}

export async function selectPreset(ctx: LoadoutContext, excludeDefault = false): Promise<string> {
  const allNames = await ctx.configManager.listPresets();
  const names = allNames.filter((n) => !excludeDefault || n !== DEFAULT_PRESET_NAME);
  if (names.length === 0)
    throw new LoadoutError(ErrorCode.PRESET_NOT_FOUND, 'No presets available.');

  const presets = await Promise.all(names.map((n) => ctx.configManager.getPreset(n)));
  const result = await select({
    message: `Select preset (${names.length} available)`,
    options: names.map((n, i) => {
      const p = presets[i]!;
      return { value: n, label: n, hint: p.modelConfig.model };
    }),
  });
  handleCancel(result);
  return result;
}

export async function manageSkills(ctx: LoadoutContext): Promise<string[]> {
  const [storeSkills, mountedSkills] = await Promise.all([
    ctx.skillManager.listStore(),
    ctx.skillManager.listMounted(),
  ]);
  if (storeSkills.length === 0)
    throw new LoadoutError(ErrorCode.SKILL_NOT_FOUND, 'Skill store is empty.');

  const result = await multiselect({
    message: `Manage skills (${storeSkills.length} in store)`,
    options: storeSkills.map((s) => ({
      value: s,
      label: s,
    })),
    initialValues: mountedSkills.filter((s) => storeSkills.includes(s)),
    required: false,
  });
  handleCancel(result);
  return result;
}
