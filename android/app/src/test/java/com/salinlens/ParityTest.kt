package com.salinlens

import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.exp
import kotlin.math.hypot
import kotlin.math.max

/** Compares the Kotlin postprocess against the Python reference (qfm_gated, merge_dist=16) on dumped logits. */
class ParityTest {
    @Test fun matchesPython() {
        val dir = System.getProperty("parity.dir").orEmpty()
        assumeTrue(dir.isNotEmpty())
        val ref = JSONObject(File(dir, "ref.json").readText())
        var worst = 0f; var fails = 0
        for (name in ref.keys()) {
            val bb = ByteBuffer.wrap(File(dir, "$name.logit").readBytes()).order(ByteOrder.LITTLE_ENDIAN)
            val prob = FloatArray(320 * 192) { 1f / (1f + exp(-bb.getFloat())) }
            QuadFromMask.DEBUG = name == "d_pile"
            val r = QuadFromMask.run(prob)
            val e = ref.getJSONObject(name)
            if (e.isNull("quad")) { println("$name: ref none, kt=${r?.quad?.toList()}"); if (r != null) fails++; continue }
            if (r == null) { println("$name: kt none"); fails++; continue }
            val q = e.getJSONArray("quad")
            val d = (0 until 4).maxOf { hypot(r.quad[2 * it] - q.getDouble(2 * it), r.quad[2 * it + 1] - q.getDouble(2 * it + 1)).toFloat() }
            println("%-14s maxCornerErr=%.2f px  conf kt=%.3f py=%.3f".format(name, d, r.conf, e.getDouble("conf")))
            if (d > 4f) println("   kt=${r.quad.map { it.toInt() }} py=${(0 until 8).map { q.getDouble(it).toInt() }}"); worst = max(worst, d); if (d > 4f) fails++
        }
        println("worst=$worst fails=$fails")
        assertTrue("parity failures: $fails", fails == 0)
    }
}
