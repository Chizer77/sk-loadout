import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, lstatSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRestoreCommand } from '../../src/commands/restore.js';

const testRoot = mkdtempSync(join(tmpdir(), 'sk-restore-'));
const configPath = join(testRoot, '.sk-loadout', 'claude.json');
const storeDir = join(testRoot, '.sk-loadout', 'claude');
const skillsDir = join(testRoot, '.claude', 'skills');

beforeAll(() => {
  process.env.SK_LOADOUT_HOME = testRoot;
  process.env.SK_CLAUDE_HOME = join(testRoot, '.claude');
});

afterAll(() => {
  rmSync(testRoot, { recursive: true, force: true });
  delete process.env.SK_LOADOUT_HOME;
  delete process.env.SK_CLAUDE_HOME;
});

beforeEach(() => {
  rmSync(testRoot, { recursive: true, force: true });
  mkdirSync(join(testRoot, '.sk-loadout'), { recursive: true });
  mkdirSync(storeDir, { recursive: true });
  mkdirSync(skillsDir, { recursive: true });
  writeFileSync(
    configPath,
    JSON.stringify({
      currentActive: 'base',
      presets: {
        base: {
          description: 'default',
          modelConfig: { model: 'claude', extra: {} },
          skills: ['skill.md'],
        },
      },
    }),
  );
});

function exists(p: string): boolean {
  try {
    lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

describe('restore command', () => {
  it('正常模式删除 sk-loadout 目录并还原技能', async () => {
    writeFileSync(join(storeDir, 'skill.md'), '# Skill', 'utf-8');

    const cmd = createRestoreCommand('claude').exitOverride(() => {});
    await cmd.parseAsync(['node', 'restore', '--yes']);

    // restore deletes this platform's config and store, but keeps
    // .sk-loadout/ itself (other platform data may coexist there)
    expect(exists(configPath)).toBe(false);
    expect(exists(storeDir)).toBe(false);
    expect(exists(join(skillsDir, 'skill.md'))).toBe(true);
  });

  it('清理 init 生成的 slash-command 文件', async () => {
    writeFileSync(join(storeDir, 'skill.md'), '# Skill', 'utf-8');
    // Simulate generated commands: .sk-own records names, init placed them in commandsDir
    writeFileSync(join(storeDir, '.sk-own'), 'sk-ls\nsk-use', 'utf-8');
    const commandsDir = join(testRoot, '.claude', 'commands', 'sk');
    mkdirSync(join(commandsDir, 'sk-ls'), { recursive: true });
    mkdirSync(join(commandsDir, 'sk-use'), { recursive: true });

    const cmd = createRestoreCommand('claude').exitOverride(() => {});
    await cmd.parseAsync(['node', 'restore', '--yes']);

    expect(exists(join(commandsDir, 'sk-ls'))).toBe(false);
    expect(exists(join(commandsDir, 'sk-use'))).toBe(false);
  });

  it('dry-run 模式不实际改动', async () => {
    writeFileSync(join(storeDir, 'skill.md'), '# Skill', 'utf-8');

    const cmd = createRestoreCommand('claude').exitOverride(() => {});
    await cmd.parseAsync(['node', 'restore', '--dry-run']);

    // dry-run 不应删除目录
    expect(exists(join(testRoot, '.sk-loadout'))).toBe(true);
    expect(exists(storeDir)).toBe(true);
  });
});
