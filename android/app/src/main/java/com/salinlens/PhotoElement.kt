package com.salinlens

import android.content.Context
import android.graphics.*
import android.util.LruCache
import android.view.View
import android.view.ViewOutlineProvider
import com.lynx.tasm.behavior.LynxContext
import com.lynx.tasm.behavior.LynxProp
import com.lynx.tasm.behavior.ui.LynxUI
import kotlin.math.max
import kotlin.math.min

/** <salin-photo src fit="cover|contain" radius> — downsampled, cached, fade-in image from a file path. */
class PhotoElement(ctx: LynxContext) : LynxUI<PhotoElement.PhotoView>(ctx) {
    override fun createView(context: Context) = PhotoView(context)
    @LynxProp(name = "src") fun setSrc(v: String) { mView.setSrc(v) }
    @LynxProp(name = "fit") fun setFit(v: String) { mView.cover = v != "contain"; mView.invalidate() }
    @LynxProp(name = "radius") fun setRadius(v: Double) { mView.setRadius(v.toFloat()) }

    class PhotoView(ctx: Context) : View(ctx) {
        var cover = true
        private var bmp: Bitmap? = null; private var path = ""; private var fade = 1f; private var t0 = 0L
        private val p = Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG)
        private var radiusPx = 0f

        fun setRadius(dp: Float) { radiusPx = dp * resources.displayMetrics.density; clipToOutline = true
            outlineProvider = object : ViewOutlineProvider() { override fun getOutline(v: View, o: Outline) { o.setRoundRect(0, 0, v.width, v.height, radiusPx) } }; invalidateOutline() }

        fun setSrc(s: String) {
            if (s == path) return; path = s
            cache.get(s)?.let { bmp = it; fade = 1f; invalidate(); return }
            bmp = null; invalidate()
            Host.io.execute {
                val b = Imaging.loadUpright(s, 720) ?: return@execute
                cache.put(s, b)
                post { if (s == path) { bmp = b; fade = 0f; t0 = System.currentTimeMillis(); invalidate() } }
            }
        }

        override fun onDraw(c: Canvas) {
            val b = bmp ?: return
            if (fade < 1f) { fade = min(1f, (System.currentTimeMillis() - t0) / 260f); invalidate() }
            p.alpha = (255 * fade).toInt()
            val vw = width.toFloat(); val vh = height.toFloat()
            val s = if (cover) max(vw / b.width, vh / b.height) else min(vw / b.width, vh / b.height)
            val w = b.width * s; val h = b.height * s
            c.drawBitmap(b, null, RectF((vw - w) / 2, (vh - h) / 2, (vw + w) / 2, (vh + h) / 2), p)
        }
        companion object { val cache = object : LruCache<String, Bitmap>(24 * 1024 * 1024) { override fun sizeOf(k: String, v: Bitmap) = v.byteCount } }
    }
}
