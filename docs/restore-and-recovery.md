# Restore & Recovery

`restore` removes sk-loadout management for one platform and puts managed skills back.

## Usage

```bash
sk claude restore --dry-run   # preview first
sk claude restore              # full restore
sk claude restore --yes        # skip confirmation
```

> [!WARNING]
> `restore` deletes the platform's sk-loadout store and config. Other platforms are left untouched.

## What Happens

1. Removes all symlinks pointing into the sk-loadout store
2. Migrates each skill: copy to skills directory → delete from store (one at a time — crash-safe)
3. Removes generated slash-command files (`/sk-add`, `/sk-ls`, etc.) placed by `init`
4. Deletes the platform's preset config (marks restore complete)
5. Deletes the store directory if fully migrated, or warns if skills remain

## Recovery Scenarios

### Config is missing

```bash
sk claude init
```

Re-running `init` rebuilds from existing state when possible.

### Broken skill link

```bash
sk claude ls

sk claude use <preset>
```

### Manual backup before recovery

Back up these directories if they exist:

```text
~/.sk-loadout
~/.claude/skills
~/.config/opencode/skills
~/.agents/skills
```
