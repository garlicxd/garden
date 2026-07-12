Architecture and Heterogeneous Deployment of OpenVINO Model Server and Pi Coding Agent on the OneXPlayer Super VHardware Profile of the OneXPlayer Super V and Architectural AnalysisThe computational landscape of portable workstations has expanded with the introduction of Intel's Panther Lake microarchitecture, exemplified by the OneXPlayer Super V gaming tablet. This hardware platform integrates general-purpose execution, vector-accelerated graphics, and spatial tensor processing into a single thermal envelope. The system is powered by the Intel Core Ultra X7 358H processor, which uses a hybrid core topology optimized for low-latency scheduling and parallel efficiency.Computational ComponentHardware Architecture ProfileCentral Processing Unit (CPU)Intel Core Ultra X7 358H (4 Performance Cores, 8 Efficient Cores, 4 Low-Power Efficient Cores; 16 Cores Total, up to 4.8 GHz Turbo)Integrated Graphics Processing Unit (iGPU)Intel Arc B390 (Xe3 architecture, 12 Execution Units, clocked up to 2.5 GHz)Neural Processing Unit (NPU)Intel AI Boost (Dedicated tensor accelerator, delivering up to 50 TOPS)Platform Memory Infrastructure48GB Unified LPDDR5X operating at 8533 MT/s (dual-channel configuration)System Storage Layout1TB PCIe 4.0 NVMe M.2 2280 SSD with high-speed external Mini SSD expansionThermal Dissipation ArchitectureDual-fan active cooling system supporting a variable power budget up to 60W/65W TDPTarget Operating SystemCachyOS Linux (Arch Linux derivative with x86-64-v3/v4 optimization)A key architectural feature of the OneXPlayer Super V is its unified memory subsystem. Unlike discrete computing systems with dedicated VRAM, the Intel Arc B390 iGPU and the Intel AI Boost NPU share the 48GB LPDDR5X system memory. This shared architecture eliminates the need to copy weights between CPU and GPU memory spaces, allowing large models to fit within the system memory.However, this design also introduces potential bottlenecks. High-throughput execution can trigger physical memory allocation limits or cause memory bus contention between the host operating system, the NPU, and the iGPU. Level Zero, the low-level programming interface used to manage Intel graphics and accelerator runtimes, imposes a default 4GB limit on single contiguous memory buffer allocations. Serving large language models requires bypassing this limit to prevent system-wide memory allocation failures.Heterogeneous AI Serving Strategy and Silicon Allocation MatrixTo maximize the system's 172 combined platform TOPS, inference workloads must be distributed across the hardware based on each model's structure. This heterogeneous approach assigns the primary reasoning model to the iGPU and the multimodal processing model to the NPU.+-----------------------------------------------------------------------------------+
|                            HETEROGENEOUS WORKLOAD PATH                            |
|                                                                                   |
|                           [Pi Coding Agent TUI client]                            |
|                                        |                                          |
|                                        v                                          |
|                         [OpenVINO Model Server (OVMS)]                            |
|                                        |                                          |
|                  +---------------------+---------------------+                    |
|                  | (Endpoint Port 8000)                      | (Endpoint Port 8001)   |
|                  v                                           v                    |
|          [Qwen3.6-35B-A3B]                           [Qwen2.5-Omni-3B]            |
|                  |                                           |                    |
|                  v                                           v                    |
|         [Intel Arc B390 iGPU]                       [Intel AI Boost NPU]          |
|      High Memory Bandwidth MoE                     Energy-Efficient Vision/Audio  |
+-----------------------------------------------------------------------------------+
Model 1: Qwen3.6-35B-A3B on the Integrated Graphics Processing Unit (iGPU)The Qwen3.6-35B-A3B is an advanced Mixture-of-Experts (MoE) model featuring 35 billion total parameters, with 3 billion active per inference token. MoE models require substantial memory bandwidth to dynamically route tokens to active experts. The Arc B390 iGPU, backed by LPDDR5X running at 8533 MT/s, provides the high memory bandwidth needed for efficient MoE expert activation. The iGPU's vector engines and matrix accelerators (Xe Matrix Extensions) are highly efficient at executing the sparse General Matrix Multiplications (GEMMs) that power MoE models.Model 2: Qwen2.5-Omni-3B on the Neural Processing Unit (NPU)The Qwen2.5-Omni-3B is a unified, end-to-end multimodal model designed for real-time speech, audio, image, and text processing. The Intel NPU is a dedicated tensor accelerator designed to run continuous, low-latency background operations with minimal power consumption. Allocating Qwen2.5-Omni-3B to the NPU is ideal for real-time multi-sensory tasks. This model’s 3-billion-parameter architecture makes it a perfect fit for the NPU’s static execution requirements, ensuring high power efficiency and freeing up the iGPU's resources for heavier reasoning tasks.The mathematical relationship governing the system's memory pressure under this heterogeneous model is modeled by:$$M_{\text{system}} = M_{\text{OS}} + M_{\text{serving}} + M_{\text{cache}}$$$$M_{\text{serving}} = M_{\text{Omni\_Static}} + M_{\text{MoE\_Static}}$$$$M_{\text{cache}} = M_{\text{Omni\_KV}} + M_{\text{MoE\_KV}}$$To avoid system out-of-memory (OOM) situations, $M_{\text{system}}$ must remain under the 48GB physical memory limit. The static memory footprints are calculated based on model size and quantization:$$M_{\text{Omni\_Static}} \approx \frac{3.09 \times 10^9 \times 4 \text{ bits}}{8 \text{ bits/byte}} \approx 1.55\text{ GB (quantized base weights)}$$$$M_{\text{MoE\_Static}} \approx \frac{35.0 \times 10^9 \times 4 \text{ bits}}{8 \text{ bits/byte}} \approx 17.50\text{ GB (quantized base weights)}$$This brings the combined static memory requirement for serving both models to approximately 19.05GB. Adding runtime drivers, shared system memory buffers, and the operating system overhead leaves more than 20GB of RAM available for dynamic KV caches. This headroom allows the models to handle deep context lengths during active coding sessions.Host OS Configuration and Environment Alignment via ShellyThe host operating system is CachyOS, a modern Arch Linux-based distribution optimized for high-performance computing. The June 2026 release of CachyOS replaced the paru AUR helper with shelly as the recommended default package manager. Unlike other package managers that act as wrappers around standard tools, shelly interfaces directly with libalpm (the Arch Linux Package Manager library). This native C++ architecture improves package management reliability and speed.To enable low-level hardware access, the system uses the mainline intel_vpu (IVPU) kernel driver. This driver exposes the physical NPU interface via the standard Linux Direct Rendering Manager (DRM) accelerator path under /dev/accel/accel0.User-space runtimes communicate with the hardware using the Level Zero loader library. This driver stack is critical: if the drivers, kernel modules, firmware, and Level Zero libraries do not align, the system may fail to detect the NPU or suffer significant performance loss.Host Configuration ComponentConfiguration Path and System InterfaceSystem Package Managershelly (libalpm-native command line interface)Kernel Drive Moduleintel_vpu / ivpu (Kernel 6.2+ mainline tree)Hardware Node Permissions/dev/dri/renderD128 (iGPU) and /dev/accel/accel0 (NPU)Target Security Grouprender (System ID mapped to accelerator access)System Services Daemondocker.service (Systemd execution lifecycle)Corrected System Package Alignment (Repository vs. AUR)Using the precompiled openvino-bin AUR package is not recommended because its outdated dependency bindings conflict with standard core libraries (specifically introducing onetbb runtime path injection issues that break other system binaries).For maximum performance, clean compilation hooks, and complete architectural compatibility across all three execution devices, compile the core runtime directly from source.Bash# Perform a complete system synchronization and upgrade the CachyOS package databases
shelly

