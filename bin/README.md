# Scripts Rundown

## `garden`
manages dotfiles

### usage
- `garden grow` - initialize/update the garden.
- `garden seed <path> (optional: <to>)` - add file on `path` to the garden. (optionally rename it or move it to a specific path inside the garden).
- `garden list` - list maintained files.
- `garden edit <file>` - search inside the garden and open `<file>` in neovim.
- `garden remove <seed>` - removes `seed` from the garden. `seed` is relative to `~/garden/`.

## `vactivate`
manages python environments in a single directory (`~/.venv/`)