# Environment Variables

## Store Location

| Variable          | Description                              | Default       |
| ----------------- | ---------------------------------------- | ------------- |
| `SK_LOADOUT_HOME` | Base directory containing `.sk-loadout/` | `~` (OS home) |

When set, sk-loadout uses `$SK_LOADOUT_HOME/.sk-loadout` instead of `~/.sk-loadout`.

## Platform Homes

| Variable           | Platform    | Overrides            |
| ------------------ | ----------- | -------------------- |
| `SK_CLAUDE_HOME`   | Claude Code | `~/.claude`          |
| `SK_OPENCODE_HOME` | OpenCode    | `~/.config/opencode` |
| `SK_CODEX_HOME`    | Codex       | `~/.codex`           |

```bash
# POSIX
SK_CLAUDE_HOME=/tmp/claude sk claude init

# PowerShell
$env:SK_CLAUDE_HOME="E:\sandbox\.claude"; sk claude init
```

## Logging

| Variable               | Description      | Default |
| ---------------------- | ---------------- | ------- |
| `SK_LOADOUT_LOG_LEVEL` | Logger verbosity | `info`  |

Valid levels (from most to least verbose):

| Level    | Output                                                                        |
| -------- | ----------------------------------------------------------------------------- |
| `debug`  | All messages including symlink creation, settings writes, dead link detection |
| `info`   | Normal operation messages (skill collection, restore progress)                |
| `warn`   | Warnings only (failed extraction, broken symlinks)                            |
| `error`  | Errors only                                                                   |
| `silent` | Nothing on stderr — `dryRun` and `success` still write to stdout              |

> [!TIP]
> Set to `debug` when troubleshooting: `SK_LOADOUT_LOG_LEVEL=debug sk claude ls`
>
> Every command run automatically writes a timestamped log to `~/.sk-loadout/logs/`. The last 30 runs are kept.

## Home Resolution Order

For each platform, the home directory is resolved in this order:

1. `--home <path>` passed to `init`
2. Platform environment variable (e.g. `SK_CLAUDE_HOME`)
3. Persisted home from a previous `init --home`
4. Platform default (`~/.claude`, `~/.config/opencode`, `~/.codex`)
