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

**Model config:** reads/writes `model` and `env`. When a preset is applied, `modelConfig.model` → `settings.model`, `modelConfig.extra` → merged into `settings.env`.

**Skills:** `~/.claude/skills/review.md`, managed from `~/.sk-loadout/claude/`.

## OpenCode

```bash
sk opencode init
```

| Item     | Value                                   |
| -------- | --------------------------------------- |
| Home     | `~/.config/opencode`                    |
| Settings | `opencode.jsonc` (JSONC)                |
| Skills   | folders with `SKILL.md` under `skills/` |

**Model config:** reads/writes `model` and the first provider's `options.baseURL` / `options.apiKey`. Generic extra keys matching base URL or API key patterns are mapped into the first configured provider.

**Skills:** `~/.config/opencode/skills/my-skill/SKILL.md`, managed from `~/.sk-loadout/opencode/`.

## Codex

```bash
sk codex init
```

| Item     | Value                                           |
| -------- | ----------------------------------------------- |
| Home     | `~/.codex`                                      |
| Settings | `config.toml` (TOML)                            |
| Skills   | folders with `SKILL.md` under `.agents/skills/` |

**Model config:** reads/writes `model` and the first `model_providers` entry's `base_url` / `env_key`. Generic extra keys matching base URL, endpoint, API key, or auth token patterns are mapped into the first configured provider.

**Skills:** `~/.codex/.agents/skills/my-skill/SKILL.md`, managed from `~/.sk-loadout/codex/`.

## Custom Home

Override the default home for any platform:

```bash
sk claude init --home /custom/path
SK_CLAUDE_HOME=/custom/path sk claude init
```
