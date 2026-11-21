package com.salinlens

import kotlin.math.*

/** Pure-Kotlin port of docscan quad_from_mask (+ distance gate 16 px, the setting the C0+0.25HN+0.5MIDV model was selected with). */
object QuadFromMask {
    const val NW = 320
    const val NH = 192
    var DEBUG = false

    class Result(val quad: FloatArray /* tl,tr,br,bl x,y in mask px */, val conf: Float)

    fun run(
        prob: FloatArray, w: Int = NW, h: Int = NH,
        thr: Float = 0.5f, minArea: Float = 0.02f, close: Int = 7, frag: Float = 0.15f, mergeDist: Float = 16f,
    ): Result? {
        var pm = 0f
        for (v in prob) if (v > pm) pm = v
        if (pm < 0.2f) return null
        val t = min(thr, 0.5f * pm)
        var m = ByteArray(w * h) { if (prob[it] > t) 1 else 0 }
        m = dilate(erode(m, w, h, 3), w, h, 3)                       // open 3x3
        if (close > 0) m = erode(dilate(m, w, h, close), w, h, close) // close
        // 8-connected components
        val lab = IntArray(w * h); var n = 0
        val area = ArrayList<Int>(); val stack = IntArray(w * h)
        for (s in 0 until w * h) {
            if (m[s].toInt() == 0 || lab[s] != 0) continue
            n++; var sp = 0; var cnt = 0; stack[sp++] = s; lab[s] = n
            while (sp > 0) {
                val p = stack[--sp]; cnt++
                val px = p % w; val py = p / w
                for (dy in -1..1) for (dx in -1..1) {
                    if (dx == 0 && dy == 0) continue
                    val qx = px + dx; val qy = py + dy
                    if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue
                    val q = qy * w + qx
                    if (m[q].toInt() != 0 && lab[q] == 0) { lab[q] = n; stack[sp++] = q }
                }
            }
            area.add(cnt)
        }
        if (n == 0) return null
        var ib = 0; for (i in 1 until n) if (area[i] > area[ib]) ib = i
        val amax = area[ib]
        if (amax < minArea * w * h) return null
        val keep = BooleanArray(n) { area[it] >= frag * amax }
        if (mergeDist > 0 && keep.count { it } > 1) {
            val dist = chamfer(lab, ib + 1, w, h)
            val minD = FloatArray(n) { Float.MAX_VALUE }
            for (p in 0 until w * h) { val l = lab[p]; if (l > 0 && dist[p] < minD[l - 1]) minD[l - 1] = dist[p] }
            for (i in 0 until n) if (i != ib && keep[i] && minD[i] > mergeDist) keep[i] = false
        }
        // hull of all kept pixels' boundary
        val pts = ArrayList<Long>()
        var areaSum = 0
        for (p in 0 until w * h) {
            val l = lab[p]; if (l == 0 || !keep[l - 1]) continue
            val x = p % w; val y = p / w
            val edge = x == 0 || y == 0 || x == w - 1 || y == h - 1 ||
                lab[p - 1] != l || lab[p + 1] != l || lab[p - w] != l || lab[p + w] != l
            if (edge) pts.add((x.toLong() shl 32) or y.toLong())
        }
        for (i in 0 until n) if (keep[i]) areaSum += area[i]
        val xs = IntArray(pts.size) { (pts[it] shr 32).toInt() }
        val ys = IntArray(pts.size) { (pts[it] and 0xffffffffL).toInt() }
        var hull = convexHull(xs, ys)
        hull = cvOrder(hull, xs, ys)
        if (DEBUG) println("DBG n=$n areas=$area mask=${m.sum()} hull=${hull.size} ${hull.joinToString { "(${it[0].toInt()},${it[1].toInt()})" }}")
        if (hull.size < 3) return null
        val q = quadFromHull(hull)
        var sum = 0f; var c = 0
        for (p in 0 until w * h) if (m[p].toInt() != 0) { sum += prob[p]; c++ }
        val qa = polyArea(q)
        val conf = (sum / max(1, c)) * min(1f, areaSum / max(1e-6f, qa))
        return Result(orderQuad(q), conf)
    }

