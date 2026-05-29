# Windows Notes

## Symlinks

Windows handles symlinks differently from macOS and Linux.

**Directory skills** use junctions — they work in normal user sessions without Developer Mode.

**File skills** use standard file symlinks and may require Developer Mode or Administrator.

> [!WARNING]
> If you see this error, enable **Developer Mode** in Windows Settings or run the terminal as Administrator:
>
> ```
> Failed to create symlink. Enable Developer Mode in Windows Settings or run as Administrator.
> ```

## Recommended Setup

1. Use a terminal with normal user permissions first
2. Enable Developer Mode if file symlinks fail
3. Preview restore with `--dry-run` before recovery
4. Use explicit platform commands when several assistants are installed
