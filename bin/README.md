# Scripts Rundown

## `garden`
manages dotfiles

### usage
- `garden seed <path> (optional: <to>)` - add file on `path` to the garden. (optionally rename it to something more obvious).
- `garden remove <seed>` - removes `seed` from the garden. `seed` is relative to `~/garden/`.
- `garden grow` - initialize/update the garden.
- `garden list` - list maintained files.

## `vactivate`
manages python environments in a single directory (`~/.venv/`)