    // --- morphology: separable box min/max, out-of-bounds ignored (matches cv2 default border) ---
    private fun erode(a: ByteArray, w: Int, h: Int, k: Int) = boxFilter(a, w, h, k, true)
    private fun dilate(a: ByteArray, w: Int, h: Int, k: Int) = boxFilter(a, w, h, k, false)
    private fun boxFilter(a: ByteArray, w: Int, h: Int, k: Int, isMin: Boolean): ByteArray {
        val r = k / 2
        val tmp = ByteArray(w * h); val out = ByteArray(w * h)
        for (y in 0 until h) for (x in 0 until w) {
            var v = if (isMin) 1 else 0
            for (dx in -r..r) { val xx = x + dx; if (xx < 0 || xx >= w) continue
                val s = a[y * w + xx].toInt()
                if (isMin) { if (s == 0) { v = 0; break } } else if (s != 0) { v = 1; break } }
            tmp[y * w + x] = v.toByte()
        }
        for (y in 0 until h) for (x in 0 until w) {
            var v = if (isMin) 1 else 0
            for (dy in -r..r) { val yy = y + dy; if (yy < 0 || yy >= h) continue
                val s = tmp[yy * w + x].toInt()
                if (isMin) { if (s == 0) { v = 0; break } } else if (s != 0) { v = 1; break } }
            out[y * w + x] = v.toByte()
        }
        return out
    }

    /** distance (px) to the nearest pixel of component `id`; 3-4 chamfer. */
    private fun chamfer(lab: IntArray, id: Int, w: Int, h: Int): FloatArray {
        val d = FloatArray(w * h) { if (lab[it] == id) 0f else 1e9f }
        val a = 1f; val b = 1.4142f
        for (y in 0 until h) for (x in 0 until w) {
            val i = y * w + x; var v = d[i]
            if (x > 0) v = min(v, d[i - 1] + a)
            if (y > 0) { v = min(v, d[i - w] + a)
                if (x > 0) v = min(v, d[i - w - 1] + b); if (x < w - 1) v = min(v, d[i - w + 1] + b) }
            d[i] = v
        }
        for (y in h - 1 downTo 0) for (x in w - 1 downTo 0) {
            val i = y * w + x; var v = d[i]
            if (x < w - 1) v = min(v, d[i + 1] + a)
            if (y < h - 1) { v = min(v, d[i + w] + a)
                if (x < w - 1) v = min(v, d[i + w + 1] + b); if (x > 0) v = min(v, d[i + w - 1] + b) }
            d[i] = v
        }
        return d
    }

    // --- geometry ---
    fun convexHull(xs: IntArray, ys: IntArray): Array<FloatArray> {
        val idx = xs.indices.sortedWith(compareBy({ xs[it] }, { ys[it] }))
        fun cross(o: Int, a: Int, b: Int) =
            (xs[a] - xs[o]).toLong() * (ys[b] - ys[o]) - (ys[a] - ys[o]).toLong() * (xs[b] - xs[o])
        val hull = ArrayList<Int>()
        for (i in idx) { while (hull.size >= 2 && cross(hull[hull.size - 2], hull[hull.size - 1], i) <= 0) hull.removeAt(hull.size - 1); hull.add(i) }
        val lo = hull.size + 1
        for (j in idx.size - 2 downTo 0) { val i = idx[j]
            while (hull.size >= lo && cross(hull[hull.size - 2], hull[hull.size - 1], i) <= 0) hull.removeAt(hull.size - 1); hull.add(i) }
        if (hull.size > 1) hull.removeAt(hull.size - 1)
        return Array(hull.size) { floatArrayOf(xs[hull[it]].toFloat(), ys[hull[it]].toFloat()) }
    }

