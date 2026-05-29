---
name: sk-rm
description: Remove skills or delete a preset. Use when user asks to remove, delete, unmount, or uninstall.
---

sk-loadout manages presets (model + skills). Run `sk codex ls` to see current state.

- Skill: `sk codex rm <skill1> <skill2> ...`
- Preset: `sk codex rm -p <preset-name>`
- Ambiguous (name matches both): ask user which one