# Install Docker container orchestration, the Bun runtime, build environments, and Level Zero interfaces

shelly install --upgrade docker bun level-zero-loader level-zero-headers gcc clang cmake ninja lld git git-lfs intel-compute-runtime intel-graphics-compiler ocl-icd opencl-headers onetbb pugixml flatbuffers yaml-cpp protobuf jq

# Install the NPU driver and compiler stack from the AUR (User-space components)

shelly install --upgrade intel-npu-driver-git intel-npu-compiler-git
To grant the active user account permission to interact directly with the NPU (/dev/accel/accel0) and iGPU (/dev/dri/render*) interfaces, add the user to the render system group:Bashsudo usermod -a -G render $USER
Next, configure a persistent udev rule. This ensures that the NPU character device retains the correct group ownership and read/write permissions across system reboots:Bashsudo bash -c "echo 'SUBSYSTEM==\"accel\", KERNEL==\"accel*\", GROUP=\"render\", MODE=\"0660\"' > /etc/udev/rules.d/10-intel-vpu.rules"
Reload the udev daemon to apply these hardware permission rules immediately:Bashsudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=accel
Finally, configure the Docker systemd unit to start automatically on system boot, and launch the service:Bashsudo systemctl enable --now docker.service
Dockerized OpenVINO Model Server IntegrationThe OpenVINO Model Server (OVMS) is a high-performance serving system written in C++. It exposes standardized gRPC and REST endpoints that are fully compatible with the OpenAI API.+-------------------------------------------------------------------------------------+
|                             CONTAINER RUNTIME ISOLATION                             |
|                                                                                     |
|   +-----------------------------------------------------------------------------+   |
|   |                       OpenVINO Model Server Container                       |   |
|   |                                                                             |   |
|   |     +-------------------------+             +-------------------------+     |   |
|   |     |    qwen-moe Endpoint    |             |   qwen-omni Endpoint    |     |   |
|   |     |      (iGPU Execution)   |             |      (NPU Execution)     |     |   |
|   |     +------------+------------+             +------------+------------+     |   |
|   |                  |                                       |                  |   |
|   +------------------+---------------------------------------+------------------+   |
|                      |                                       |                      |
|                      | Mapped Devices                        | Mapped Devices       |
|                      v                                       v                      |
|             [/dev/dri/renderD128]                  [/dev/accel/accel0]              |
|                      |                                       |                      |
|                      v                                       v                      |
|               [Intel Arc iGPU]                     [Intel AI Boost NPU]             |
+-------------------------------------------------------------------------------------+
Unified Configuration ArchitectureUsing a single multi-model configuration file enables OVMS to serve both models simultaneously from the same container instance. In accordance with organization layouts, deployment configurations and server code are kept under ~/Documents/colony/ while model weights reside in ~/Documents/colony/models/.Create the required directories on the host system:Bashmkdir -p $HOME/Documents/colony
mkdir -p $HOME/Documents/colony/models/qwen-moe/1
mkdir -p $HOME/Documents/colony/models/qwen-omni/1
Create the following multi-model routing configuration file and save it as ~/Documents/colony/config.json:JSON{
  "model_config_list": [
    {
      "config": {
        "name": "qwen-moe",
        "base_path": "/workspace/models/qwen-moe",
        "target_device": "GPU",
        "plugin_config": {
          "PERFORMANCE_HINT": "LATENCY",
          "KEY_VALUE_CACHE_PRECISION": "u8"
        }
      }
    },
    {
      "config": {
        "name": "qwen-omni",
        "base_path": "/workspace/models/qwen-omni",
        "target_device": "NPU",
        "plugin_config": {
          "PERFORMANCE_HINT": "LATENCY"
        },
        "batch_size": "1"
      }
    }
  ]
}
Docker Compose OrchestrationThe deployment runs within the openvino/model_server:latest-gpu container image. This specialized build includes the required user-space drivers and dependencies for Intel graphics card runtimes and NPU compilation interfaces.Create the following file as ~/Documents/colony/docker-compose.yml:YAMLversion: '3.8'