    /** make hull clockwise (screen) and rotate so the raster-first point is last, as cv2.convexHull(findContours) returns it. */
    private fun cvOrder(h: Array<FloatArray>, xs: IntArray, ys: IntArray): Array<FloatArray> {
        var a = 0f
        for (i in h.indices) { val j = (i + 1) % h.size; a += h[i][0] * h[j][1] - h[j][0] * h[i][1] }
        val cw = if (a < 0) h.reversedArray() else h   // shoelace>0 with y down == clockwise on screen
        var my = Int.MAX_VALUE; var mx = Int.MAX_VALUE
        for (k in xs.indices) if (ys[k] < my || (ys[k] == my && xs[k] < mx)) { my = ys[k]; mx = xs[k] }
        val p0 = cw.indexOfFirst { it[0].toInt() == mx && it[1].toInt() == my }
        if (p0 < 0) return cw
        return Array(cw.size) { cw[(p0 + 1 + it) % cw.size] }
    }

    private fun perimeter(p: Array<FloatArray>): Float { var s = 0f
        for (i in p.indices) { val a = p[i]; val b = p[(i + 1) % p.size]; s += hypot(a[0] - b[0], a[1] - b[1]) }; return s }

    fun polyArea(q: FloatArray): Float { var s = 0f; val n = q.size / 2
        for (i in 0 until n) { val j = (i + 1) % n; s += q[2 * i] * q[2 * j + 1] - q[2 * j] * q[2 * i + 1] }; return abs(s) / 2f }

    private fun quadFromHull(hull: Array<FloatArray>): FloatArray {
        val peri = perimeter(hull)
        for (eps in floatArrayOf(0.02f, 0.03f, 0.045f, 0.07f)) {
            val ap = approxClosed(hull, eps * peri)
            if (ap.size == 4) return FloatArray(8) { ap[it / 2][it % 2] }
        }
        return minAreaRect(hull)
    }

    /** Faithful port of cv::approxPolyDP (closed=true), so quads match the Python reference. */
    private fun approxClosed(pts: Array<FloatArray>, epsIn: Float): List<FloatArray> {
        val count0 = pts.size; val count = count0
        val eps = epsIn.toDouble() * epsIn.toDouble()
        val dst = ArrayList<FloatArray>()
        val stack = ArrayDeque<IntArray>()
        var pos = 0; var rsStart = 0; var leEps = false
        var startPt = pts[0]
        for (iter in 0 until 3) { // init_iters = 3
            var maxDist = 0.0
            pos = (pos + rsStart) % count
            startPt = pts[pos]; pos = (pos + 1) % count
            for (j in 1 until count) {
                val pt = pts[pos]; pos = (pos + 1) % count
                val dx = (pt[0] - startPt[0]).toDouble(); val dy = (pt[1] - startPt[1]).toDouble()
                val d = dx * dx + dy * dy
                if (d > maxDist) { maxDist = d; rsStart = j }
            }
            leEps = maxDist <= eps
        }
        var sliceStart = 0; var sliceEnd = 0
        if (!leEps) {
            val rsEnd = pos % count; sliceStart = rsEnd
            sliceEnd = (rsStart + sliceStart) % count
            val rsStart2 = sliceEnd
            stack.addLast(intArrayOf(rsStart2, rsEnd)); stack.addLast(intArrayOf(sliceStart, sliceEnd))
        } else dst.add(startPt)
        while (stack.isNotEmpty()) {
            val sl = stack.removeLast(); var sStart = sl[0]; val sEnd = sl[1]
            val endPt = pts[sEnd]; var p = sStart
            val st = pts[p]; p = (p + 1) % count
            var le: Boolean; var rightStart = 0
            if (p != sEnd) {
                val dx = (endPt[0] - st[0]).toDouble(); val dy = (endPt[1] - st[1]).toDouble()
                val segLen2 = dx * dx + dy * dy; var maxD = 0.0
                while (p != sEnd) {
                    val pt = pts[p]; p = (p + 1) % count
                    val proj = (pt[0] - st[0]) * dx + (pt[1] - st[1]) * dy
                    val d2 = if (proj < 0) ((pt[0] - st[0]) * (pt[0] - st[0]) + (pt[1] - st[1]) * (pt[1] - st[1])) * segLen2
                    else if (proj > segLen2) ((pt[0] - endPt[0]) * (pt[0] - endPt[0]) + (pt[1] - endPt[1]) * (pt[1] - endPt[1])) * segLen2
                    else { val dist = (pt[1] - st[1]) * dx - (pt[0] - st[0]) * dy; dist * dist }
                    if (d2 > maxD) { maxD = d2; rightStart = (p + count - 1) % count }
                }
                le = maxD <= eps * segLen2
            } else le = true
            if (le) dst.add(st)
            else { stack.addLast(intArrayOf(rightStart, sEnd)); stack.addLast(intArrayOf(sStart, rightStart)) }
        }
        // final clean-up: drop near-collinear vertices (closed), exactly as cv2 does in place
        val c = dst.size; var newCount = c
        var pos2 = c - 1
        var sp = dst[pos2]; pos2 = (pos2 + 1) % c
        var wpos = pos2
        var pt = dst[pos2]; pos2 = (pos2 + 1) % c
        var i = 0
        while (i < c && newCount > 2) {
            val ep = dst[pos2]; pos2 = (pos2 + 1) % c
            val dx = (ep[0] - sp[0]).toDouble(); val dy = (ep[1] - sp[1]).toDouble()
            val dist = abs((pt[0] - sp[0]) * dy - (pt[1] - sp[1]) * dx)
            val inner = (pt[0] - sp[0]) * (ep[0] - pt[0]) + (pt[1] - sp[1]) * (ep[1] - pt[1])
            if (dist * dist <= 0.5 * eps * (dx * dx + dy * dy) && dx != 0.0 && dy != 0.0 && inner >= 0) {
                newCount--; sp = ep; dst[wpos] = ep; wpos = (wpos + 1) % c
                pt = dst[pos2]; pos2 = (pos2 + 1) % c
                i++; i++; continue
            }
            dst[wpos] = pt; sp = pt; wpos = (wpos + 1) % c
            pt = ep; i++
        }
        return dst.subList(0, newCount)
    }

