# llama.cpp — Build Recipes & Hardware-Specific Config

Context for building customized llama.cpp packages for the OneXPlayer Super V (Panther Lake / Intel Arc B390).
**This is package/build context only** — not model deployment or runtime execution.

## Hardware Profile

Authoritative specs: [`~/AGENTS.md#system-specs---onexplayer-super-v`](~/AGENTS.md).
Relevant trade-offs: [`~/AGENTS.md#known-trade-offs`](~/AGENTS.md) — Arc B390 efficiency peaks at 35–40W; 65W TDP yields diminishing GPU returns.

| Component | Spec | Implication |
| ----------- | ------ | ------------- |
| SoC | Core Ultra X7 358H (Panther Lake) | `-march=native` targets Panther Lake |
| CPU | 16C/16T (4P+8E+4LPE) | `-j$(nproc)` = 16 threads, memory-heavy builds may need fewer |
| GPU | Arc B390 (Xe3, 12 Xe-cores) | Use `xe` KMD, not legacy `i915` |
| NPU | 50 TOPS (exposed as `/dev/accel/accel0`) | Requires `intel_vpu` kernel module |
| RAM | 48 GB LPDDR5X @ 8533 MT/s | Enough for `intel-npu-compiler` (min 32GB); limit to `-j4` for safety |

## AUR PKGBUILD Injection Points

The `llama.cpp-git` AUR package uses these real injection points:

### 1. `_cmake_options` array (primary)

Inject **before** the `cmake "${_cmake_options[@]}"` call at the end of `build()`:

```bash
_cmake_options+=(-DGGML_OPENVINO=ON)
_cmake_options+=(-DOpenVINO_DIR=/opt/intel/openvino/runtime/cmake)
```

### 2. `aur_llamacpp_cmakeopts` env var (alternative)

```bash
export aur_llamacpp_cmakeopts="-DGGML_OPENVINO=ON"
```

The PKGBUILD checks for this and appends it automatically. Safer than editing — no file change needed.

### 3. `depends=()` array

Add runtime deps:

```bash
'openvino-bin'
```

### 4. `makedepends=()` array

Add build-time deps:

```bash
'openvino-bin'
```

### 5. Source files

The PKGBUILD ships `llama.cpp.conf` and `llama.cpp.service` — edit these for runtime env vars (see openvino.md).

### 6. `.install` hook

`install="${pkgname}.install"` — root-executed script. Always audit before building.

## Custom PKGBUILD Template (Minimal)

For a standalone package that doesn't track AUR:

```bash
pkgname=llama.cpp-openvino-git
_pkgname=llama.cpp
pkgver=r$(date +%s)
pkgrel=1
pkgdesc="llama.cpp with OpenVINO backend"
arch=('x86_64')
url="https://github.com/ggml-org/llama.cpp"
license=('MIT')
depends=('openvino-bin' 'curl' 'gcc-libs' 'glibc')
makedepends=('git' 'cmake' 'ninja')
provides=('llama.cpp')
conflicts=('llama.cpp' 'llama.cpp-git')
source=("git+https://github.com/ggml-org/llama.cpp.git")
sha256sums=('SKIP')  # VCS package — use SKIP

pkgver() {
  cd "${srcdir}/${_pkgname}"
  printf "r%s.%s" "$(git rev-list --count HEAD)" "$(git rev-parse --short HEAD)"
}

build() {
  cmake -G Ninja -B build -S "${srcdir}/${_pkgname}" \
    -DCMAKE_BUILD_TYPE=Release \
    -DBUILD_SHARED_LIBS=ON \
    -DLLAMA_BUILD_TESTS=OFF \
    -DGGML_OPENVINO=ON \
    -DOpenVINO_DIR=/opt/intel/openvino/runtime/cmake \
    -DGGML_NATIVE=ON
  cmake --build build
}

package() {
  cmake --install build --prefix /usr --destination "${pkgdir}"
}
```

**Don't** use `source /opt/intel/openvino/setupvars.sh` — it can fail under modular installs. Use `-DOpenVINO_DIR=` directly.

## Compiler Optimization Flags

In `/etc/makepkg.conf` (or `~/.makepkg.conf`):

```bash
CFLAGS="-march=native -O3 -pipe -fno-plt"
CXXFLAGS="$CFLAGS"
MAKEFLAGS="-j$(nproc)"  # override for memory-heavy builds
```

`-march=native` on Panther Lake enables AVX-512, AMX, and other ISA extensions automatically.

## Known Build Issues

| Issue | Cause | Fix |
| ------- | ------- | ----- |
| `cc1plus: fatal error: Killed` | OOM during parallel compile | Reduce `-j` (e.g., `MAKEFLAGS="-j4"`) |
| `openvino` source build fails | protobuf/opencv version mismatch | Use `openvino-bin` instead |
| `setupvars.sh` fails | Modular OpenVINO lacks legacy script | Use explicit `-DOpenVINO_DIR=` in cmake |
| SYCL backend segfaults | Panther Lake Xe3 regressions | Don't use `-DGGML_SYCL=ON`. Use OpenVINO path |
| `llama.cpp-openvino` AUR package stale | Flagged out-of-date at b9222-1 | Don't use standalone package. Build `llama.cpp-git` with injected flags |
| `convert_hf_to_gguf.py` missing deps | Python deps in `optdepends` not installed | Install: `python-numpy python-torch python-sentencepiece python-transformers` |

## Persistent Custom Builds (Local Repo)

To keep a customized build from being overwritten by `shelly upgrade`:

```bash
# 1. Create local repo directory
sudo mkdir -p /var/lib/custom-repo

# 2. Add to /etc/pacman.conf
# [custom-ai]
# SigLevel = Optional TrustAll
# Server = file:///var/lib/custom-repo

# 3. After building, copy + register
cp llama.cpp-openvino-git-*.pkg.tar.zst /var/lib/custom-repo/
repo-add /var/lib/custom-repo/custom-ai.db.tar.gz \
  /var/lib/custom-repo/llama.cpp-openvino-git-*.pkg.tar.zst

# 4. Shelly will now treat it as a native repo package
sudo shelly sync
```

The local repo takes priority over AUR — Shelly won't replace your customized build.

## Version History

| Date | Change |
|------|--------|
| 2026-07-10 | Initial: injection points, custom PKGBUILD template, build issues, local repo setup |
