# Ollama Performance Optimization Guide

## Current Optimizations Applied ✅

### 1. Model Optimization: `qwen-fast`
- **Base model:** qwen2.5:14b (Q4_K_M quantized)
- **Context window:** 2048 tokens (reduced from 4096)
- **Batch size:** 512 (increased for faster processing)
- **GPU layers:** 99 (all layers on GPU)
- **Threads:** 8 (optimized CPU coordination)
- **Result:** ~40% speedup in integration tests

**Created with:**
```bash
ollama create qwen-fast -f modelfile
```

**Modelfile:**
```
FROM qwen2.5:14b
PARAMETER num_ctx 2048
PARAMETER num_batch 512
PARAMETER num_gpu 99
PARAMETER num_thread 8
```

---

## Optional: System-Level Optimizations

These require sudo access and service restart. Apply if you want additional performance gains.

### 2. Ollama Service Configuration

**Location:** `/etc/systemd/system/ollama.service`

**Add these environment variables to the `[Service]` section:**

```ini
[Service]
# ... existing config ...

# Performance optimizations
Environment="OLLAMA_NUM_PARALLEL=4"            # Process multiple requests in parallel
Environment="OLLAMA_MAX_LOADED_MODELS=1"       # Keep only one model in memory
Environment="OLLAMA_FLASH_ATTENTION=1"         # Enable flash attention (faster, less memory)
Environment="OLLAMA_MAX_QUEUE=512"             # Increase request queue size
```

**Apply changes:**
```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

**Verify service is running:**
```bash
systemctl status ollama
```

**Test the configuration:**
```bash
npm test -- ollama-integration.test.ts
```

### 3. GPU Power Management (if needed)

Check current GPU power state:
```bash
nvidia-smi -q -d POWER
```

If your GPU is in a power-saving mode, force maximum performance:
```bash
sudo nvidia-smi -pm 1  # Enable persistence mode
sudo nvidia-smi -pl 200  # Set power limit (adjust for your GPU)
```

---

## Performance Monitoring

### Check Ollama Model Info
```bash
ollama ps                    # See loaded models
ollama show qwen-fast       # Model details
```

### Monitor GPU Usage
```bash
watch -n 1 nvidia-smi        # Live GPU monitoring
```

### Benchmark Current Performance
```bash
npm test -- ollama-integration.test.ts --reporter=verbose
```

---

## Current Status

✅ **Applied:**
- Model optimization (`qwen-fast`)
- Q4_K_M quantization (9GB model size)
- GPU utilization (100%)
- Context window reduction (2048 tokens)
- Batch processing optimization (512)

⏸️  **Optional (requires sudo):**
- System-level service configuration
- GPU power management
- Parallel request processing

---

## Performance Results

| Configuration | Test Duration | Status |
|---------------|---------------|--------|
| **Baseline (qwen2.5:14b, 4096 ctx)** | 11.13s | ✅ Baseline |
| **Optimized (qwen-fast, 2048 ctx)** | 6.63s | ✅ ~40% faster |
| **With system config (estimated)** | ~5-6s | 🔄 Optional |

---

## Troubleshooting

### Model not loading
```bash
ollama list                  # Check if qwen-fast exists
ollama create qwen-fast -f /tmp/qwen-fast.modelfile  # Recreate if needed
```

### Service issues
```bash
sudo systemctl status ollama  # Check service status
sudo journalctl -u ollama -n 50  # Check logs
```

### GPU not utilized
```bash
nvidia-smi                   # Verify GPU is visible
ollama ps                    # Check if model shows "100% GPU"
```

---

## CLI Usage

### Full pipeline with custom max sequences
```bash
npm run cli -- process persona 6      # Process persona.srt, max 6 triplet sequences
```

**Note:** The `--` is required to pass arguments through npm to the script.

### Find triplets only
```bash
npm run cli -- find assets/persona.srt --max-sequences 10
```

### Judge existing triplets
```bash
npm run cli -- judge generated/persona/triplets/
```
