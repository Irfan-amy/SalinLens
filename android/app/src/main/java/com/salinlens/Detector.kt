package com.salinlens

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.content.Context
import android.graphics.Bitmap
import java.nio.FloatBuffer
import kotlin.math.exp

/** TinyDoc (MobileNetV3 mask net, C0 + 0.25*HN + 0.5*MIDV task-arithmetic model) + gated quad extraction. */
object Detector {
    const val MIN_CONF = 0.55f
    private var env: OrtEnvironment? = null
    private var session: OrtSession? = null

    /** The weights are not shipped in the public repo (see README): without assets/docnet.onnx detection is simply off and the crop starts as an inset rectangle. */
    private var missing = false

    @Synchronized private fun ensure(ctx: Context): OrtSession? {
        session?.let { return it }
        if (missing) return null
        val e = OrtEnvironment.getEnvironment()
        val so = OrtSession.SessionOptions().apply { setIntraOpNumThreads(2); setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT) }
        val bytes = try { ctx.applicationContext.assets.open("docnet.onnx").use { it.readBytes() } } catch (_: java.io.FileNotFoundException) { missing = true; return null }
        env = e; return e.createSession(bytes, so).also { session = it }
    }

    class Det(val quad: FloatArray /* normalized tl,tr,br,bl in the bitmap given */, val conf: Float)

    /** Returns null if no document found with confidence >= MIN_CONF. Quad is normalized to `upright`. */
    @Synchronized fun detect(ctx: Context, upright: Bitmap): Det? {
        val s = ensure(ctx) ?: return null
        val portrait = upright.height > upright.width
        // the net was trained on landscape frames: feed landscape, map the quad back
        val net = if (portrait) Imaging.rotate90(upright) else upright
        val x = Imaging.toNetInput(net)
        if (net !== upright) net.recycle()
        val t = OnnxTensor.createTensor(env, FloatBuffer.wrap(x), longArrayOf(1, 3, QuadFromMask.NH.toLong(), QuadFromMask.NW.toLong()))
        val prob = t.use {
            s.run(mapOf("x" to t)).use { r ->
                @Suppress("UNCHECKED_CAST") val a = (r[0].value as Array<Array<Array<FloatArray>>>)[0][0]
                FloatArray(QuadFromMask.NW * QuadFromMask.NH) { i -> 1f / (1f + exp(-a[i / QuadFromMask.NW][i % QuadFromMask.NW])) }
            }
        }
        val res = QuadFromMask.run(prob) ?: return null
        if (res.conf < MIN_CONF) return null
        var q = FloatArray(8) { if (it % 2 == 0) (res.quad[it] / QuadFromMask.NW).coerceIn(0f, 1f) else (res.quad[it] / QuadFromMask.NH).coerceIn(0f, 1f) }
        if (portrait) q = Imaging.rotateQuad(q, 3) // landscape was a 90deg cw turn of upright: undo with 3 more cw turns
        return Det(q, res.conf)
    }
}
