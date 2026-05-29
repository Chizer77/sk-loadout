#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { satisfies } from 'semver';
import { Command } from 'commander';

import { PLATFORM_REGISTRY, detectPlatform, type PlatformId } from './types.js';
import { ConsoleLogger, color, setLogDir } from './utils/logger.js';
import { getSkLoadoutDir } from './utils/paths.js';
import { createInitCommand } from './commands/init.js';
import { createUseCommand } from './commands/use.js';
import { createSaveCommand } from './commands/save.js';
import { createSkillCommand } from './commands/skill.js';
import { createAddCommand } from './commands/add.js';
import { createRmCommand } from './commands/rm.js';
import { createLsCommand } from './commands/list.js';
import { createRestoreCommand } from './commands/restore.js';
import { LoadoutError, ErrorCode } from './utils/errors.js';
import { releaseLock } from './utils/lock.js';

interface PkgJson {
  version: string;
  engines?: Record<string, string>;
}

let _pkg: PkgJson | undefined;

function readPkg(): PkgJson {
  if (_pkg) return _pkg;
  _pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8')) as PkgJson;
  return _pkg;
}

// Enforce the Node.js version declared in package.json engines
function checkNodeVersion(): void {
  const pkg = readPkg();
  const raw = pkg.engines?.node ?? '>=18';
  if (!satisfies(process.versions.node, raw)) {
    console.error(`sk-loadout requires Node.js ${raw}, current version: ${process.versions.node}`);
    process.exit(1);
  }
}

checkNodeVersion();

setLogDir(getSkLoadoutDir());

// Release the config lock on SIGINT/SIGTERM. The guard prevents double-exit
// (pressing Ctrl+C twice would skip the lock release otherwise).
let exiting = false;
function handleSignal(): void {
  if (exiting) return;
  exiting = true;
  releaseLock()
    .catch(() => {
      /* ignore — about to exit */
    })
    .finally(() => process.exit(130));
}
process.on('SIGINT', handleSignal);
process.on('SIGTERM', handleSignal);

const pkg = readPkg();

const program = new Command();

program
  .name('sk')
  .description('Skill loadout manager — hot-swap AI models & skill packs')
  .version(pkg.version);

for (const [id, def] of Object.entries(PLATFORM_REGISTRY)) {
  const platformCmd = new Command(id).description(def.label);

  platformCmd.addCommand(createInitCommand(id as PlatformId));
  platformCmd.addCommand(createAddCommand(id as PlatformId));
  platformCmd.addCommand(createRmCommand(id as PlatformId));
  platformCmd.addCommand(createUseCommand(id as PlatformId));
  platformCmd.addCommand(createSaveCommand(id as PlatformId));
  platformCmd.addCommand(createSkillCommand(id as PlatformId));
  platformCmd.addCommand(createLsCommand(id as PlatformId));
  platformCmd.addCommand(createRestoreCommand(id as PlatformId));

  program.addCommand(platformCmd);
}

// Auto-detect platform when the first argument is not a known platform name.
// We splice the detected platform into process.argv so the Commander router
// never sees the ambiguity — it always receives <platform> <subcommand>.
{
  const rawArgs = process.argv.slice(2);
  const first = rawArgs[0];
  if (first && !first.startsWith('-')) {
    const known = Object.keys(PLATFORM_REGISTRY).includes(first);
    if (!known) {
      // Check if the user made a typo — if the arg shares a prefix with
      // a known platform, it's likely a misspelling, not a missing platform.
      const near = Object.keys(PLATFORM_REGISTRY).find((id) => id.startsWith(first));
      if (near && first.length >= 2) {
        console.error(`Unknown platform "${first}". Did you mean "${near}"?`);
        const platforms = Object.keys(PLATFORM_REGISTRY).join(' | ');
        console.error(`  Usage: sk <${platforms}> <command>`);
        process.exit(1);
      }

      // Support both --home <path> and --home=<path>
      const homeIdx = rawArgs.indexOf('--home');
      const homeEq = rawArgs.find((a) => a.startsWith('--home='));
      const customHome =
        homeIdx !== -1 ? rawArgs[homeIdx + 1] : homeEq ? homeEq.slice('--home='.length) : undefined;
      const detected = detectPlatform(customHome);
      if (detected) {
        new ConsoleLogger().success(`auto-detected platform: ${color.magenta(detected)}`);
        process.argv.splice(2, 0, detected);
      } else {
        const platforms = Object.keys(PLATFORM_REGISTRY).join(' | ');
        console.error(`No supported platform detected. Available: ${platforms}`);
        console.error(`  Usage: sk <${platforms}> init`);
        process.exit(1);
      }
    }
  }
}

// Top-level error handling: LoadoutError carries a pre-mapped exit code;
// everything else defaults to 1. The lock is always released in the finally block.
async function main(): Promise<void> {
  try {
    await program.parseAsync();
  } catch (err: unknown) {
    const logger = new ConsoleLogger();
    if (err instanceof LoadoutError) {
      if (err.code === ErrorCode.CANCELLED) {
        logger.success(err.message);
      } else {
        logger.error(err.message);
      }
      process.exitCode = err.exitCode;
    } else {
      logger.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  } finally {
    await releaseLock();
  }
}

main().catch((err: unknown) => {
  new ConsoleLogger().error(`sk fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
