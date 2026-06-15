# FAQ

## Does `add` import files from any path?

No. `add` only mounts skills that already exist in the sk-loadout store. New skills are collected from the platform skills directory during commands like `init`, `ls`, `save`, `use`, and `skill`.

## Can I use sk-loadout in CI or scripts?

Yes. Use direct commands with explicit names and `--yes` to skip prompts:

```bash
sk claude init
sk claude use review-mode
sk claude rm -p old-preset --yes
sk claude ls --json
```

> [!NOTE]
> Avoid TUI commands (`skill`, interactive `use`) in non-interactive environments.

## What happens to existing skills during `init`?

Unmanaged skills are adopted into the store and linked back. They are also registered on the active preset.

## Which platforms are supported?

Claude Code, OpenCode, and Codex.

## Can I delete the `base` preset?

No. It is the fallback and cannot be deleted.

## What does a preset include?

A description and a list of skill names.

## Why did auto-detection fail?

Auto-detection checks for known platform settings files. If none exist, use an explicit platform:

```bash
sk claude init
```

Or pass a custom home:

```bash
sk claude init --home /path/to/.claude
```

## How do I troubleshoot?

Set `SK_LOADOUT_LOG_LEVEL=debug` for verbose output:

```bash
SK_LOADOUT_LOG_LEVEL=debug sk claude ls
```