    private fun minAreaRect(hull: Array<FloatArray>): FloatArray {
        var best = Float.MAX_VALUE; var res = FloatArray(8)
        for (i in hull.indices) {
            val a = hull[i]; val b = hull[(i + 1) % hull.size]
            val ex = b[0] - a[0]; val ey = b[1] - a[1]; val l = hypot(ex, ey); if (l < 1e-6f) continue
            val ux = ex / l; val uy = ey / l; val vx = -uy; val vy = ux
            var u0 = Float.MAX_VALUE; var u1 = -Float.MAX_VALUE; var v0 = Float.MAX_VALUE; var v1 = -Float.MAX_VALUE
            for (p in hull) { val u = p[0] * ux + p[1] * uy; val v = p[0] * vx + p[1] * vy
                u0 = min(u0, u); u1 = max(u1, u); v0 = min(v0, v); v1 = max(v1, v) }
            val ar = (u1 - u0) * (v1 - v0)
            if (ar < best) { best = ar
                fun pt(u: Float, v: Float, o: Int) { res[o] = u * ux + v * vx; res[o + 1] = u * uy + v * vy }
                pt(u0, v0, 0); pt(u1, v0, 2); pt(u1, v1, 4); pt(u0, v1, 6) }
        }
        return res
    }

    /** tl,tr,br,bl — angle sort around centroid, start at min(x+y), like docscan.order_quad. */
    fun orderQuad(q: FloatArray): FloatArray {
        val cx = (q[0] + q[2] + q[4] + q[6]) / 4; val cy = (q[1] + q[3] + q[5] + q[7]) / 4
        val order = (0 until 4).sortedBy { atan2(q[2 * it + 1] - cy, q[2 * it] - cx) }
        val tl = order.indices.minByOrNull { q[2 * order[it]] + q[2 * order[it] + 1] }!!
        val out = FloatArray(8)
        for (k in 0 until 4) { val s = order[(tl + k) % 4]; out[2 * k] = q[2 * s]; out[2 * k + 1] = q[2 * s + 1] }
        return out
    }
}