services:
  ovms-server:
    image: openvino/model_server:latest-gpu
    container_name: ovms-heterogeneous-serving
    ports:
      - "8000:8000"  # OpenAI REST Endpoint mapping
      - "9000:9000"  # gRPC mapping
    volumes:
      - /home/user/Documents/colony/config.json:/workspace/config.json:ro
      - /home/user/Documents/colony/models:/workspace/models:ro
    devices:
      - /dev/dri:/dev/dri
      - /dev/accel/accel0:/dev/accel/accel0
    environment:
      # Required to allocate memory blocks larger than 4GB over Level-Zero
      - UR_L0_ENABLE_RELAXED_ALLOCATION_LIMITS=1
      # Explicitly choose the Level-Zero index for the Intel Arc B390 GPU
      - ONEAPI_DEVICE_SELECTOR=level_zero:0
      # Optimize Level Zero pipelines using immediate command execution lists
      - SYCL_PI_LEVEL_ZERO_USE_IMMEDIATE_COMMANDLISTS=1
      # Enable telemetry collection for system metrics
      - ZES_ENABLE_SYSMAN=1
    user: "${UID}:${GID}"
    group_add:
      - "${RENDER_GID}"
    restart: always
    command: >
      /ovms/bin/ovms
      --config_path /workspace/config.json
      --port 9000
      --rest_port 8000
