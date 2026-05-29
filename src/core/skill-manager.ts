import { readdir, lstat, readlink, cp, unlink, rm, readFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';

import { isSubPath } from '../utils/platform.js';
import type { Paths } from '../utils/paths.js';
import { move, copyRecursive, pathExists } from '../utils/fs.js';
import { LoadoutError, ErrorCode, isErrCode } from '../utils/errors.js';
import { color, type Logger } from '../utils/logger.js';
import { validateName } from '../utils/validation.js';
import { SymlinkOps } from './symlink-ops.js';

// Read the .sk-own manifest listing command names that sk itself generated,
// so collect() can skip them instead of treating them as adoptable skills.
async function getOwnCommands(storeDir: string): Promise<Set<string>> {
  try {
    const raw = await readFile(join(storeDir, '.sk-own'), 'utf-8');
    return new Set(raw.split('\n').filter(Boolean));
  } catch {
    return new Set();
  }
}

export class SkillManager {
  readonly symlinkOps: SymlinkOps;
  private readonly paths: Paths;
  private readonly logger: Logger;

  constructor(paths: Paths, logger: Logger) {
    this.paths = paths;
    this.symlinkOps = new SymlinkOps(paths, logger);
    this.logger = logger;
  }

  /**
   * Scan the platform skills directory for non-managed entities (not in .sk-own
   * and not already symlinked into the store) and adopt them into the store.
   * Each adopted skill triggers `onNew(skill)` so callers can register it
   * into the current preset.
   */
  async collect(onNew: (skill: string) => Promise<void>): Promise<string[]> {
    const extracted: string[] = [];
    const ownCommands = await getOwnCommands(this.paths.storeDir);
    try {
      const entries = await readdir(this.paths.skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || ownCommands.has(entry.name)) continue;

        const entryPath = join(this.paths.skillsDir, entry.name);

        if (entry.isSymbolicLink()) {
          try {
            const linkTarget = await readlink(entryPath);
            const resolvedPath = resolve(dirname(entryPath), linkTarget).replace(/\\/g, '/');
            if (isSubPath(this.paths.storeDir, resolvedPath)) {
              continue; // Already managed by us — skip
            }
          } catch {
            this.logger.warn(
              `Broken symlink "${color.green(entry.name)}", will clean up during sync.`,
            );
            continue;
          }
        }

        const storePath = join(this.paths.storeDir, entry.name);
        const result = await this.extractSkill(entryPath, entry.name, storePath);

        if (result) {
          extracted.push(result);
          await this.symlinkOps.createLink(result);
        }
      }
    } catch (err: unknown) {
      if (isErrCode(err, 'ENOENT')) {
        return [];
      }
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to scan skills directory: ${msg}. Check permissions and try again.`);
      throw new LoadoutError(ErrorCode.IO_ERROR, `Failed to scan skills directory: ${msg}.`);
    }

    if (extracted.length > 5) {
      this.logger.info(
        `Collecting... found ${color.bold(color.green(String(extracted.length)))} new skills.`,
      );
    }

    for (const skill of extracted) {
      await onNew(skill);
      this.logger.info(`Collected ${color.green(skill)} → "${color.dim(this.paths.storeDir)}".`);
    }
    return extracted;
  }

  // Move or copy a skill entry from the platform skills dir into the store.
  // Symlinks are resolved and copied; regular files/dirs are moved (atomic rename
  // when possible, falling back to copy+delete across devices).
  private async extractSkill(
    entryPath: string,
    name: string,
    storePath: string,
  ): Promise<string | null> {
    const entryStat = await lstat(entryPath);

    if (entryStat.isSymbolicLink()) {
      const linkTarget = await readlink(entryPath);
      const resolvedPath = resolve(dirname(entryPath), linkTarget);

      await cp(resolvedPath, storePath, { recursive: true });
      await this.symlinkOps.removeLink(name);
    } else {
      await move(entryPath, storePath);
    }

    return name;
  }

  async listStore(): Promise<string[]> {
    try {
      const entries = await readdir(this.paths.storeDir, { withFileTypes: true });
      return entries
        .filter(
          (e) => !e.name.startsWith('.') && (e.isFile() || e.isDirectory() || e.isSymbolicLink()),
        )
        .map((e) => e.name);
    } catch (err: unknown) {
      if (isErrCode(err, 'ENOENT')) return [];
      throw err;
    }
  }

  async listMounted(): Promise<string[]> {
    const mounted = new Set<string>();
    try {
      const entries = await readdir(this.paths.skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        if (!entry.isSymbolicLink()) continue;
        const entryPath = join(this.paths.skillsDir, entry.name);
        try {
          const linkTarget = await readlink(entryPath);
          if (
            isSubPath(
              this.paths.storeDir,
              resolve(dirname(entryPath), linkTarget).replace(/\\/g, '/'),
            )
          ) {
            mounted.add(entry.name);
          }
        } catch {
          this.logger.debug(`Dead link ignored: "${color.green(entry.name)}".`);
        }
      }
    } catch (err: unknown) {
      if (isErrCode(err, 'ENOENT')) return [];
      throw new LoadoutError(
        ErrorCode.IO_ERROR,
        `Failed to read skills directory: ${err instanceof Error ? err.message : String(err)}.`,
      );
    }
    return [...mounted];
  }

  async sync(skills: string[]): Promise<void> {
    const mountedSet = new Set(await this.listMounted());

    for (const skill of skills) {
      validateName(skill, 'skill');
    }

    const targetSet = new Set(skills);
    for (const mounted of mountedSet) {
      if (!targetSet.has(mounted)) {
        await this.symlinkOps.removeLink(mounted);
      }
    }

    for (const skill of skills) {
      if (mountedSet.has(skill)) continue;

      try {
        await this.symlinkOps.createLink(skill);
      } catch (err: unknown) {
        if (err instanceof LoadoutError && err.code === ErrorCode.SKILL_NOT_FOUND) {
          this.logger.warn(
            `Skill "${color.green(skill)}" not found in "${color.dim(this.paths.storeDir)}", skipping.`,
          );
        } else {
          throw err;
        }
      }
    }
  }

  async restore(dryRun = false): Promise<void> {
    const storeExists = await pathExists(this.paths.storeDir);
    const configExists = await pathExists(this.paths.presetConfig);
    if (!storeExists && !configExists) {
      this.logger.info('sk not initialized for this platform. Nothing to uninstall.');
      return;
    }

    // 1. Remove all symlinks that point into our store
    let removedCount = 0;
    const skillEntries = await readdir(this.paths.skillsDir, { withFileTypes: true });
    for (const entry of skillEntries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = join(this.paths.skillsDir, entry.name);
      if (!entry.isSymbolicLink()) continue;

      try {
        const linkTarget = await readlink(fullPath);
        const resolvedPath = resolve(dirname(fullPath), linkTarget).replace(/\\/g, '/');
        if (isSubPath(this.paths.storeDir, resolvedPath)) {
          if (dryRun) {
            this.logger.dryRun(`Would remove link "${color.green(entry.name)}".`);
            removedCount++;
          } else {
            await unlink(fullPath);
            removedCount++;
          }
        }
      } catch {
        this.logger.warn(`Non-managed or dead link skipped: "${entry.name}".`);
      }
    }
    if (removedCount > 0) {
      if (dryRun) {
        this.logger.dryRun(
          `Would remove ${color.bold(color.green(String(removedCount)))} sk links.`,
        );
      } else {
        this.logger.info(`Removed ${color.bold(color.green(String(removedCount)))} sk links.`);
      }
    }

    // 2. Restore each skill from the store, then delete it from the store.
    const storeFiles = await readdir(this.paths.storeDir, { withFileTypes: true });
    const skills = storeFiles.filter((e) => !e.name.startsWith('.'));
    if (dryRun) {
      if (skills.length > 0) {
        this.logger.dryRun(
          `Would restore ${color.bold(color.green(String(skills.length)))} skill(s) to "${color.dim(this.paths.skillsDir)}": ${skills.map((e) => color.green(e.name)).join(', ')}`,
        );
      }
    } else {
      let done = 0;
      for (const sk of skills) {
        if (sk.name.startsWith('.')) continue;
        const src = join(this.paths.storeDir, sk.name);
        const dest = join(this.paths.skillsDir, sk.name);
        await copyRecursive(src, dest);
        await rm(src, { recursive: true, force: true });
        done++;
        this.logger.info(
          `Restoring [${color.bold(color.green(String(done)))}/${color.bold(color.green(String(skills.length)))}] "${color.green(sk.name)}".`,
        );
      }
      this.logger.success(
        `Restored ${color.bold(color.green(String(skills.length)))} skill(s) to "${color.dim(this.paths.skillsDir)}": ${skills.map((e) => color.green(e.name)).join(', ')}`,
      );
    }

    // 3. Remove generated slash-command files (e.g. /sk-add, /sk-ls) placed by init.
    //    Tracked by .sk-own; placed in commandsDir (Claude) or skillsDir (OpenCode/Codex).
    const ownCommands = await getOwnCommands(this.paths.storeDir);
    const cmdRoot = this.paths.commandsDir ?? this.paths.skillsDir;
    for (const name of ownCommands) {
      const cmdPath = join(cmdRoot, name);
      if (dryRun) {
        this.logger.dryRun(`Would delete sk-loadout command "/${color.green(name)}".`);
        continue;
      }
      await rm(cmdPath, { recursive: true, force: true });
    }

    // 4. Delete config (marks restore complete), then remove store if empty.
    //    If skills remain in the store, something went wrong — keep them.
    if (dryRun) {
      this.logger.dryRun(`Would delete "${color.dim(this.paths.presetConfig)}".`);
    } else {
      await rm(this.paths.presetConfig, { force: true });
    }

    const leftover = await readdir(this.paths.storeDir).catch(() => [] as string[]);
    const visible = leftover.filter((f) => !f.startsWith('.'));
    if (dryRun) {
      this.logger.dryRun(`Would delete "${color.dim(this.paths.storeDir)}".`);
    } else if (visible.length > 0) {
      this.logger.warn(
        `Store not fully migrated — ${visible.length} skill(s) left in "${color.dim(this.paths.storeDir)}". Re-run restore to recover.`,
      );
    } else {
      await rm(this.paths.storeDir, { recursive: true, force: true });
    }
  }
}
