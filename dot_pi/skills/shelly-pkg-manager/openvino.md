# OpenVINO Backend — Package Matrix & Runtime Config

Context for building packages that depend on Intel OpenVINO acceleration (llama.cpp, etc.).
**This is package/build context only** — not deployment.

Hardware specs: [`~/AGENTS.md#system-specs---onexplayer-super-v`](~/AGENTS.md) (SoC, iGPU, NPU, RAM).
Trade-offs: [`~/AGENTS.md#known-trade-offs`](~/AGENTS.md) — Arc B390 efficiency curve, USB-A/Wi-Fi EMI.

## Minimal Package Matrix

| Accelerator | Package | Source | Notes |
| ------------- | --------- | -------- | ------- |
| GPU (Arc) | `intel-compute-runtime` | extra | Level Zero + OpenCL user-mode driver |
| GPU (Arc) | `intel-graphics-compiler` | extra | LLVM-based kernel compiler |
| NPU | `intel-npu-driver` | AUR | Level Zero Graph Extension for NPU |
| NPU | `intel-npu-compiler` | AUR | NPU blob compiler (needs ~32GB RAM, limit `-j4`) |
| All | `openvino-bin` | AUR | Precompiled runtime — **use this, not `openvino`** |

**`openvino-bin`** provides + replaces: `openvino`, `openvino-intel-gpu-plugin`, `openvino-intel-npu-plugin`.
It installs to `/opt/intel/openvino/`. No compilation needed — avoids multi-hour builds and protobuf/opencv breakage.

### NPU Compiler Memory Constraint

`intel-npu-compiler` can OOM during build. For 48GB systems, limit parallel jobs:

```bash
sed -i 's/cmake --build/cmake --build build --parallel 4 --/' PKGBUILD
makepkg -si
```

## Build-Time CMake Flags

For packages linking against OpenVINO (add to `_cmake_options` in PKGBUILD):

```cmake
-DGGML_OPENVINO=ON
-DOpenVINO_DIR=/opt/intel/openvino/runtime/cmake
```

If the build sources `/opt/intel/openvino/setupvars.sh` — note that this script may fail under modular OpenVINO environments. Prefer explicit `-DOpenVINO_DIR=`.

## Runtime Env Vars (for .conf / env files shipped with the package)

| Device | `GGML_OPENVINO_DEVICE` | `GGML_OPENVINO_STATEFUL_EXECUTION` | `GGML_OPENVINO_CACHE_DIR` |
| -------- | ------------------------ | ------------------------------------- | --------------------------- |
| **GPU** | `GPU` | `1` (**mandatory**) | `/var/cache/openvino` |
| **NPU** | `NPU` | `0` | **omit** (unsupported) |
| **CPU** | `CPU` | `0` | `/var/cache/openvino` |

## Known Issues & Gotchas

### GPU — Stateful Execution (Critical)

**Must** set `GGML_OPENVINO_STATEFUL_EXECUTION=1`. Without it, OpenVINO materializes zero-copy view ops (PERMUTE, TRANSPOSE) as Result nodes, writing transposed bytes back to source memory. This corrupts KV cache — output becomes gibberish. Affects Phi-3, Qwen2.5, and any ISWA model.

Also: 0-element complement-mask tensors in sliding-window attention cause divide-by-zero in the OpenVINO GPU JIT compiler if stateless. Stateful mode avoids this path.

### NPU — Stateless Only

NPU runs stateless. Does **not** support model caching — omit `GGML_OPENVINO_CACHE_DIR` entirely. Otherwise startup hangs or cache writes fail silently.

### Embedding Models (BERT-family)

OpenVINO GGML backend is **decoder-only**. Lacks LayerNorm (`GGML_OP_NORM`) and bare GELU. For embedding/reranking models, omit ALL OpenVINO env vars — operations fall back to CPU.

### openvino vs openvino-bin

- `openvino` (AUR): source build, pulls in clang/llvm/opencv/oneDNN/protobuf. Multi-hour compiles. Frequently broken by toolchain updates.
- `openvino-bin` (AUR): precompiled. Clean install. Always prefer this.

### SYCL Backend Stability

Direct SYCL compute on Panther Lake Xe3 via Level Zero has known regressions (segfaults, compilation hangs). OpenVINO path is validated and stable. Don't use `-DGGML_SYCL=ON` on this hardware.

### Cache Dir Permissions

```bash
sudo mkdir -p /var/cache/openvino && sudo chmod 777 /var/cache/openvino
```

First launch compiles IR graphs — multi-minute latency. Subsequent launches use cached blobs (instant).

## Version History

| Date | Change |
|------|--------|
| 2026-07-10 | Initial: package matrix, device matrix, known issues |
