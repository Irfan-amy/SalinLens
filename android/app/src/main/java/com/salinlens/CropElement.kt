package com.salinlens

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.*
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.view.animation.OvershootInterpolator
import com.lynx.tasm.behavior.LynxContext
import com.lynx.tasm.behavior.LynxProp
import com.lynx.tasm.behavior.ui.LynxUI
import com.lynx.tasm.event.LynxCustomEvent
import org.json.JSONArray
import kotlin.math.*

/**
 * <salin-crop src quad bindchange bindgrab> — page with four corner + four edge handles, a dimmed outside,
 * a magnifier loupe while dragging. All touch handling is native, so it stays at display refresh rate.
 */
class CropElement(ctx: LynxContext) : LynxUI<CropElement.CropView>(ctx) {
    override fun createView(context: Context): CropView = CropView(context,
        onChange = { q -> val e = LynxCustomEvent(sign, "change"); e.addDetail("quad", JSONArray(q.map { it.toDouble() }).toString()); lynxContext.eventEmitter.sendCustomEvent(e) },
        onGrab = { g -> val e = LynxCustomEvent(sign, "grab"); e.addDetail("value", g); lynxContext.eventEmitter.sendCustomEvent(e) })
    @LynxProp(name = "src") fun setSrc(v: String) { mView.setSrc(v) }
    @LynxProp(name = "quad") fun setQuad(v: String) { mView.setQuad(v) }

    class CropView(ctx: Context, private val onChange: (FloatArray) -> Unit, private val onGrab: (Boolean) -> Unit) : View(ctx) {
        private val d = resources.displayMetrics.density
        private var bmp: Bitmap? = null; private var path = ""
        private var q = floatArrayOf(0.08f, 0.08f, 0.92f, 0.08f, 0.92f, 0.92f, 0.08f, 0.92f) // normalized, tl,tr,br,bl
        private var pendingQuad: FloatArray? = null
        private var anim: ValueAnimator? = null
        private var imgRect = RectF()
        private var grab = -1; private var grabOffX = 0f; private var grabOffY = 0f
        private var pop = 0f; private var popAnim: ValueAnimator? = null
        private var fx = 0f; private var fy = 0f // finger
        private val pad = 28f * d

