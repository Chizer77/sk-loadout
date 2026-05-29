---
name: sk-save
description: Save current state as a preset. Use when user asks to save, snapshot, or create a preset/profile.
argument-hint: [name] [--desc <description>]
---

sk-loadout manages presets (model + skills) for Claude Code. Run `/sk-ls` to see current state.

- Update current: `sk claude save`
- Create new: `sk claude save <name> --desc "<description>"`
- Overwrite existing: same as create
