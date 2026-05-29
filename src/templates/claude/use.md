---
name: sk-use
description: Switch to a preset. Use when user asks to switch, change, or activate a preset/mode/profile.
argument-hint: [preset-name]
---

sk-loadout manages presets (model + skills) for Claude Code. Run `/sk-ls` to see available presets.

- Name given: `sk claude use "<name>"`
- No name: run `sk claude ls --json`, let user pick, then `sk claude use "<chosen>"`
