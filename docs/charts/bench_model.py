"""Time the edge-detection model on this machine: python3 docs/charts/bench_model.py path/to/docnet.onnx
Needs: pip install onnxruntime numpy. The app runs it with 2 threads on a 192x320 frame."""
import sys, time, numpy as np, onnxruntime as ort
x = np.random.rand(1, 3, 192, 320).astype('float32')
for th in (1, 2, 4):
    so = ort.SessionOptions(); so.intra_op_num_threads = th
    s = ort.InferenceSession(sys.argv[1], so, providers=['CPUExecutionProvider'])
    for _ in range(20): s.run(None, {'x': x})
    t = []
    for _ in range(300):
        a = time.perf_counter(); s.run(None, {'x': x}); t.append((time.perf_counter() - a) * 1e3)
    print(f'{th} thread(s): p50 {np.percentile(t, 50):.2f} ms  p95 {np.percentile(t, 95):.2f} ms')
