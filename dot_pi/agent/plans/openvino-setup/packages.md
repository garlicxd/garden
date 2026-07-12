# OpenVINO Setup — Package List

> Paired with `original_guide.md`. All verified against shelly 2026-07-12.
> CachyOS repos include `cachyos-core-v3`, `cachyos-extra-v3`, `extra`, `core` — all treated as **repo** (official).

## Install Command (single shot)

```bash
# Repo packages
sudo shelly install --upgrade \
  docker docker-compose \
  bun \
  level-zero-loader level-zero-headers \
  gcc clang cmake make ninja lld git git-lfs \
  intel-compute-runtime intel-graphics-compiler \
  ocl-icd opencl-headers onetbb \
  pugixml flatbuffers protobuf \
  jq

# AUR packages (source builds — see Comparison section below for alternatives)
sudo shelly aur install --upgrade \
  intel-npu-driver \
  intel-npu-compiler \
  openvino openvino-intel-gpu-plugin openvino-intel-npu-plugin
```

---

## Full Package Inventory

### System & Toolchain (repo)

| # | Package | Source | Version | Purpose |
| --- | --------- | -------- | --------- | --------- |
| 1 | `docker` | repo (cachyos-extra-v3) | 1:29.6.1 | Container runtime for OVMS |
| 2 | `docker-compose` | repo (cachyos-extra-v3) | 5.3.1 | Docker Compose plugin for orchestration |
| 3 | `bun` | repo (extra) | 1.3.14 | JS runtime for Pi agent & huggingface-cli |
| 4 | `gcc` | repo (core) | — | C++ compiler |
| 5 | `clang` | repo (extra) | — | C/C++/LLVM compiler toolchain |
| 6 | `cmake` | repo (extra) | — | Build system generator |
| 7 | `make` | repo (core) | — | Build executor |
| 8 | `ninja` | repo (cachyos-extra-v3) | — | Memory-efficient build executor (used by OpenVINO AUR builds) |
| 9 | `lld` | repo (cachyos-extra-v3) | — | LLVM linker — lower memory than GNU ld during AUR source builds |
| 10 | `git` | repo (extra) | — | Version control |
| 11 | `git-lfs` | repo (extra) | — | Large file storage for model weights |
| 12 | `ocl-icd` | repo (cachyos-extra-v3) | — | OpenCL ICD loader (OpenVINO GPU runtime dependency) |
| 13 | `opencl-headers` | repo (extra) | — | OpenCL development headers (build-time) |
| 14 | `onetbb` | repo (cachyos-extra-v3) | — | Intel oneTBB thread scheduler (OpenVINO parallel execution) |
| 15 | `pugixml` | repo (cachyos-extra-v3) | — | XML parser (OpenVINO IR model format) |
| 16 | `flatbuffers` | repo (cachyos-extra-v3) | — | Serialization library (OpenVINO runtime dependency) |
| 17 | `protobuf` | repo (cachyos-extra-v3) | — | Protocol Buffers (OpenVINO model serialization) |
| 18 | `jq` | repo (cachyos-extra-v3) | 1.8.2 | JSON parser for verification scripts |

### Level Zero & GPU Stack (repo)

| # | Package | Source | Version | Purpose |
| --- | --------- | -------- | --------- | --------- |
| 19 | `level-zero-loader` | repo (extra) | 1.28.6 | Level Zero API loader — user-space entry point to GPU/NPU drivers |
| 20 | `level-zero-headers` | repo (extra) | 1.28.6 | Level Zero development headers (build-time) |
| 21 | `intel-compute-runtime` | repo (cachyos-extra-v3) | 26.22.38646.4 | User-mode GPU driver — provides `level-zero-driver` + OpenCL for Arc B390 iGPU |
| 22 | `intel-graphics-compiler` | repo (cachyos-extra-v3) | 1:2.36.3 | LLVM-based IGC kernel compiler for GPU shader JIT |

### NPU Stack (AUR)

| # | Package | Source | Version | Purpose |
|---|---------|--------|---------|---------|
| 23 | `intel-npu-driver` | AUR (dbermond) | 1.33.0 | NPU user-mode driver — Level Zero Graph Extension for Intel AI Boost |
| 24 | `intel-npu-compiler` | AUR (dbermond) | 2026.20rc1 | NPU blob compiler — converts OpenVINO IR to NPU-executable graphs |

> **⚠️ NPU compiler memory**: `intel-npu-compiler` build needs ~32GB RAM. On this 48GB system, limit parallel jobs:
>
> ```bash
> shelly aur search-pkgbuild intel-npu-compiler -j | ...  # inspect PKGBUILD
> # If needed, edit PKGBUILD to add --parallel 4 to cmake --build
> ```
>
> Or export `MAKEFLAGS="-j4"` before the AUR install.

### OpenVINO Runtime — Source Builds (AUR, GCC toolchain)

These three packages together deliver CPU, GPU, and NPU execution. `openvino` is the core runtime; the two plugins link it to the hardware drivers.