Before running the container, read the render group ID from the host environment to ensure correct access permissions:Bashexport UID=$(id -u)
export GID=$(id -g)
export RENDER_GID=$(stat -c "%g" /dev/dri/render* | head -n 1)
Launch the model server container in detached background mode:Bashdocker compose -f $HOME/Documents/colony/docker-compose.yml up -d
System Stability Hazards and Preventative EngineeringDeploying high-parameter model pipelines on memory-constrained mobile hardware introduces potential failure modes. Managing memory usage and resource allocation is key to maintaining system stability.Hazard A: Build Interruptions due to Concurrent Process Memory StarvationCompiling template-heavy C++ applications or building the OpenVINO core libraries directly from source on high-core-count processors (such as the 16-core Intel Core Ultra X7) introduces thread-level resource competition. When using standard unconstrained build instructions (e.g., make -j$(nproc)), the build system attempts to spin up 16 concurrent compilation processes.Because compiling heavy C++ translation units regularly requires 2GB to 4GB of RAM per core, initiating too many parallel tasks quickly starves the toolchain processes of resources. This memory starvation triggers compiler-level exits, throwing virtual memory exhausted: Cannot allocate memory or causing the compiler to segfault and crash, halting the build prematurely even if the host operating system remains fully responsive.Preventative OverridesTo prevent parallel compiler tasks from starving each other of memory and causing build halts, the compilation environment must be configured to balance thread counts with the physical memory envelope (ideally limiting jobs to at least 4GB of RAM per concurrent core). Additionally, compiling with clang and linking with LLVM lld decreases transient memory allocation overhead:Bash# Force the CMake generator to use Ninja (significantly more memory-efficient than GNU Make)

# and instruct the compiler to use LLD instead of standard GNU ld, which cuts linking RAM overhead

export LDFLAGS="-fuse-ld=lld"

# Clamp parallel compilation threads globally to prevent concurrent process crashes

export MAKEFLAGS="-j4"
export CMAKE_BUILD_PARALLEL_LEVEL=4

# Force the GCC/Clang compiler to run its internal garbage collector more aggressively

