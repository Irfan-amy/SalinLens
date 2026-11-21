package com.salinlens

import android.graphics.*
import androidx.exifinterface.media.ExifInterface
import java.io.File
import kotlin.math.*

/** Bitmap helpers: no OpenCV, only android.graphics + hand-rolled filters. */
object Imaging {
    const val MODE_ORIGINAL = "original"; const val MODE_COLOR = "color"; const val MODE_GRAY = "gray"; const val MODE_BW = "bw"
    const val MODE_MAGIC = "magic"; const val MODE_LIGHTEN = "lighten"; const val MODE_CRISP = "crisp"; const val MODE_SCANNER = "scanner"; const val MODE_ECO = "eco"

    fun loadUpright(path: String, maxSide: Int): Bitmap? {
        val o = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(path, o)
        if (o.outWidth <= 0) return null
        var sample = 1
        while (max(o.outWidth, o.outHeight) / (sample * 2) >= maxSide) sample *= 2
        val bmp = BitmapFactory.decodeFile(path, BitmapFactory.Options().apply { inSampleSize = sample; inPreferredConfig = Bitmap.Config.ARGB_8888 }) ?: return null
        val deg = try {
            when (ExifInterface(path).getAttributeInt(ExifInterface.TAG_ORIENTATION, 1)) {
                ExifInterface.ORIENTATION_ROTATE_90 -> 90; ExifInterface.ORIENTATION_ROTATE_180 -> 180; ExifInterface.ORIENTATION_ROTATE_270 -> 270; else -> 0
            }
        } catch (_: Exception) { 0 }
        return if (deg == 0) bmp else rotate(bmp, deg)
    }

    fun rotate90(b: Bitmap): Bitmap = Bitmap.createBitmap(b, 0, 0, b.width, b.height, Matrix().apply { postRotate(90f) }, true)

    fun rotate(b: Bitmap, deg: Int): Bitmap {
        if (deg % 360 == 0) return b
        val m = Matrix().apply { postRotate(deg.toFloat()) }
        return Bitmap.createBitmap(b, 0, 0, b.width, b.height, m, true).also { if (it !== b) b.recycle() }
    }

    /** rotate a normalized quad (tl,tr,br,bl) by 90*k degrees clockwise together with its image. */
    fun rotateQuad(q: FloatArray, quarterTurnsCw: Int): FloatArray {
        var r = q.copyOf()
        repeat(((quarterTurnsCw % 4) + 4) % 4) {
            val o = FloatArray(8)
            for (i in 0 until 4) { val x = r[2 * i]; val y = r[2 * i + 1]; o[2 * i] = 1f - y; o[2 * i + 1] = x }
            // after a cw turn the old tl becomes tr: reorder to tl,tr,br,bl
            r = floatArrayOf(o[6], o[7], o[0], o[1], o[2], o[3], o[4], o[5])
        }
        return r
    }

    /** Area-average resize to NWxNH -> NCHW float RGB 0..1 (matches cv2.INTER_AREA closely). */
    fun toNetInput(src: Bitmap, nw: Int = QuadFromMask.NW, nh: Int = QuadFromMask.NH): FloatArray {
        val w = src.width; val h = src.height
        val px = IntArray(w * h); src.getPixels(px, 0, w, 0, 0, w, h)
        val out = FloatArray(3 * nw * nh)
        val sx = w.toFloat() / nw; val sy = h.toFloat() / nh
        // separable: columns then rows with fractional coverage weights
        val tmp = FloatArray(3 * nw * h)
        for (x in 0 until nw) {
            val a = x * sx; val b = a + sx
            val i0 = floor(a).toInt(); val i1 = min(w - 1, ceil(b).toInt() - 1)
            for (y in 0 until h) {
                var r = 0f; var g = 0f; var bl = 0f; var ws = 0f
                for (i in i0..i1) {
                    val wt = (min(b, i + 1f) - max(a, i.toFloat())); val c = px[y * w + i]
                    r += wt * ((c shr 16) and 255); g += wt * ((c shr 8) and 255); bl += wt * (c and 255); ws += wt
                }
                val o = (y * nw + x) * 3; tmp[o] = r / ws; tmp[o + 1] = g / ws; tmp[o + 2] = bl / ws
            }
        }
        for (y in 0 until nh) {
            val a = y * sy; val b = a + sy
            val j0 = floor(a).toInt(); val j1 = min(h - 1, ceil(b).toInt() - 1)
            for (x in 0 until nw) {
                var r = 0f; var g = 0f; var bl = 0f; var ws = 0f
                for (j in j0..j1) {
                    val wt = (min(b, j + 1f) - max(a, j.toFloat())); val o = (j * nw + x) * 3
                    r += wt * tmp[o]; g += wt * tmp[o + 1]; bl += wt * tmp[o + 2]; ws += wt
                }
                val k = y * nw + x
                out[k] = r / ws / 255f; out[nw * nh + k] = g / ws / 255f; out[2 * nw * nh + k] = bl / ws / 255f
            }
        }
        return out
    }