| # | Package | Source | Version | Purpose |
| --- | --------- | -------- | --------- | --------- |
| 25 | `openvino` | AUR (dbermond) | 2026.2.1 | Core runtime toolkit with native CPU execution |
| 26 | `openvino-intel-gpu-plugin` | AUR (dbermond) | 2026.2.1 | Compute extension linking OpenVINO to the GPU driver stack (Arc B390 iGPU) |
| 27 | `openvino-intel-npu-plugin` | AUR (dbermond) | 2026.2.1 | Compute extension linking OpenVINO to the NPU driver stack (Intel AI Boost) |

### OpenVINO Runtime — LLVM Variants (AUR, Clang/LLVM toolchain)

Selecting the `-llvm` package variants results in the exact same execution capabilities, with the distinction that the binaries are compiled utilizing the Clang/LLVM toolchain instead of GCC.

| # | Package | Source | Version | Purpose |
| --- | --------- | -------- | --------- | --------- |
| 25a | `openvino-llvm` | AUR (CryoTheRenegade) | 2026.2.1 | Core runtime built with Clang/LLVM |
| 26a | `openvino-llvm-intel-gpu-plugin` | AUR (CryoTheRenegade) | 2026.2.1 | GPU plugin built with Clang/LLVM |
| 27a | `openvino-llvm-intel-npu-plugin` | AUR (CryoTheRenegade) | 2026.2.1 | NPU plugin built with Clang/LLVM |

> **Install either the GCC set or the LLVM set — not both.** The LLVM variants may offer marginally better optimization on CachyOS (which is itself compiled with LLVM/Clang by default), but functionally they are identical.

### Comparison: Source vs Precompiled

| Approach | Packages | Version | Build time | Notes |
| ---------- | ---------- | --------- | ------------ | ------- |
| **Source (GCC)** | `openvino` + `openvino-intel-gpu-plugin` + `openvino-intel-npu-plugin` | 2026.2.1 | Multi-hour | Newest; split into three packages; frequent toolchain breakage risk |
| **Source (LLVM)** | `openvino-llvm` + `openvino-llvm-intel-gpu-plugin` + `openvino-llvm-intel-npu-plugin` | 2026.2.1 | Multi-hour | Same as above but Clang/LLVM compiled; may suit CachyOS better |
| **Precompiled** | `openvino-bin` | 2025.4.0 (older) | Instant | All-in-one; conflicts with the source packages above; clean install but behind by ~2 releases |

---

## Dependency Chain (install order)

```
level-zero-headers ──┐
level-zero-loader  ──┤
                     ├──> intel-npu-driver ──> intel-npu-compiler
intel-graphics-     ──┤
  compiler          ──┤
intel-compute-      ──┘
  runtime

openvino ──> openvino-intel-gpu-plugin + openvino-intel-npu-plugin (AUR source builds)
                      │                    │
          (optdepends on GPU/NPU drivers installed above, detected at runtime)
```

---

## Opt-Depends (not installed by default — install explicitly if needed)

| Package | Opt-Depends | Notes |
| --------- | ------------- | ------- |
| `openvino` | `openvino-intel-gpu-plugin`, `openvino-intel-npu-plugin` | We install these explicitly above |
| `openvino-intel-gpu-plugin` | `openvino` | Required parent package |
| `openvino-intel-npu-plugin` | `openvino` | Required parent package |
| `intel-npu-driver` | `intel-npu-compiler` | We install this explicitly |
| `intel-compute-runtime` | `libdrm`, `libva` | Typically already present on CachyOS desktop |

---

## NOT Needed (excluded)

| Package | Reason |
| --------- | -------- |
| `intel-npu-driver-git` | Guide originally suggested this; stable `intel-npu-driver` 1.33.0 is newer and preferred |
| `openvino-bin` | Precompiled but older (2025.4.0 vs 2026.2.1 source); use source packages unless build time is unbearable |
| `openvino-git` / `openvino-intel-gpu-plugin-git` / `openvino-intel-npu-plugin-git` | Git snapshots; stable AUR releases preferred |
| `intel-compute-runtime-bin` (AUR) | `intel-compute-runtime` is in the repo (cachyos-extra-v3), use that |
| `intel-graphics-compiler-bin` (AUR) | `intel-graphics-compiler` is in the repo (cachyos-extra-v3), use that |
| `level-zero-loader-git` (AUR) | Stable `level-zero-loader` 1.28.6 is in extra repo |

---

## Post-Install (from guide, not shelly)

```bash
# 1. Add user to render group
sudo usermod -a -G render $USER

# 2. Persistent udev rule for NPU
echo 'SUBSYSTEM=="accel", KERNEL=="accel*", GROUP="render", MODE="0660"' | sudo tee /etc/udev/rules.d/10-intel-vpu.rules

# 3. Reload udev
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=accel

# 4. Enable docker
sudo systemctl enable --now docker.service

# 5. OpenVINO cache dir (for GPU model compilation cache)
sudo mkdir -p /var/cache/openvino && sudo chmod 777 /var/cache/openvino
```

---

## Verification Commands

```bash
# Check NPU detected
lspci -knnd ::1200
journalctl -kg intel_vpu

# Check GPU detected
ls -l /dev/dri/render*

# Check NPU device node
ls -l /dev/accel/accel0

# Check docker running
docker info

# Check OpenVINO installed
ls /opt/intel/openvino/
```