export CXXFLAGS="--param ggc-min-expand=10 --param ggc-min-heapsize=32768"
To provide extra runtime stability, set up a temporary swap file inside CachyOS to absorb any remaining virtual memory allocation spikes:Bashsudo dd if=/dev/zero of=/swapfile bs=1M count=16384 status=progress
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
Hazard B: Coherence Breakdown in Qwen3.6-35B-A3B MoE QuantizationCompressing Mixture-of-Experts architectures to standard 4-bit formats can degrade reasoning capabilities. If the routing layers and attention heads are heavily quantized, the model's token routing mechanisms fail. This often leads to coherence issues, causing the model to repeat tokens or output repetitive text on longer contexts.Preventative OverridesTo preserve reasoning quality and output coherence, apply selective quantization during the model export phase. Linear attention heads and routing layers must be exempted from INT4 quantization.If building custom C++ model transformation layers, configure the export settings to keep critical routing and attention weights at INT8 precision:Bash--ignored_scope '.*shared_expert.*|.*attn.*'
This hybrid-precision approach keeps the dense reasoning blocks of the model highly accurate while quantizing the feed-forward experts to 4-bit, ensuring both low memory usage and high-quality generation.Hazard C: NPU Shape Dynamics and Buffer RestrictionsUnlike iGPUs, which support dynamic memory allocation and variable shapes, the Intel AI Boost NPU compiler operates with strict static tensor boundaries. If an input prompt changes the model's sequence length, the compiler may trigger a runtime compilation loop, causing severe latency spikes.Preventative OverridesTo avoid dynamic shape issues, configure the NPU execution pipeline with fixed input and output shapes. Pad input sequences to a static context boundary (such as 1024 or 2048 tokens) and enforce a static batch size of 1 in your deployment configuration.Heterogeneous OpenVINO C++ Compilation Flag MatrixTo compile the OpenVINO core runtime manually from source with active parallel hardware optimization hooks across CPU, GPU, and NPU devices, CMake must be invoked with explicit hardware-enablement plugins:CMake Build-Configuration FlagTarget Execution and Plugin Lifecycle-DENABLE_INTEL_CPU=ONCompiles the target x86-64 vectorized CPU runtime fallback engine.-DENABLE_INTEL_GPU=ONCompiles the Intel GPU compute plugin (executes over dynamic oneDNN and Level Zero).-DENABLE_INTEL_NPU=ONCompiles the Intel Neural Processing Unit Level Zero execution compiler.-DTHREADING=TBBForces core pipeline loops to process over the system-wide Intel oneTBB thread scheduler.-DENABLE_LTO=ONEnables global link-time optimization; decreases output binary payload footprints by up to 30%.-DENABLE_PYTHON=OFFSkips Python interpreter overheads to yield a native, python-free C++ API binary footprint.Comprehensive Guide and Prompt for LLM ExecutionThe following block contains a step-by-step setup guide and automation prompt. It is designed to be copied and pasted directly into an AI coding assistant or deployment agent to automate the system configuration, model compilation, and container orchestration process.You are an expert AI systems engineer and C++ deployment automation agent. Your task is to set up a heterogeneous LLM deployment on an Intel Panther Lake system (the OneXPlayer Super V) running CachyOS. You will install OpenVINO from AUR (source-compiled via shelly), compile a dedicated high-performance inference launcher in C++, configure the OpenVINO Model Server (OVMS) in a Docker container to serve Qwen3.6-35B-A3B on the iGPU and Qwen2.5-Omni-3B on the NPU, then bridge these models to the local Pi Coding Agent client.Ensure all commands use only the 'shelly' package manager for system packages, 'docker' for container orchestration, 'bun' for the JavaScript tooling, and native C++ for inference execution and tools. Host configurations, composing stacks, and server scripts reside in ~/Documents/colony/ and model weights reside in ~/Documents/colony/models/. Follow these steps exactly:=========================================
STEP 1: HOST ENVIRONMENT PREPARATION1.1 Verify physical hardware detection of the NPU and Arc GPU:lspci -knnd ::1200journalctl -kg intel_vpu1.2 Install C++ compilers, Ninja build tool, linker tools, Bun runtime, and system packages via Shelly:shelly install --upgrade docker docker-compose bun level-zero-loader level-zero-headers gcc clang cmake make ninja lld git git-lfs intel-compute-runtime intel-graphics-compiler ocl-icd opencl-headers onetbb pugixml flatbuffers protobuf jq
shelly aur install --upgrade intel-npu-driver intel-npu-compiler openvino openvino-intel-gpu-plugin openvino-intel-npu-plugin1.3 Configure persistent udev rules for the NPU device node:echo 'SUBSYSTEM=="accel", KERNEL=="accel*", GROUP="render", MODE="0660"' | sudo tee /etc/udev/rules.d/10-intel-vpu.rules1.4 Add the user to the render group and reload the udev subsystem:sudo usermod -a -G render $USERsudo udevadm control --reload-rulessudo udevadm trigger --subsystem-match=accel1.5 Enable and start the Docker systemd unit:sudo systemctl enable --now docker.service=========================================
STEP 2: PREVENTING PARALLEL BUILD CRASHES AND COMPILER MEMORY EXHAUSTION2.1 To prevent the build toolchain from crashing with "virtual memory exhausted" or compiler segfaults, avoid using unconstrained parallel build commands like make -j$(nproc). Guard the build by limiting concurrent processes (allocating at least 4GB of RAM per active core to satisfy memory-intensive compiler threads).2.2 Initialize a temporary swap space on the host SSD to absorb peak compiler memory usage:sudo dd if=/dev/zero of=/swapfile bs=1M count=16384 status=progresssudo chmod 600 /swapfilesudo mkswap /swapfilesudo swapon /swapfile2.3 Export environment variables to use Clang and LLD (significantly more memory-efficient), clamp memory pools, and restrict parallel compilation threads:export CC=clangexport CXX=clang++export LDFLAGS="-fuse-ld=lld"export MAKEFLAGS="-j4"export CMAKE_BUILD_PARALLEL_LEVEL=4export CXXFLAGS="--param ggc-min-expand=10 --param ggc-min-heapsize=32768"=========================================
STEP 3: OPENVINO RUNTIME (INSTALLED VIA AUR IN STEP 1.2)
3.1 The OpenVINO runtime, GPU plugin, and NPU plugin were installed from AUR in Step 1.2
    (packages: openvino, openvino-intel-gpu-plugin, openvino-intel-npu-plugin).
    These compile from source with all hardware backends enabled (CPU, GPU, NPU).
    Installed to: /opt/intel/openvino/
    Build time: 2-4 hours. Ensure MAKEFLAGS="-j4" is set before starting Step 1.2.

    The compiled runtime provides the same cmake config as a manual build:
    OpenVINO_DIR=/opt/intel/openvino/runtime/cmake

    (The manual git-clone source build from the original guide is no longer needed —
     the AUR packages handle this with the same CMake flags: -DENABLE_INTEL_CPU=ON
     -DENABLE_INTEL_GPU=ON -DENABLE_INTEL_NPU=ON -DTHREADING=TBB -DENABLE_LTO=ON)=========================================
