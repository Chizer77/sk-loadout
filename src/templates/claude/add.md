---
name: sk-add
description: Mount skills to current loadout. Use when user asks to add, mount, or install skills.
argument-hint: <skill...>
---

sk-loadout manages presets (model + skills) for Claude Code. Run `/sk-ls` to see current state and available skills.

- Run `sk claude ls` to list available skills
- Match names and run `sk claude add <skill1> <skill2> ...`
- If a skill is not in the list, tell the user
