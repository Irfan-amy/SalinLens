package com.salinlens

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.util.Size
import android.view.View
import android.widget.FrameLayout
import androidx.camera.core.*
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import com.lynx.tasm.behavior.LynxContext
import com.lynx.tasm.behavior.LynxProp
import com.lynx.tasm.behavior.ui.LynxUI
import com.lynx.tasm.event.LynxCustomEvent
import java.io.File
import java.lang.ref.WeakReference
import java.util.concurrent.Executors
import kotlin.math.max

/** <salin-camera active torch bindquad(detected)> : CameraX preview + live document outline drawn natively at 60 fps. */
class CameraElement(ctx: LynxContext) : LynxUI<CameraElement.CameraLayout>(ctx) {

    override fun createView(context: Context): CameraLayout = CameraLayout(context, { detected ->
        val e = LynxCustomEvent(sign, "detected"); e.addDetail("value", detected); lynxContext.eventEmitter.sendCustomEvent(e)
    }, { ok ->
        val e = LynxCustomEvent(sign, "camerastate"); e.addDetail("ok", ok); lynxContext.eventEmitter.sendCustomEvent(e)
    })
    @LynxProp(name = "active") fun setActive(v: Boolean) { mView.setActive(v) }
    @LynxProp(name = "torch") fun setTorch(v: Boolean) { mView.setTorch(v) }

    class CameraLayout(ctx: Context, private val onDetected: (Boolean) -> Unit, private val onState: (Boolean) -> Unit) : FrameLayout(ctx) {
        private val preview = PreviewView(ctx).apply { implementationMode = PreviewView.ImplementationMode.COMPATIBLE; scaleType = PreviewView.ScaleType.FILL_CENTER }
        private val overlay = Overlay(ctx)
        private var provider: ProcessCameraProvider? = null
        private var camera: Camera? = null
        private var capture: ImageCapture? = null
        private var active = false; private var torch = false; private var wasDetected = false
        private val analysisExec = Executors.newSingleThreadExecutor()
        @Volatile private var lastRun = 0L; private var misses = 0
        private var cur: FloatArray? = null

        init { addView(preview, LayoutParams(-1, -1)); addView(overlay, LayoutParams(-1, -1)); setBackgroundColor(Color.BLACK); Host.camera = WeakReference(this) }

        fun setActive(v: Boolean) { active = v; if (v) bind() else unbind() }
        fun setTorch(v: Boolean) { torch = v; camera?.cameraControl?.enableTorch(v) }
        override fun onAttachedToWindow() { super.onAttachedToWindow(); Host.camera = WeakReference(this); if (active) bind() }
        override fun onDetachedFromWindow() { super.onDetachedFromWindow(); unbind() }

