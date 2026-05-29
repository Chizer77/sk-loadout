---
name: sk-use
description: Switch to a preset. Use when user asks to switch, change, or activate a preset, mode, or profile.
---

sk-loadout manages presets (model + skills) for OpenCode. Run `sk opencode ls` to see available presets.

- Name given: `sk opencode use "<name>"`
- No name: run `sk opencode ls --json`, let user pick, then `sk opencode use "<chosen>"`
