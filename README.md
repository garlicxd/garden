# Garden dotfiles
The home of my dotfiles.

## Installing Arch
[reference tutorial](https://github.com/powerdollkirby/archinstall/blob/main/README.md)
### Mount Partitions
Replace boot partition and root partition with a path from lsblk. The root partition has to be mounted first.
```
lsblk
cfdisk
mkfs.btrfs -f /dev/root-partition
mkfs.fat -F32 /dev/boot-patition
Mount root partition first
mount /dev/root-partition /mnt
mount /dev/boot-partition /mnt/boot --mkdir
findmnt
```

#### Mount Media Disk
If done before system install:
```
pacman -S ntfs-3g
mount /dev/media-partiton /media/something
```

If done after, an entry has to be made in `/etc/fstab`:
```
# run and copy the UUID of desired partition
lsblk -f
sudo nvim /etc/fstab
# <device> <dir>            <type> <dump> <fsck>
#  UUID,   /media/something, ntfs,  0,     0
```
### Archinstall
Run `archinstall` and choose the desired system settings.

| Key                   | Value                  |
| --------------------- | ---------------------- |
| Disk Configuration    | use premounted on /mnt |
| Bootloader            | grub                   |
| Additional packages   | `sudo`                 |
| Swap                  | True if low ram        |
| Profile               | dont                   |
| Audio                 | Pipewire               |
| Kernels               | linux                  |
| Network config        | Use network manager    |
| Optional Repositories | multilib for gaming    |
|                       |                        |
### grub
Based on `/etc/default/grub`, the grub configuration can be generated by:
```
sudo grub-mkconfig -o /boot/grub/grub.cfg
```
#### Dual Boot
```
sudo mount /dev/second-boot-partition /boot/windows
sudo pacman -S os-prober
```
To make `grub-mkconfig` run `os-prober`, uncomment `GRUB_DISABLE_OS_PROBER=false` in the config `/etc/default/grub`.
```
sudo grub-mkconfig -o /boot/grub/grub.cfg
```
###  Setup git
- [ ] [Generating a new SSH key and adding it to the ssh-agent](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent)

### Dotfiles
Install [dotfiles](https://github.com/garlicxd/garden).
1. run `cd && sudo pacman -S git && git clone https://github.com/garlicxd/garden.git && chmod +x ~/garden/init`
2. run `garden grow`
3. run `install_packages`

## TODO
- [ ] configure theme consistently
    - [ ] gtk theme
- [ ] waiting for fabric to have a normal pkgbuild
- [X] configure a consistent font: noto or nerd noto. For mono: roboto.
- [X] shell script to handle dotfiles in a single folder and log symlinks
- [X] shell script to restore sylinks from the log