        private fun bind() {
            val act = Host.activity?.get() ?: return
            if (ContextCompat.checkSelfPermission(act, android.Manifest.permission.CAMERA) != android.content.pm.PackageManager.PERMISSION_GRANTED) return
            val f = ProcessCameraProvider.getInstance(act)
            f.addListener({
                if (!active) return@addListener
                // No camera, camera busy/disabled, or provider init failure: tell the UI instead of crashing.
                val p = try { f.get() } catch (_: Exception) { onState(false); return@addListener }
                provider = p; p.unbindAll()
                val sel = ResolutionSelector.Builder().setResolutionStrategy(ResolutionStrategy(Size(640, 480), ResolutionStrategy.FALLBACK_RULE_CLOSEST_LOWER_THEN_HIGHER)).build()
                val pv = Preview.Builder().build().also { it.surfaceProvider = preview.surfaceProvider }
                val an = ImageAnalysis.Builder().setResolutionSelector(sel).setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST).build()
                an.setAnalyzer(analysisExec) { img -> analyze(img) }
                val cap = ImageCapture.Builder().setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY).build(); capture = cap
                try { camera = p.bindToLifecycle(act, CameraSelector.DEFAULT_BACK_CAMERA, pv, an, cap); camera?.cameraControl?.enableTorch(torch); onState(true) } catch (_: Exception) { camera = null; capture = null; onState(false) }
            }, ContextCompat.getMainExecutor(act))
        }

        private fun unbind() { provider?.unbindAll(); camera = null; capture = null; cur = null; overlay.set(null); setDet(false) }

        private fun setDet(d: Boolean) { if (d != wasDetected) { wasDetected = d; post { onDetected(d) } } }

        private fun analyze(img: ImageProxy) {
            try {
                val now = System.currentTimeMillis()
                if (now - lastRun < 60) return
                lastRun = now
                val rot = img.imageInfo.rotationDegrees
                var bmp = img.toBitmap()
                if (rot != 0) bmp = Imaging.rotate(bmp, rot)
                val d = Detector.detect(context, bmp)
                if (d != null) {
                    misses = 0
                    val c = cur
                    cur = if (c == null) d.quad else FloatArray(8) { c[it] * 0.4f + d.quad[it] * 0.6f }
                    overlay.set(cur, bmp.width, bmp.height); setDet(true)
                } else if (++misses > 5) { cur = null; overlay.set(null); setDet(false) }
                bmp.recycle()
            } catch (_: Throwable) { } finally { img.close() }
        }

        fun capture(cb: (String?, String?) -> Unit) {
            val c = capture ?: return cb(null, "camera not active")
            val f = File(context.cacheDir, "cap_${System.nanoTime()}.jpg")
            c.takePicture(ImageCapture.OutputFileOptions.Builder(f).build(), ContextCompat.getMainExecutor(context), object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(r: ImageCapture.OutputFileResults) = cb(f.absolutePath, null)
                override fun onError(e: ImageCaptureException) = cb(null, e.message)
            })
        }

        /** Smooth, animated outline that glides between detections. */
        private inner class Overlay(ctx: Context) : View(ctx) {
            private var target: FloatArray? = null; private var shown: FloatArray? = null
            private var iw = 1; private var ih = 1; private var alpha = 0f
            private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
            private val line = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeJoin = Paint.Join.ROUND; strokeCap = Paint.Cap.ROUND }
            private val dot = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
            private val path = Path()
            fun set(q: FloatArray?, w: Int = iw, h: Int = ih) { target = q?.copyOf(); iw = w; ih = h; postInvalidateOnAnimation() }
            override fun onDraw(c: Canvas) {
                val t = target; val d = resources.displayMetrics.density
                alpha += if (t != null) (1f - alpha) * 0.2f else -alpha * 0.2f
                if (t != null) { val s = shown ?: t.copyOf().also { shown = it }; for (i in 0 until 8) s[i] += (t[i] - s[i]) * 0.35f } else if (alpha < 0.02f) shown = null
                val s = shown ?: return
                if (alpha < 0.01f) return
                // FILL_CENTER mapping of the upright analysis frame into this view
                val sc = max(width.toFloat() / iw, height.toFloat() / ih); val ox = (width - iw * sc) / 2f; val oy = (height - ih * sc) / 2f
                val p = FloatArray(8) { if (it % 2 == 0) ox + s[it] * iw * sc else oy + s[it] * ih * sc }
                path.rewind(); path.moveTo(p[0], p[1]); for (i in 1 until 4) path.lineTo(p[2 * i], p[2 * i + 1]); path.close()
                fill.color = Color.argb((alpha * 56).toInt(), 47, 107, 255); c.drawPath(path, fill)
                line.color = Color.argb((alpha * 255).toInt(), 47, 107, 255); line.strokeWidth = 3f * d; c.drawPath(path, line)
                dot.alpha = (alpha * 255).toInt()
                for (i in 0 until 4) { c.drawCircle(p[2 * i], p[2 * i + 1], 5f * d, dot); }
                if (t != null || alpha > 0.01f) postInvalidateOnAnimation()
            }
        }
    }
}
