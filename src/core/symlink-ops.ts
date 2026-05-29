import { symlink, unlink, rm, lstat, stat, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

import { createDirSymlink } from '../utils/platform.js';
import type { Paths } from '../utils/paths.js';
import { LoadoutError, ErrorCode, isErrCode } from '../utils/errors.js';
import { color, type Logger } from '../utils/logger.js';

export class SymlinkOps {
  private readonly paths: Paths;
  private readonly logger: Logger;

  constructor(paths: Paths, logger: Logger) {
    this.paths = paths;
    this.logger = logger;
  }

  async createLink(storeFilename: string): Promise<void> {
    const src = join(this.paths.storeDir, storeFilename).replace(/\\/g, '/');
    const dest = join(this.paths.skillsDir, storeFilename).replace(/\\/g, '/');

    try {
      const type = await this.symlinkType(src);

      await rm(dest, { force: true, recursive: false }).catch((err: unknown) => {
        if (!isErrCode(err, 'ENOENT')) throw err;
      });

      // Directory targets use junctions on Windows — standard dir symlinks
      // require Developer Mode, which is not enabled by default.
      if (type === 'dir') {
        await createDirSymlink(src, dest);
      } else {
        await mkdir(dirname(dest), { recursive: true });
        await symlink(src, dest, 'file');
      }
      this.logger.debug(`Linked: "${color.dim(dest)}" → "${color.dim(src)}".`);
    } catch (err: unknown) {
      const code: string | undefined =
        err instanceof Error ? (err as NodeJS.ErrnoException).code : undefined;
      if (code === 'EEXIST') return;
      // EPERM/EACCES on Windows typically means Developer Mode is disabled
      if (code === 'EPERM' || code === 'EACCES') {
        throw new LoadoutError(
          ErrorCode.PERMISSION_DENIED,
          'Failed to create symlink. Enable Developer Mode in Windows Settings or run as Administrator.',
        );
      }
      throw new LoadoutError(
        ErrorCode.IO_ERROR,
        `Failed to create link for "${color.green(storeFilename)}": ${err instanceof Error ? err.message : String(err)}.`,
      );
    }
  }

  async removeLink(skillFilename: string): Promise<void> {
    const linkPath = join(this.paths.skillsDir, skillFilename).replace(/\\/g, '/');

    try {
      const linkStat = await lstat(linkPath);
      // Only remove symlinks — never touch real files/dirs
      if (!linkStat.isSymbolicLink()) {
        return;
      }
    } catch (err: unknown) {
      if (isErrCode(err, 'ENOENT')) return;
      throw err;
    }

    // Directory symlinks may report EISDIR on some platforms when unlinked as files
    await unlink(linkPath).catch(async (err: unknown) => {
      if (isErrCode(err, 'EISDIR')) {
        await rm(linkPath, { force: true, recursive: false });
        return;
      }
      throw err;
    });
    this.logger.debug(`unlinked: "${color.dim(linkPath)}".`);
  }

  private async symlinkType(targetPath: string): Promise<'dir' | 'file'> {
    try {
      const targetStat = await stat(targetPath);
      return targetStat.isDirectory() ? 'dir' : 'file';
    } catch (err: unknown) {
      if (isErrCode(err, 'ENOENT')) {
        throw new LoadoutError(
          ErrorCode.SKILL_NOT_FOUND,
          `Target not found: "${color.dim(targetPath)}".`,
        );
      }
      throw err;
    }
  }
}