    /** Perspective-correct to a flat rectangle (aspect from quad edge lengths). q: tl,tr,br,bl in pixels. */
    fun warp(src: Bitmap, q: FloatArray, longSide: Int): Bitmap {
        val w = max(hypot(q[2] - q[0], q[3] - q[1]), hypot(q[4] - q[6], q[5] - q[7]))
        val h = max(hypot(q[6] - q[0], q[7] - q[1]), hypot(q[4] - q[2], q[5] - q[3]))
        val k = longSide / max(w, h)
        val W = max(8, (w * k).roundToInt()); val H = max(8, (h * k).roundToInt())
        val out = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888)
        val m = Matrix()
        m.setPolyToPoly(q, 0, floatArrayOf(0f, 0f, W.toFloat(), 0f, W.toFloat(), H.toFloat(), 0f, H.toFloat()), 0, 4)
        Canvas(out).drawBitmap(src, m, Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG))
        return out
    }

    /**
     * Scan filters. All share one shadow-flattening pass (docscan.enhance port: divide out a large-scale
     * background estimate), then differ in tone mapping:
     *  color    Auto: flattened colour, paper ~245 (docscan parity)
     *  magic    Magic Color: whiter paper, boosted saturation + contrast
     *  lighten  brightens dim / underexposed pages, keeps colour
     *  crisp    flattened colour + unsharp mask for sharp text
     *  scanner  printer-scanner look: grayscale, levels stretched so paper is pure white and ink is deep black
     *  eco      ink saver: scanner look with softened (lighter) ink
     *  gray     flattened grayscale
     *  bw       adaptive threshold (gaussian 31x31, C=15)
     */
    fun enhance(src: Bitmap, mode: String): Bitmap {
        if (mode == MODE_ORIGINAL) return src
        val w = src.width; val h = src.height
        val px = IntArray(w * h); src.getPixels(px, 0, w, 0, 0, w, h)
        val g = IntArray(w * h) { val c = px[it]; ((((c shr 16) and 255) * 299 + ((c shr 8) and 255) * 587 + (c and 255) * 114) + 500) / 1000 }
        val sw = max(8, w / 8); val sh = max(8, h / 8)
        var sm = areaGray(g, w, h, sw, sh)
        sm = grayClose(sm, sw, sh, 9)
        sm = gaussian(sm, sw, sh, 5f)
        val bg = upscaleBilinear(sm, sw, sh, w, h)

        fun pack(r: Float, gg: Float, b: Float): Int =
            (255 shl 24) or (r.coerceIn(0f, 255f).toInt() shl 16) or (gg.coerceIn(0f, 255f).toInt() shl 8) or b.coerceIn(0f, 255f).toInt()
        fun out() = Bitmap.createBitmap(px, w, h, Bitmap.Config.ARGB_8888)

        when (mode) {
            MODE_COLOR -> {
                for (i in px.indices) {
                    val b = bg[i] + 1f; val c = px[i]
                    px[i] = pack(((c shr 16) and 255) / b * 245f, ((c shr 8) and 255) / b * 245f, (c and 255) / b * 245f)
                }
                return out()
            }
            MODE_MAGIC -> {
                // per-channel flatten = white balance: tinted / yellowed paper becomes neutral white
                val ch = flattenChannels(px, w, h, 252f)
                for (i in px.indices) {
                    var r = ch[0][i]; var gg = ch[1][i]; var bl = ch[2][i]
                    val l = 0.299f * r + 0.587f * gg + 0.114f * bl
                    r = l + (r - l) * 1.35f; gg = l + (gg - l) * 1.35f; bl = l + (bl - l) * 1.35f
                    px[i] = pack(sCurve(r), sCurve(gg), sCurve(bl))
                }
                return out()
            }
            MODE_LIGHTEN -> {
                val ch = flattenChannels(px, w, h, 250f)
                for (i in px.indices) px[i] = pack(gamma(ch[0][i], 0.68f), gamma(ch[1][i], 0.68f), gamma(ch[2][i], 0.68f))
                return out()
            }
            MODE_CRISP -> {
                val ch = flattenChannels(px, w, h, 248f)
                val n = w * h
                for (k in 0..2) {
                    val blur = gaussianFull(ch[k], w, h, 1.3f, 4)
                    val a = ch[k]
                    for (i in 0 until n) a[i] = sCurve(a[i] + 1.4f * (a[i] - blur[i]), 0.35f)
                }
                for (i in 0 until n) px[i] = pack(ch[0][i], ch[1][i], ch[2][i])
                return out()
            }
        }
        val flat = FloatArray(w * h) { min(255f, g[it] / (bg[it] + 1f) * 245f).toInt().toFloat() }
        when (mode) {
            MODE_GRAY -> { for (i in px.indices) { val v = flat[i].toInt(); px[i] = (255 shl 24) or (v shl 16) or (v shl 8) or v }; return out() }
            MODE_SCANNER, MODE_ECO -> {
                val hist = IntArray(256); for (v in flat) hist[v.toInt()]++
                var acc = 0; var black = 0; val target = (w.toLong() * h * 0.015).toInt()
                while (black < 255 && acc + hist[black] < target) { acc += hist[black]; black++ }
                val lo = min(black.toFloat(), 120f); val hi = 232f
                val eco = mode == MODE_ECO
                for (i in px.indices) {
                    val t = ((flat[i] - lo) / (hi - lo)).coerceIn(0f, 1f)
                    var v = 255f * (0.3f * t + 0.7f * (t * t * (3f - 2f * t)))
                    if (eco) v = 255f - (255f - v) * 0.55f
                    px[i] = pack(v, v, v)
                }
                return out()
            }
        }
        // MODE_BW: adaptive threshold, gaussian 31x31 (sigma 5), C=15
        val blur = gaussianFull(flat, w, h, 5f, 15)
        for (i in px.indices) { val v = if (flat[i] > blur[i] - 15f) 255 else 0; px[i] = (255 shl 24) or (v shl 16) or (v shl 8) or v }
        return out()
    }

    /** Per-channel shadow flatten (R,G,B each divided by its own background estimate). Built one channel at a time to keep peak memory low. */
    private fun flattenChannels(px: IntArray, w: Int, h: Int, gain: Float): Array<FloatArray> {
        val sw = max(8, w / 8); val sh = max(8, h / 8)
        return Array(3) { k ->
            val shift = 16 - 8 * k
            val c = IntArray(w * h) { (px[it] shr shift) and 255 }
            var sm = areaGray(c, w, h, sw, sh)
            sm = grayClose(sm, sw, sh, 9)
            sm = gaussian(sm, sw, sh, 5f)
            val bg = upscaleBilinear(sm, sw, sh, w, h)
            FloatArray(w * h) { c[it] / (bg[it] + 1f) * gain }
        }
    }

    /** Contrast S-curve on 0..255, `k` = strength (0 = identity, 1 = full smoothstep). */
    private fun sCurve(v: Float, k: Float = 0.45f): Float {
        val t = (v / 255f).coerceIn(0f, 1f)
        return 255f * ((1f - k) * t + k * (t * t * (3f - 2f * t)))
    }
    private fun gamma(v: Float, g: Float): Float = 255f * (v / 255f).coerceIn(0f, 1f).pow(g)

    private fun areaGray(g: IntArray, w: Int, h: Int, nw: Int, nh: Int): FloatArray {
        val out = FloatArray(nw * nh); val sx = w.toFloat() / nw; val sy = h.toFloat() / nh
        for (y in 0 until nh) for (x in 0 until nw) {
            val x0 = (x * sx).toInt(); val x1 = max(x0 + 1, min(w, ((x + 1) * sx).toInt())); val y0 = (y * sy).toInt(); val y1 = max(y0 + 1, min(h, ((y + 1) * sy).toInt()))
            var s = 0L; for (yy in y0 until y1) for (xx in x0 until x1) s += g[yy * w + xx]
            out[y * nw + x] = s.toFloat() / ((x1 - x0) * (y1 - y0))
        }
        return out
    }

    private fun grayClose(a: FloatArray, w: Int, h: Int, k: Int): FloatArray {
        fun pass(src: FloatArray, isMax: Boolean): FloatArray {
            val r = k / 2; val t = FloatArray(w * h); val o = FloatArray(w * h)
            for (y in 0 until h) for (x in 0 until w) { var v = src[y * w + x]; for (d in -r..r) { val xx = x + d; if (xx in 0 until w) { val s = src[y * w + xx]; if (isMax) { if (s > v) v = s } else if (s < v) v = s } }; t[y * w + x] = v }
            for (y in 0 until h) for (x in 0 until w) { var v = t[y * w + x]; for (d in -r..r) { val yy = y + d; if (yy in 0 until h) { val s = t[yy * w + x]; if (isMax) { if (s > v) v = s } else if (s < v) v = s } }; o[y * w + x] = v }
            return o
        }
        return pass(pass(a, true), false)
    }

    private fun kernel(sigma: Float, radius: Int): FloatArray {
        val k = FloatArray(2 * radius + 1) { exp(-((it - radius) * (it - radius)) / (2 * sigma * sigma)) }
        val s = k.sum(); for (i in k.indices) k[i] /= s; return k
    }
    private fun gaussian(a: FloatArray, w: Int, h: Int, sigma: Float): FloatArray = gaussianFull(a, w, h, sigma, ceil(sigma * 3).toInt())
    private fun gaussianFull(a: FloatArray, w: Int, h: Int, sigma: Float, radius: Int): FloatArray {
        val k = kernel(sigma, radius); val t = FloatArray(w * h); val o = FloatArray(w * h)
        fun refl(i: Int, n: Int): Int { var j = i; if (j < 0) j = -j; if (j >= n) j = 2 * (n - 1) - j; return j.coerceIn(0, n - 1) }
        for (y in 0 until h) { val row = y * w; for (x in 0 until w) { var s = 0f; for (d in -radius..radius) s += k[d + radius] * a[row + refl(x + d, w)]; t[row + x] = s } }
        for (y in 0 until h) for (x in 0 until w) { var s = 0f; for (d in -radius..radius) s += k[d + radius] * t[refl(y + d, h) * w + x]; o[y * w + x] = s }
        return o
    }

    private fun upscaleBilinear(a: FloatArray, sw: Int, sh: Int, w: Int, h: Int): FloatArray {
        val out = FloatArray(w * h); val fx = sw.toFloat() / w; val fy = sh.toFloat() / h
        for (y in 0 until h) {
            val gy = ((y + 0.5f) * fy - 0.5f).coerceIn(0f, sh - 1f); val y0 = gy.toInt(); val y1 = min(sh - 1, y0 + 1); val wy = gy - y0
            for (x in 0 until w) {
                val gx = ((x + 0.5f) * fx - 0.5f).coerceIn(0f, sw - 1f); val x0 = gx.toInt(); val x1 = min(sw - 1, x0 + 1); val wx = gx - x0
                out[y * w + x] = (a[y0 * sw + x0] * (1 - wx) + a[y0 * sw + x1] * wx) * (1 - wy) + (a[y1 * sw + x0] * (1 - wx) + a[y1 * sw + x1] * wx) * wy
            }
        }
        return out
    }

    fun saveJpeg(b: Bitmap, f: File, q: Int = 92) { f.parentFile?.mkdirs(); f.outputStream().use { b.compress(Bitmap.CompressFormat.JPEG, q, it) } }
}
