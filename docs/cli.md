# CLI Reference

```bash
sk <platform> <command> [options]
```

Supported platforms: `claude` | `opencode` | `codex`

When the first argument is not a platform name, `sk` auto-detects from existing config files.

> [!TIP]
> After one platform is initialized, you can omit the platform name: `sk ls`, `sk use frontend`.

## `init`

Initialize or rebuild the sk-loadout environment for a platform.

```bash
sk claude init
sk claude init --home /custom/path
sk claude init --home=/custom/path
sk claude init --dry-run
```

| Option          | Description                                             |
| --------------- | ------------------------------------------------------- |
| `--home <path>` | Custom platform config directory (also `--home=<path>`) |
| `--dry-run`     | Preview what init would do without making changes       |

> [!NOTE]
> `init` creates the default `base` preset and generates slash-command templates for quick skill management.

## `skill`

Open the interactive skill manager (requires TTY).

```bash
sk claude skill
```

> [!NOTE]
> `skill` toggles skills visually in a terminal. For scripting, use `add` / `rm`.

Alias: `sk claude sk`

## `ls`

Show the active preset, mounted skills, and all presets.

```bash
sk claude ls
sk claude ls --json
```

| Option   | Description                  |
| -------- | ---------------------------- |
| `--json` | Machine-readable JSON output |

## `save`

Save the current mounted skills as a preset.

```bash
sk claude save                           # update current preset
sk claude save frontend --desc "UI work" # create or overwrite
```

| Option              | Description            |
| ------------------- | ---------------------- |
| `-d, --desc <text>` | Set preset description |

## `use`

Switch to a preset.

```bash
sk claude use              # interactive picker (TTY required)
sk claude use frontend     # direct switch
```

Switching syncs the preset's skills to the platform skills directory.

## `add`

Mount stored skills to the current preset.

```bash
sk claude add vue-helper.md
sk claude add skill-a skill-b
```

> [!IMPORTANT]
> `add` only mounts skills that already exist in the sk-loadout store.

## `rm`

Remove skills from the current preset, or delete a preset.

```bash
sk claude rm vue-helper.md
sk claude rm -p old-preset --yes
```

| Option                | Description                              |
| --------------------- | ---------------------------------------- |
| `-p, --preset <name>` | Delete a preset                          |
| `-y, --yes`           | Skip confirmation when deleting a preset |

> [!WARNING]
> `rm -p` is destructive — the preset config is gone. Save first if you might want it back. The `base` preset cannot be deleted.

## `restore`

Uninstall sk-loadout for one platform and restore managed skills.

```bash
sk claude restore
sk claude restore --dry-run
sk claude restore --yes
```

| Option      | Description                     |
| ----------- | ------------------------------- |
| `--dry-run` | Preview changes without writing |
| `-y, --yes` | Skip confirmation               |

## Home Resolution

For each platform, `init` resolves the home directory in this order:

1. `--home <path>` or `--home=<path>`
2. Platform environment variable (`SK_CLAUDE_HOME`, etc.)
3. Persisted home from a previous `init --home`
4. Default (`~/.claude`, `~/.config/opencode`, `~/.codex`)
