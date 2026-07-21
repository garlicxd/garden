# Plan: Install OpenVINO Runtime + Plugins

## Current State

**Already installed** (repo): docker, bun, gcc, clang, git, lld, make, ninja, jq, ocl-icd, onetbb, protobuf

**Missing — repo (9 packages):**

- `cmake` — build system
- `flatbuffers` — serialization (OpenVINO dep)
- `git-lfs` — large file support for model repos
- `intel-compute-runtime` — GPU user-mode driver (Level Zero + OpenCL)
- `intel-graphics-compiler` — GPU kernel compiler
- `level-zero-loader` — Level Zero API loader
- `level-zero-headers` — Level Zero dev headers
- `opencl-headers` — OpenCL dev headers
- `pugixml` — XML parser (IR model format)

**Missing — AUR (5 packages):**

- `intel-npu-driver` — NPU user-mode driver (dep: level-zero-loader, level-zero-headers)
- `intel-npu-compiler` — NPU blob compiler (dep: cmake, git, git-lfs, ninja, python)
- `openvino` — core OpenVINO runtime (dep: onetbb, pugixml)
- `openvino-intel-gpu-plugin` — GPU compute plugin (dep: openvino, intel-compute-runtime)
- `openvino-intel-npu-plugin` — NPU compute plugin (dep: openvino, intel-npu-driver)

---

## Steps

- [x] **1. Install repo packages** — ✅ done (9/9 installed) — 9 packages via shelly
      *Dependencies:* none (all standalone)
      *Files touched:* system packages only
      *Rollback:* `sudo shelly remove cmake flatbuffers git-lfs intel-compute-runtime intel-graphics-compiler level-zero-loader level-zero-headers opencl-headers pugixml`

- [x] **2. Install NPU stack (AUR)** — ✅ done (intel-npu-driver 1.33.0 + intel-npu-compiler 2026.20rc1) — intel-npu-driver + intel-npu-compiler
      *Dependencies:* step 1 (needs cmake, level-zero-headers, git-lfs, ninja)
      *Files touched:* system packages only
      *Build time:* ~30min (intel-npu-compiler is heavy, ~32GB RAM needed)
      *Rollback:* `sudo shelly aur remove intel-npu-driver intel-npu-compiler`

- [x] **3. Install OpenVINO runtime + plugins (AUR)** — ✅ done (all 2026.2.1-2) — openvino, openvino-intel-gpu-plugin, openvino-intel-npu-plugin
      *Dependencies:* steps 1, 2 (needs drivers + level-zero)
      *Files touched:* system packages; installs to `/usr/` (headers: /usr/include/openvino/, libs: /usr/lib/, plugins: /usr/lib/openvino/)
      *Build time:* 2-4 hours (source compilation with CPU/GPU/NPU backends)
      *CMake:* `OpenVINO_DIR=/usr/lib/cmake/openvino/`
      *Rollback:* `sudo shelly aur remove openvino openvino-intel-gpu-plugin openvino-intel-npu-plugin`

- [x] **4. Post-install config** — ✅ done (render group, udev, docker, cache dir) — udev rules, user groups, Docker, cache dir
      *Dependencies:* steps 1–3
      *Rollback:* reverse each command (remove udev rule, remove user from render group, etc.)

- [x] **5. Verify** — ✅ done
      *CPU:* Intel Core Ultra X7 358H ✅
      *GPU:* Intel Arc B390 GPU (iGPU) ✅
      *NPU:* Intel AI Boost ✅ (needs re-login for render group)
      *OpenVINO:* Python openvino 2026.2.1 ✅

---

## Build Safety

The AUR packages compile from source. On this 16-core system (48GB RAM), need to prevent OOM:

```bash
export MAKEFLAGS="-j4"
export CMAKE_BUILD_PARALLEL_LEVEL=4
export CXXFLAGS="--param ggc-min-expand=10 --param ggc-min-heapsize=32768"
export LDFLAGS="-fuse-ld=lld"
```

If the `intel-npu-compiler` or `openvino` builds OOM, we can add a swap file:

```bash
sudo dd if=/dev/zero of=/swapfile bs=1M count=16384
sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
```
