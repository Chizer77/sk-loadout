# Platform Support

## Claude Code

```bash
sk claude init
```

| Item               | Value                            |
| ------------------ | -------------------------------- |
| Home               | `~/.claude`                      |
| Settings           | `settings.json` (JSON)           |
| Skills             | flat `.md` files under `skills/` |
| Generated commands | `commands/sk/`                   |

**Skills:** `~/.claude/skills/review-skill.md`, managed from `~/.sk-loadout/claude/`.

## OpenCode

```bash
sk opencode init
```

| Item     | Value                                   |
| -------- | --------------------------------------- |
| Home     | `~/.config/opencode`                    |
| Settings | `opencode.jsonc` (JSONC)                |
| Skills   | folders with `SKILL.md` under `skills/` |

**Skills:** `~/.config/opencode/skills/my-skill/SKILL.md`, managed from `~/.sk-loadout/opencode/`.

## Codex

```bash
sk codex init
```

| Item     | Value                                             |
| -------- | ------------------------------------------------- |
| Home     | `~/.codex`                                        |
| Settings | `config.toml` (TOML)                              |
| Skills   | folders with `SKILL.md` under `~/.agents/skills/` |

**Skills:** `~/.agents/skills/my-skill/SKILL.md`, managed from `~/.sk-loadout/codex/`.

## Custom Home

Override the default home for any platform:

```bash
sk claude init --home /custom/path
SK_CLAUDE_HOME=/custom/path sk claude init
```