        private val img = Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG)
        private val scrim = Paint().apply { color = Color.argb(110, 12, 20, 28) }
        private val line = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = 3f * d; color = BLUE; strokeJoin = Paint.Join.ROUND }
        private val hFill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(215, 142, 142, 147) }
        private val hRing = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = 2f * d; color = Color.WHITE }
        private val mid = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
        private val midRing = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = 2f * d; color = BLUE }
        private val shadow = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(60, 0, 0, 0) }
        private val cross = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = 1.5f * d; color = Color.argb(200, 47, 107, 255) }
        private val gridP = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = 1f * d; color = Color.argb(90, 255, 255, 255) }
        private val qp = Path(); private val loupePath = Path()

        fun setSrc(p: String) {
            if (p == path) return; path = p; bmp = null; invalidate()
            Host.io.execute { val b = Imaging.loadUpright(p, 1600); post { if (p == path) { bmp = b; layoutImg(); animateIntro(); invalidate() } } }
        }

        fun setQuad(json: String) {
            val a = try { JSONArray(json) } catch (_: Exception) { return }
            if (a.length() != 8) return
            val n = FloatArray(8) { a.getDouble(it).toFloat() }
            if (bmp == null) { pendingQuad = n; return }
            if (grab >= 0) return
            if ((0 until 8).all { abs(n[it] - q[it]) < 0.002f }) return
            animateTo(n, 420)
        }

        private fun layoutImg() {
            val b = bmp ?: return
            val aw = width - 2 * pad; val ah = height - 2 * pad; if (aw <= 0 || ah <= 0) return
            val s = min(aw / b.width, ah / b.height); val w = b.width * s; val h = b.height * s
            imgRect.set((width - w) / 2f, (height - h) / 2f, (width + w) / 2f, (height + h) / 2f)
        }
        override fun onSizeChanged(w: Int, h: Int, ow: Int, oh: Int) { layoutImg() }

        private fun animateIntro() {
            val target = pendingQuad ?: q; pendingQuad = null
            q = floatArrayOf(0f, 0f, 1f, 0f, 1f, 1f, 0f, 1f)
            animateTo(target, 650)
        }

        private fun animateTo(t: FloatArray, ms: Long) {
            anim?.cancel(); val from = q.copyOf()
            anim = ValueAnimator.ofFloat(0f, 1f).apply {
                duration = ms; interpolator = OvershootInterpolator(0.9f)
                addUpdateListener { v -> val f = v.animatedValue as Float; for (i in 0 until 8) q[i] = from[i] + (t[i] - from[i]) * f; invalidate() }
                start()
            }
        }

        private fun px(i: Int) = imgRect.left + q[2 * i] * imgRect.width()
        private fun py(i: Int) = imgRect.top + q[2 * i + 1] * imgRect.height()
        /** 0..3 corners, 4..7 edge midpoints (top,right,bottom,left) */
        private fun hx(h: Int) = if (h < 4) px(h) else (px(h - 4) + px((h - 3) % 4)) / 2f
        private fun hy(h: Int) = if (h < 4) py(h) else (py(h - 4) + py((h - 3) % 4)) / 2f

        override fun onDraw(c: Canvas) {
            val b = bmp ?: return
            c.drawBitmap(b, null, imgRect, img)
            qp.rewind(); qp.moveTo(px(0), py(0)); for (i in 1 until 4) qp.lineTo(px(i), py(i)); qp.close()
            c.save(); c.clipOutPath(qp); c.drawRect(imgRect, scrim); c.restore()
            if (grab >= 0) { // rule-of-thirds grid inside the quad
                c.save(); c.clipPath(qp)
                for (k in 1..2) { val t = k / 3f
                    c.drawLine(px(0) + (px(1) - px(0)) * t, py(0) + (py(1) - py(0)) * t, px(3) + (px(2) - px(3)) * t, py(3) + (py(2) - py(3)) * t, gridP)
                    c.drawLine(px(0) + (px(3) - px(0)) * t, py(0) + (py(3) - py(0)) * t, px(1) + (px(2) - px(1)) * t, py(1) + (py(2) - py(1)) * t, gridP) }
                c.restore()
            }
            c.drawPath(qp, line)
            for (h in 4 until 8) { val r = 6.5f * d * (1f + if (h == grab) pop * 0.4f else 0f); c.drawCircle(hx(h), hy(h), r, mid); c.drawCircle(hx(h), hy(h), r, midRing) }
            for (h in 0 until 4) {
                val r = 14f * d * (1f + if (h == grab) pop * 0.35f else 0f)
                c.drawCircle(hx(h), hy(h) + 1.5f * d, r, shadow)
                hFill.color = if (h == grab) Color.argb(235, 47, 107, 255) else Color.argb(215, 142, 142, 147)
                c.drawCircle(hx(h), hy(h), r, hFill); c.drawCircle(hx(h), hy(h), r, hRing)
            }
            if (grab >= 0) drawLoupe(c, b)
        }

        private fun drawLoupe(c: Canvas, b: Bitmap) {
            val r = 52f * d; val cx0 = hx(grab); val cy0 = hy(grab)
            var lx = fx - grabOffX; var ly = cy0 - r - 46f * d
            if (ly - r < 6f * d) ly = cy0 + r + 46f * d
            lx = lx.coerceIn(r + 8f * d, width - r - 8f * d)
            val zoom = 2.6f; val s = imgRect.width() / b.width
            val srcHalf = r / zoom / s
            val sx = (cx0 - imgRect.left) / s; val sy = (cy0 - imgRect.top) / s
            loupePath.rewind(); loupePath.addCircle(lx, ly, r, Path.Direction.CW)
            c.drawCircle(lx, ly + 2f * d, r + 2f * d, shadow)
            c.save(); c.clipPath(loupePath); c.drawColor(Color.WHITE)
            c.drawBitmap(b, Rect((sx - srcHalf).toInt(), (sy - srcHalf).toInt(), (sx + srcHalf).toInt(), (sy + srcHalf).toInt()), RectF(lx - r, ly - r, lx + r, ly + r), img)
            c.drawLine(lx - 10f * d, ly, lx + 10f * d, ly, cross); c.drawLine(lx, ly - 10f * d, lx, ly + 10f * d, cross)
            c.restore(); c.drawCircle(lx, ly, r, hRing.apply { strokeWidth = 3f * d })
            hRing.strokeWidth = 2f * d
        }

        override fun onTouchEvent(e: MotionEvent): Boolean {
            if (bmp == null) return false
            when (e.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    var best = -1; var bd = 44f * d
                    for (h in 0 until 8) { val dd = hypot(e.x - hx(h), e.y - hy(h)) * (if (h >= 4) 1.15f else 1f); if (dd < bd) { bd = dd; best = h } }
                    if (best < 0) return false
                    anim?.cancel(); parent?.requestDisallowInterceptTouchEvent(true)
                    grab = best; grabOffX = e.x - hx(best); grabOffY = e.y - hy(best); fx = e.x; fy = e.y
                    performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK); onGrab(true); popTo(1f); invalidate(); return true
                }
                MotionEvent.ACTION_MOVE -> if (grab >= 0) {
                    fx = e.x; fy = e.y
                    val nx = ((e.x - grabOffX - imgRect.left) / imgRect.width()); val ny = ((e.y - grabOffY - imgRect.top) / imgRect.height())
                    if (grab < 4) { q[2 * grab] = nx.coerceIn(0f, 1f); q[2 * grab + 1] = ny.coerceIn(0f, 1f) }
                    else { // edge: translate both end corners
                        val a = grab - 4; val b2 = (grab - 3) % 4
                        val cx = (q[2 * a] + q[2 * b2]) / 2f; val cy = (q[2 * a + 1] + q[2 * b2 + 1]) / 2f
                        val dx = nx - cx; val dy = ny - cy
                        val ddx = dx.coerceIn(-min(q[2 * a], q[2 * b2]), 1f - max(q[2 * a], q[2 * b2])); val ddy = dy.coerceIn(-min(q[2 * a + 1], q[2 * b2 + 1]), 1f - max(q[2 * a + 1], q[2 * b2 + 1]))
                        q[2 * a] += ddx; q[2 * b2] += ddx; q[2 * a + 1] += ddy; q[2 * b2 + 1] += ddy
                    }
                    invalidate(); return true
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> if (grab >= 0) {
                    grab = -1; popTo(0f); onGrab(false); onChange(q.copyOf()); invalidate(); return true
                }
            }
            return super.onTouchEvent(e)
        }

        private fun popTo(v: Float) {
            popAnim?.cancel()
            popAnim = ValueAnimator.ofFloat(pop, v).apply { duration = 160; addUpdateListener { pop = it.animatedValue as Float; invalidate() }; start() }
        }
        companion object { val BLUE = Color.rgb(47, 107, 255) }
    }
}
