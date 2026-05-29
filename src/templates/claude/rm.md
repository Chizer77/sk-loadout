---
name: sk-rm
description: Remove skills or delete a preset. Use when user asks to remove, delete, unmount, or uninstall.
argument-hint: [skill...] or -p <preset>
---

sk-loadout manages presets (model + skills) for Claude Code. Run `/sk-ls` to see current state.

- Skill: `sk claude rm <skill1> <skill2> ...`
- Preset: `sk claude rm -p <preset-name>`
- Ambiguous (name matches both): ask user which one