STEP 4: MODEL DOWNLOAD (OPENVINO IR FORMAT — BOTH MODELS)
4.1 Both models use OpenVINO Intermediate Representation (IR): .xml + .bin pairs.
    Direct HTTP download via wget (no Python/huggingface-cli needed):
mkdir -p $HOME/Documents/colony/models/qwen-moe/1
mkdir -p $HOME/Documents/colony/models/qwen-omni/1
4.2 Download the Qwen3.6-35B-A3B MoE model (OpenVINO INT4 IR) for iGPU:
    Source: OpenVINO/Qwen3.6-35B-A3B-int4-ov (ungated, 24 files, ~6 GB total)
    wget -r -np -nH --cut-dirs=5 -P $HOME/Documents/colony/models/qwen-moe/1 \
      <https://huggingface.co/OpenVINO/Qwen3.6-35B-A3B-int4-ov/resolve/main/>
4.3 Download Qwen2.5-Omni-3B (OpenVINO IR) for NPU:
    Source: wolfofbackstreet/Qwen2.5-Omni-3B-4Bit-Openvino (ungated, 22 files, ~6 GB)
    wget -r -np -nH --cut-dirs=5 -P $HOME/Documents/colony/models/qwen-omni/1 \
      <https://huggingface.co/wolfofbackstreet/Qwen2.5-Omni-3B-4Bit-Openvino/resolve/main/=========================================>
STEP 5: COMPILE NATIVE C++ INFERENCE AGENT (OPENVINO GENAI)
5.1 Clone the official openvino.genai repository:
git clone --recursive <https://github.com/openvinotoolkit/openvino.genai.git> $HOME/Documents/colony/openvino.genai
cd $HOME/Documents/colony/openvino.genai && mkdir build && cd build
5.2 Run CMake pointing to the AUR-installed OpenVINO (not a manual build):
cmake -G Ninja -DCMAKE_BUILD_TYPE=Release \
  -DOpenVINO_DIR=/opt/intel/openvino/runtime/cmake \
  -DENABLE_PYTHON=OFF -DENABLE_SAMPLES=ON -DENABLE_TESTS=OFF ..
