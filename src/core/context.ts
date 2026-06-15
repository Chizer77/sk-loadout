import { ConfigManager } from './config-manager.js';
import { SkillManager } from './skill-manager.js';
import { ConsoleLogger, type Logger } from '../utils/logger.js';
import { getPaths, type Paths } from '../utils/paths.js';
import type { PlatformId } from '../types.js';

export interface LoadoutContext {
  platform: PlatformId;
  paths: Paths;
  configManager: ConfigManager;
  skillManager: SkillManager;
  symlinkOps: SkillManager['symlinkOps'];
  logger: Logger;
}

export function createLoadoutContext(platform: PlatformId): LoadoutContext {
  const paths = getPaths(platform);
  const logger = new ConsoleLogger();
  const skillManager = new SkillManager(paths, logger);
  return {
    platform,
    paths,
    configManager: new ConfigManager(paths),
    skillManager,
    symlinkOps: skillManager.symlinkOps,
    logger,
  };
}
