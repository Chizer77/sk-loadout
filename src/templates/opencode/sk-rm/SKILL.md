---
name: sk-rm
description: Remove skills or delete a preset. Use when user asks to remove, delete, unmount, or uninstall.
---

sk-loadout manages presets (model + skills) for OpenCode. Run `sk opencode ls` to see current state.

- Skill: `sk opencode rm <skill1> <skill2> ...`
- Preset: `sk opencode rm -p <preset-name>`
- Ambiguous (name matches both): ask user which one
