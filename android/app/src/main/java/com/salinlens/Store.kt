package com.salinlens

import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.graphics.pdf.PdfDocument
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

/** Gallery index (gallery.json) + export of JPG / PNG / PDF. Exports stay app-private until the user picks "Save as file" (saveToPhone). */
object Store {
    private fun dir(ctx: Context, n: String) = File(ctx.filesDir, n).apply { mkdirs() }
    private fun index(ctx: Context) = File(ctx.filesDir, "gallery.json")

    @Synchronized fun list(ctx: Context): JSONArray = try { JSONArray(index(ctx).readText()) } catch (_: Exception) { JSONArray() }
    @Synchronized private fun write(ctx: Context, a: JSONArray) { index(ctx).writeText(a.toString()) }

    fun defaultName(): String = "Scan " + SimpleDateFormat("yyyy-MM-dd HH.mm", Locale.US).format(Date())
    private fun safe(n: String) = n.replace(Regex("[\\\\/:*?\"<>|\\n\\r]"), "_").trim().ifEmpty { defaultName() }.take(80)

    private fun unique(d: File, base: String, ext: String): File {
        var f = File(d, "$base.$ext"); var i = 2
        while (f.exists()) { f = File(d, "$base ($i).$ext"); i++ }
        return f
    }

    /**
     * formats: subset of "pdf","jpg","png". `render(i)` produces page i (the caller owns nothing; each bitmap is
     * recycled here). One page is rendered, written and recycled at a time so long scans stay within memory.
     * PDF = one file with every page; JPG/PNG = one file per page ("stem-1.jpg", ...), or "stem.jpg" for a single page.
     * Thumb, w and h come from page 1. Returns the new gallery item.
     */
    fun export(ctx: Context, count: Int, render: (Int) -> Bitmap, nameIn: String, formats: List<String>): JSONObject {
        require(count > 0) { "no pages" }
        val name = safe(nameIn); val id = UUID.randomUUID().toString().take(8)
        val out = dir(ctx, "out")
        fun imgName(stem: String, fmt: String, i: Int) = if (count == 1) "$stem.$fmt" else "$stem-${i + 1}.$fmt"
        fun names(stem: String) = formats.flatMap { fmt -> if (fmt == "pdf") listOf("$stem.pdf") else (0 until count).map { imgName(stem, fmt, it) } }
        // pick a collision-free stem across every file this export will write
        var stem = name; var n = 2
        while (names(stem).any { File(out, it).exists() }) { stem = "$name ($n)"; n++ }

        val written = ArrayList<File>(); val entries = ArrayList<JSONObject>()
        val pdf = if ("pdf" in formats) PdfDocument() else null
        var w = 0; var h = 0; val thumb = File(dir(ctx, "thumb"), "$id.jpg")
        try {
            for (i in 0 until count) {
                val page = render(i)
                try {
                    for (fmt in formats) {
                        if (fmt == "pdf") continue
                        val f = File(out, imgName(stem, fmt, i)); written.add(f)
                        f.outputStream().use { page.compress(if (fmt == "png") Bitmap.CompressFormat.PNG else Bitmap.CompressFormat.JPEG, if (fmt == "png") 100 else 92, it) }
                        entries.add(JSONObject().put("fmt", fmt).put("path", f.absolutePath).put("size", f.length()).put("page", i + 1))
                    }
                    pdf?.let { addPdfPage(it, page, i + 1) }
                    if (i == 0) {
                        w = page.width; h = page.height
                        val ts = Bitmap.createScaledBitmap(page, 480, (480f * page.height / page.width).toInt().coerceAtLeast(1), true)
                        Imaging.saveJpeg(ts, thumb, 82); ts.recycle()
                    }
                } finally { page.recycle() }
            }
            if (pdf != null) {
                val f = File(out, "$stem.pdf"); written.add(f)
                f.outputStream().use { pdf.writeTo(it) }
                entries.add(JSONObject().put("fmt", "pdf").put("path", f.absolutePath).put("size", f.length()).put("page", 0))
            }
        } catch (e: Exception) {
            written.forEach { it.delete() }; thumb.delete(); throw e
        } finally { pdf?.close() }

        val files = JSONArray(); entries.sortedBy { formats.indexOf(it.getString("fmt")) }.forEach { files.put(it) }
        val item = JSONObject().put("id", id).put("name", stem).put("ts", System.currentTimeMillis())
            .put("w", w).put("h", h).put("pages", count).put("thumb", thumb.absolutePath).put("files", files)
        synchronized(this) { val a = list(ctx); val na = JSONArray().put(item); for (i in 0 until a.length()) na.put(a.get(i)); write(ctx, na) }
        return item
    }

    private fun addPdfPage(doc: PdfDocument, page: Bitmap, number: Int) {
        val pw = 595; val ph = (pw * page.height.toFloat() / page.width).toInt().coerceAtLeast(1)
        val p = doc.startPage(PdfDocument.PageInfo.Builder(pw, ph, number).create())
        p.canvas.drawBitmap(page, null, android.graphics.Rect(0, 0, pw, ph), android.graphics.Paint(android.graphics.Paint.FILTER_BITMAP_FLAG))
        doc.finishPage(p)
    }

    private fun mimeOf(f: File) = when (f.extension.lowercase()) { "pdf" -> "application/pdf"; "png" -> "image/png"; else -> "image/jpeg" }

    /** Copy files into the shared Pictures/Documents folder (…/SalinLens) so the user can find them outside the app. Returns how many were saved. */
    fun saveToPhone(ctx: Context, paths: List<String>): Int {
        require(Build.VERSION.SDK_INT >= 29) { "Saving to the phone needs Android 10 or newer" }
        var n = 0
        for (path in paths) {
            val f = File(path); val mime = mimeOf(f); val isImg = mime.startsWith("image/")
            val cv = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, f.name); put(MediaStore.MediaColumns.MIME_TYPE, mime)
                put(MediaStore.MediaColumns.RELATIVE_PATH, (if (isImg) Environment.DIRECTORY_PICTURES else Environment.DIRECTORY_DOCUMENTS) + "/SalinLens")
            }
            val coll = if (isImg) MediaStore.Images.Media.EXTERNAL_CONTENT_URI else MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
            val uri = ctx.contentResolver.insert(coll, cv) ?: continue
            ctx.contentResolver.openOutputStream(uri)?.use { o -> f.inputStream().use { it.copyTo(o) } }
            n++
        }
        return n
    }

    fun delete(ctx: Context, id: String) {
        synchronized(this) {
            val a = list(ctx); val na = JSONArray()
            for (i in 0 until a.length()) {
                val o = a.getJSONObject(i)
                if (o.getString("id") == id) {
                    val fs = o.getJSONArray("files"); for (j in 0 until fs.length()) File(fs.getJSONObject(j).getString("path")).delete()
                    File(o.getString("thumb")).delete()
                } else na.put(o)
            }
            write(ctx, na)
        }
    }
}
