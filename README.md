<p align="center">
  <img src="./docs/banner.svg" alt="sk-loadout" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/sk-loadout">
    <img src="https://img.shields.io/npm/v/sk-loadout.svg" alt="npm" />
  </a>
  <a href="./package.json">
    <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg" alt="Node" />
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" />
  </a>
</p>

Hot-swap AI assistant presets from the terminal.

A preset captures the model and skills for one work mode. Switch presets and your assistant reconfigures instantly — no manual editing of settings files or symlinks.

> [!IMPORTANT]
> sk-loadout is a **manager**, not an installer. It organizes skills you already have — it does not download, generate, or distribute them. Skills from any source (manual creation, third-party repos, other tools) work as long as they land in the platform skills directory.

## Installation

```bash
npm install -g sk-loadout
```

Or run once with `npx`:

```bash
npx sk-loadout claude init
```

## Quick Start

```bash
sk claude init                         # 1. bootstrap the environment
sk claude save frontend --desc "UI"    # 2. snapshot current model + skills
sk claude skill                        # 3. toggle skills interactively
sk claude use frontend                 # 4. switch preset
sk claude ls                           # 5. inspect state
```

> [!TIP]
> After one platform is initialized, `sk` auto-detects it — omit the platform name:
>
> ```bash
> sk ls
> sk use frontend
> sk save backend --desc "API work"
> ```

## Supported Platforms

| Platform    | Prefix        |
| ----------- | ------------- |
| Claude Code | `sk claude`   |
| OpenCode    | `sk opencode` |
| Codex       | `sk codex`    |

Same commands, any platform:

```bash
sk claude init    sk opencode init    sk codex init
sk claude ls      sk opencode ls      sk codex ls
sk claude use X   sk opencode use X   sk codex use X
```

## CLI Commands

| Command   | Description                                                |
| --------- | ---------------------------------------------------------- |
| `init`    | Bootstrap or rebuild the sk-loadout environment            |
| `skill`   | Open the interactive skill picker (toggle skills visually) |
| `ls`      | Show active preset, mounted skills, and all presets        |
| `save`    | Save current model + mounted skills as a preset            |
| `use`     | Switch to a preset — applies model config and syncs skills |
| `add`     | Mount stored skills to the current preset                  |
| `rm`      | Remove skills, or delete a preset (`-p`)                   |
| `restore` | Uninstall for one platform and restore managed skills      |

`add` only mounts skills that already exist in the store — it does not import files from arbitrary paths. New skills are collected from the platform skills directory by `init`, `ls`, `save`, `use`, and `skill`.

See [CLI Reference](./docs/cli.md) for full options and examples.

## Agent Commands

`init` generates slash-command helpers so AI agents can manage presets and skills directly in a conversation:

| Command    | Equivalent       |
| ---------- | ---------------- |
| `/sk-ls`   | `sk claude ls`   |
| `/sk-use`  | `sk claude use`  |
| `/sk-save` | `sk claude save` |
| `/sk-add`  | `sk claude add`  |
| `/sk-rm`   | `sk claude rm`   |

These work inside Claude Code, OpenCode, and Codex.

> [!NOTE]
> Commands are regenerated on each `init`. Save customizations before re-initializing.

## Example Walkthrough

Start with a fresh Claude Code setup. You have a few skills in `~/.claude/skills/` — some you wrote, some from a third-party repo:

```bash
# Bootstrap — adopts existing skills, creates a default "base" preset
sk claude init

# See what was collected
sk claude ls

# The model from settings.json was captured automatically.
# Save it as a named preset with the skills you want:
sk claude skill              # toggle to pick skills for frontend work
sk claude save frontend --desc "Vue + Tailwind + a11y"

# Switch to it — model config and skill symlinks update instantly
sk claude use frontend

# Add another skill from the store (must already exist there)
sk claude add git-push

# Tweak skills and update current preset
sk claude rm git-push

# Create another preset for a different workflow
sk claude use base            # start from clean state
sk claude skill               # pick backend-focused skills
sk claude save backend --desc "API + database + testing"

# Switch preset as needed
sk claude use

# Clean up a preset you no longer need
sk claude rm -p frontend

# Machine-readable output for scripts
sk claude ls --json

# Preview what uninstall would do before committing
sk claude restore --dry-run
```

## Scripting & CI

Use direct commands with `--yes` to skip prompts:

```bash
sk claude use review-mode
sk claude add vue-helper.md
sk claude rm -p old-preset --yes
sk claude restore --yes
sk claude ls --json
```

> [!NOTE]
> `skill` and `use` require a TTY. Use `add` / `rm` / `use <name>` for automation.

## Architecture

```text
CLI → Commands → Core managers → Platform adapters → Assistant config + skill directories
```

Preset state lives in `~/.sk-loadout`. Skills are mounted via symlinks (junctions on Windows). Model config is written through platform-specific adapters.

## Documentation

- [CLI Reference](./docs/cli.md)
- [Platform Support](./docs/platforms.md)
- [Env Variables](./docs/env-variables.md)
- [Restore & Recovery](./docs/restore-and-recovery.md)
- [Windows Notes](./docs/windows.md)
- [FAQ](./docs/faq.md)
