package com.salinlens

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Scan drafts: a scan that was captured but never saved. Photos live in filesDir/drafts (not cacheDir, which the OS may clear),
 * the page list + crop quads in drafts.json. A draft is written as the scan changes and removed once the scan is saved or discarded.
 */
object Drafts {
    private fun dir(ctx: Context) = File(ctx.filesDir, "drafts").apply { mkdirs() }
    private fun index(ctx: Context) = File(ctx.filesDir, "drafts.json")

    /** where captured / imported / rotated photos are written, so a draft can still open them after a restart */
    fun photo(ctx: Context, prefix: String) = File(dir(ctx), "${prefix}_${System.nanoTime()}.jpg")

    @Synchronized fun list(ctx: Context): JSONArray {
        val a = try { JSONArray(index(ctx).readText()) } catch (_: Exception) { JSONArray() }
        val keep = JSONArray()
        for (i in 0 until a.length()) { // drop pages whose photo is gone, and drafts left with none
            val d = a.getJSONObject(i); val ps = d.getJSONArray("pages"); val ok = JSONArray()
            for (j in 0 until ps.length()) if (File(ps.getJSONObject(j).getString("path")).exists()) ok.put(ps.get(j))
            if (ok.length() > 0) keep.put(d.put("pages", ok))
        }
        return keep
    }

    @Synchronized private fun write(ctx: Context, a: JSONArray) {
        // write aside, then rename: being killed mid-write leaves the old index intact instead of a truncated one
        val tmp = File(ctx.filesDir, "drafts.json.tmp"); tmp.writeText(a.toString())
        check(tmp.renameTo(index(ctx))) { "could not write drafts" }
        sweep(ctx, a)
    }

    /** insert or replace draft `id` (newest first) */
    @Synchronized fun save(ctx: Context, id: String, pages: JSONArray) {
        val old = list(ctx); val na = JSONArray()
        na.put(JSONObject().put("id", id).put("ts", System.currentTimeMillis()).put("pages", pages))
        for (i in 0 until old.length()) if (old.getJSONObject(i).getString("id") != id) na.put(old.get(i))
        write(ctx, na)
    }

    @Synchronized fun remove(ctx: Context, id: String) {
        val old = list(ctx); val na = JSONArray()
        for (i in 0 until old.length()) {
            val d = old.getJSONObject(i)
            if (d.getString("id") != id) { na.put(d); continue }
            val ps = d.getJSONArray("pages"); for (j in 0 until ps.length()) File(ps.getJSONObject(j).getString("path")).delete()
        }
        write(ctx, na)
    }

    /** delete photos no draft refers to (discarded pages, pre-rotation copies). The age floor protects photos of a scan whose draft is not written yet. */
    private fun sweep(ctx: Context, a: JSONArray) {
        val used = HashSet<String>()
        for (i in 0 until a.length()) { val ps = a.getJSONObject(i).getJSONArray("pages"); for (j in 0 until ps.length()) used.add(ps.getJSONObject(j).getString("path")) }
        val cut = System.currentTimeMillis() - 60 * 60 * 1000
        dir(ctx).listFiles()?.forEach { if (it.absolutePath !in used && it.lastModified() < cut) it.delete() }
    }
}