cmake --build . --config Release --parallel 4
5.3 Compile your custom native bridging program ~/Documents/colony/ov_inference.cpp:
cat << 'EOF' > $HOME/Documents/colony/ov_inference.cpp

# include "openvino/genai/llm_pipeline.hpp"

# include <iostream>

int main(int argc, char* argv[]) {
    if (argc < 3) {
        std::cerr << "Usage: " << argv[0] << " <MODEL_PATH> <DEVICE> [PROMPT]\n";
        return 1;
    }
    std::string model_path = argv[1];
    std::string device = argv[2];
    std::string prompt = (argc > 3) ? argv[3] : "Hello, explain who you are.";

    try {
        ov::genai::LLMPipeline pipe(model_path, device);
        std::cout << "Pipeline built on " << device << " successfully.\n";
        std::cout << "Response:\n" << pipe.generate(prompt, ov::genai::max_new_tokens(256)) << "\n";
    } catch (const std::exception& e) {
        std::cerr << "Inference error: " << e.what() << "\n";
        return 1;
    }
    return 0;
}
EOF5.4 Compile the custom C++ executor using CMake and standard C++17 rules:clang++ -std=c++17 -O3 -fuse-ld=lld $HOME/Documents/colony/ov_inference.cpp -I/opt/intel/openvino/runtime/include -I$HOME/Documents/colony/openvino.genai/runtime/include -I$HOME/Documents/colony/openvino.genai/runtime/include/openvino/genai -L/opt/intel/openvino/runtime/lib/intel64 -L$HOME/Documents/colony/openvino.genai/build/runtime/lib/intel64/Release -lopenvino -lopenvino_genai -o $HOME/Documents/colony/ov_inference=========================================
STEP 6: OPENVINO MODEL SERVER DEPLOYMENT6.1 Create the OVMS multi-model configuration file:cat << 'EOF' > $HOME/Documents/colony/config.json{"model_config_list": [{"config": {"name": "qwen-moe","base_path": "/workspace/models/qwen-moe","target_device": "GPU","plugin_config": {"PERFORMANCE_HINT": "LATENCY","KEY_VALUE_CACHE_PRECISION": "u8"}}},{"config": {"name": "qwen-omni","base_path": "/workspace/models/qwen-omni","target_device": "NPU","plugin_config": {"PERFORMANCE_HINT": "LATENCY"},"batch_size": "1"}}]}EOF6.2 Create the Docker Compose orchestration layer:cat << 'EOF' > $HOME/Documents/colony/docker-compose.ymlversion: '3.8'services:ovms-server:image: openvino/model_server:latest-gpucontainer_name: ovms-heterogeneous-servingports:- "8000:8000"- "9000:9000"volumes:- /home/user/Documents/colony/config.json:/workspace/config.json:ro- /home/user/Documents/colony/models:/workspace/models:rodevices:- /dev/dri:/dev/dri- /dev/accel/accel0:/dev/accel/accel0environment:- UR_L0_ENABLE_RELAXED_ALLOCATION_LIMITS=1- ONEAPI_DEVICE_SELECTOR=level_zero:0- SYCL_PI_LEVEL_ZERO_USE_IMMEDIATE_COMMANDLISTS=1- ZES_ENABLE_SYSMAN=1user: "${UID}:${GID}"group_add:- "${RENDER_GID}"restart: alwayscommand: /ovms/bin/ovms --config_path /workspace/config.json --port 9000 --rest_port 8000EOF6.3 Gather GIDs from the host and start the server:export UID=$(id -u)
export GID=$(id -g)export RENDER_GID=$(stat -c "%g" /dev/dri/render* | head -n 1)docker compose -f $HOME/Documents/colony/docker-compose.yml up -d=========================================
STEP 7: PI CODING AGENT INTEGRATION via BUN7.1 Install the Pi Coding Agent using Bun's fast native engine:bun add -g --ignore-scripts @earendil-works/pi-coding-agent7.2 Expose Bun's binary path to your terminal's dynamic environments:export PATH="$HOME/.bun/bin:$PATH"echo 'export PATH="$HOME/.bun/bin:$PATH"' >> $HOME/.zshrc7.3 Write the config integration template to ~/.pi/agent/models.json:mkdir -p $HOME/.pi/agent
cat << 'EOF' > $HOME/.pi/agent/models.json{"providers": {"ovms-moe": {"baseUrl": "<http://localhost:8000/v1","api>": "openai-completions","apiKey": "local-key","models": [{"id": "qwen-moe","input": ["text"]}]},"ovms-omni": {"baseUrl": "<http://localhost:8000/v1","api>": "openai-completions","apiKey": "local-key","models": [{"id": "qwen-omni","input": ["text", "image", "audio"]}]}}}EOF=========================================
STEP 8: SYSTEM VERIFICATION AND BENCHMARKING8.1 Confirm both serve instances respond dynamically:curl -s <http://localhost:8000/v1/config> | jq8.2 Test execution loops using local project contexts:cd /path/to/development/projectpi# Inside Pi, choose your target device and model with /model command.Verify the native execution and report back with compiler speed and memory metrics.Pi Coding Agent Bridging ConfigurationThe Pi Coding Agent integrates with OpenAI-compatible endpoint structures using local JSON layout maps. Runtimes, tools, and models are configured via the system's global JSON registry.Create the configuration file at ~/.pi/agent/models.json:JSON{
  "providers": {
    "ovms-moe": {
      "baseUrl": "<http://localhost:8000/v1>",
      "api": "openai-completions",
      "apiKey": "not-needed",
      "name": "Qwen3.6-35B-A3B on Arc iGPU",
      "contextWindow": 131072,
      "maxTokens": 4096,
      "input": ["text"],
      "compat": {
        "thinkingFormat": "qwen-chat-template"
      }
    },
    "ovms-omni": {
      "baseUrl": "<http://localhost:8000/v1>",
      "api": "openai-completions",
      "apiKey": "not-needed",
      "name": "Qwen2.5-Omni-3B on AI Boost NPU",
      "contextWindow": 32768,
      "maxTokens": 2048,
      "input": ["text", "image", "audio"]
    }
  }
}
To run the Pi Coding Agent and select an active model:Navigate to the development directory: cd /path/to/development/workspace.Start the interactive agent harness: pi.Open the active model selector menu: Press Ctrl+L or enter /model.Select ovms-moe as your default provider, and qwen-moe as your active model to use the system's iGPU computational engine for code development.For multimodal, audio, or vision-based side tasks, switch to the NPU execution block using /model and select qwen-omni.Operational Verification and Pipeline DiagnosticsOnce the configuration process is complete, execute these verification checks to confirm the pipeline is fully operational:Bash# Verify model server endpoint statuses
curl -s <http://localhost:8000/v1/config> | jq
Expected output response:JSON{
  "qwen-moe": {
    "model_version_status": [
      {
        "version": "1",
        "state": "AVAILABLE",
        "status": {
          "error_code": "OK",
          "error_message": "OK"
        }
      }
    ]
  },
  "qwen-omni": {
    "model_version_status": [
      {
        "version": "1",
        "state": "AVAILABLE",
        "status": {
          "error_code": "OK",
          "error_message": "OK"
        }
      }
    ]
  }
}
To test real-time inference on the active GPU and NPU execution paths, send a curl request directly to each model's endpoint:Bash# Test the dynamic MoE compilation pipeline on the iGPU
curl -X POST <http://localhost:8000/v1/chat/completions> \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-moe",
    "messages": [{"role": "user", "content": "Explain the difference between a mutex and a semaphore."}]
  }'

# Test the static multimodal compilation pipeline on the Intel NPU

curl -X POST <http://localhost:8000/v1/chat/completions> \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-omni",
    "messages": [{"role": "user", "content": "Translate the following to Rust: printf(\"Hello World\\n\");"}]
  }'
The system will stream the generated outputs back to the terminal. This confirms that the local OpenVINO-accelerated model pipeline is successfully deployed, configured, and bridged to the Pi Coding Agent client.
