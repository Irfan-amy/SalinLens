package com.salinlens

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.view.HapticFeedbackConstants
import androidx.core.content.FileProvider
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule
import com.lynx.react.bridge.Callback
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/** JS-facing native API:  NativeModules.SalinNative.* — every async call answers with a JSON string. */
class SalinModule(context: Context) : LynxModule(context) {
    private val app get() = Host.app
    private fun ok(cb: Callback, o: JSONObject = JSONObject()) = cb.invoke(o.put("ok", true).toString())
    private fun fail(cb: Callback, e: Throwable) = cb.invoke(JSONObject().put("ok", false).put("error", e.message ?: e.javaClass.simpleName).toString())
    private fun bg(cb: Callback, block: () -> JSONObject) = Host.io.execute { try { ok(cb, block()) } catch (e: Throwable) { fail(cb, e) } }
    private fun quad(a: JSONArray?) = a?.let { FloatArray(8) { i -> a.getDouble(i).toFloat() } }

    @LynxMethod fun env(cb: Callback) {
        val a = Host.activity?.get()
        val r = a?.let { it.insets() } ?: floatArrayOf(0f, 0f)
        val dm = app.resources.displayMetrics
        ok(cb, JSONObject().put("top", r[0].toDouble()).put("bottom", r[1].toDouble()).put("name", Store.defaultName())
            .put("w", (dm.widthPixels / dm.density).toDouble()).put("h", (dm.heightPixels / dm.density).toDouble()))
    }

    @LynxMethod fun cameraPermission(ask: Boolean, cb: Callback) {
        val a = Host.activity?.get() ?: return ok(cb, JSONObject().put("granted", false))
        a.cameraPermission(ask) { g -> ok(cb, JSONObject().put("granted", g)) }
    }

    @LynxMethod fun capture(cb: Callback) {
        val cam = Host.camera?.get() ?: return fail(cb, IllegalStateException("camera not ready"))
        Host.main.post { cam.capture { path, err -> if (path != null) ok(cb, JSONObject().put("path", path)) else fail(cb, IllegalStateException(err ?: "capture failed")) } }
    }

    @LynxMethod fun pickImage(cb: Callback) {
        val a = Host.activity?.get() ?: return fail(cb, IllegalStateException("no activity"))
        a.pickImage { path -> if (path != null) ok(cb, JSONObject().put("path", path)) else ok(cb, JSONObject().put("path", JSONObject.NULL)) }
    }

    /** Detect the document in an image file. Quad normalized to the upright image; falls back to an inset rectangle. */
    @LynxMethod fun detect(path: String, cb: Callback) = bg(cb) {
        val bmp = Imaging.loadUpright(path, 1280) ?: error("cannot read image")
        val d = Detector.detect(app, bmp)
        val r = JSONObject().put("w", bmp.width).put("h", bmp.height)
        if (d != null) r.put("quad", JSONArray(d.quad.map { it.toDouble() })).put("conf", d.conf.toDouble()).put("found", true)
        else r.put("quad", JSONArray(listOf(0.08, 0.08, 0.92, 0.08, 0.92, 0.92, 0.08, 0.92))).put("conf", 0.0).put("found", false)
        bmp.recycle(); r
    }

    /** Rotate source image file 90deg clockwise; returns the new file and the rotated quad. */
    @LynxMethod fun rotate(path: String, quadJson: String, cb: Callback) = bg(cb) {
        val bmp = Imaging.loadUpright(path, 4096) ?: error("cannot read image")
        val rb = Imaging.rotate(bmp, 90)
        val f = File(app.cacheDir, "rot_${System.nanoTime()}.jpg"); Imaging.saveJpeg(rb, f, 95); rb.recycle()
        val q = Imaging.rotateQuad(quad(JSONArray(quadJson))!!, 1)
        JSONObject().put("path", f.absolutePath).put("quad", JSONArray(q.map { it.toDouble() }))
    }

    /** Render the corrected page preview (small) for the export screen. */
    @LynxMethod fun preview(path: String, quadJson: String, mode: String, cb: Callback) = bg(cb) {
        val page = renderPage(path, quad(JSONArray(quadJson))!!, mode, 1000)
        val f = File(app.cacheDir, "prev_${System.nanoTime()}.jpg"); Imaging.saveJpeg(page, f, 88)
        val r = JSONObject().put("path", f.absolutePath).put("w", page.width).put("h", page.height); page.recycle(); r
    }

    @LynxMethod fun export(optsJson: String, cb: Callback) = bg(cb) {
        val o = JSONObject(optsJson)
        val fm = o.getJSONArray("formats").let { a -> (0 until a.length()).map { a.getString(it) } }
        require(fm.isNotEmpty()) { "no format" }
        val pages = o.getJSONArray("pages"); require(pages.length() > 0) { "no pages" }
        val mode = o.optString("mode", Imaging.MODE_COLOR)
        val item = Store.export(app, pages.length(), { i ->
            val pg = pages.getJSONObject(i)
            renderPage(pg.getString("path"), quad(pg.getJSONArray("quad"))!!, mode, 2000)
        }, o.optString("name", ""), fm)
        JSONObject().put("item", item)
    }

    /** "Save as file": copy the chosen files to Pictures/Documents/SalinLens. */
    @LynxMethod fun saveFile(pathsJson: String, cb: Callback) = bg(cb) {
        val a = JSONArray(pathsJson)
        val n = Store.saveToPhone(app, (0 until a.length()).map { a.getString(it) })
        require(n > 0) { "Could not save" }
        JSONObject().put("count", n)
    }

    @LynxMethod fun gallery(cb: Callback) = bg(cb) { JSONObject().put("items", Store.list(app)) }
    @LynxMethod fun remove(id: String, cb: Callback) = bg(cb) { Store.delete(app, id); JSONObject() }

    /** Share targets shown on the Saved screen: brand id -> package names (first installed one wins). */
    private val SHARE_APPS = linkedMapOf(
        "whatsapp" to arrayOf("com.whatsapp", "com.whatsapp.w4b"), "instagram" to arrayOf("com.instagram.android"),
        "tiktok" to arrayOf("com.zhiliaoapp.musically", "com.ss.android.ugc.trill"), "telegram" to arrayOf("org.telegram.messenger", "org.telegram.messenger.web"),
        "facebook" to arrayOf("com.facebook.katana", "com.facebook.lite"), "messenger" to arrayOf("com.facebook.orca"),
        "x" to arrayOf("com.twitter.android"), "snapchat" to arrayOf("com.snapchat.android"), "discord" to arrayOf("com.discord"),
        "gmail" to arrayOf("com.google.android.gm"), "signal" to arrayOf("org.thoughtcrime.securesms"), "pinterest" to arrayOf("com.pinterest"),
        "reddit" to arrayOf("com.reddit.frontpage"), "threads" to arrayOf("com.instagram.barcelona"), "line" to arrayOf("jp.naver.line.android"),
        "viber" to arrayOf("com.viber.voip"),
    )

    /** Which share targets are installed. */
    @LynxMethod fun targets(cb: Callback) {
        val pm = app.packageManager
        fun has(vararg pk: String): String? = pk.firstOrNull { try { pm.getPackageInfo(it, 0); true } catch (_: PackageManager.NameNotFoundException) { false } }
        val t = JSONObject()
        for ((key, pks) in SHARE_APPS) t.put(key, has(*pks) ?: JSONObject.NULL)
        ok(cb, JSONObject().put("targets", t))
    }

    /** paths: files to share; pkg: package or "" for the system chooser. */
    @LynxMethod fun share(pathsJson: String, pkg: String, cb: Callback) {
        try {
            val a = JSONArray(pathsJson); val uris = ArrayList<android.net.Uri>(); val mimes = HashSet<String>()
            for (i in 0 until a.length()) {
                val f = File(a.getString(i))
                uris.add(FileProvider.getUriForFile(app, "com.salinlens.app.files", f))
                mimes.add(when (f.extension.lowercase()) { "pdf" -> "application/pdf"; "png" -> "image/png"; else -> "image/jpeg" })
            }
            val mime = if (mimes.size == 1) mimes.first() else if (mimes.all { it.startsWith("image/") }) "image/*" else "*/*"
            val i = if (uris.size == 1) Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_STREAM, uris[0])
                    else Intent(Intent.ACTION_SEND_MULTIPLE).putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
            i.type = mime; i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            // explicit ClipData + per-package grant: some apps (WhatsApp) only read the file when the permission is attached to the clip, not just the extra
            i.clipData = android.content.ClipData.newRawUri("scan", uris[0]).also { c -> for (k in 1 until uris.size) c.addItem(android.content.ClipData.Item(uris[k])) }
            if (pkg.isNotEmpty()) uris.forEach { try { app.grantUriPermission(pkg, it, Intent.FLAG_GRANT_READ_URI_PERMISSION) } catch (_: Exception) { } }
            val act = Host.activity?.get() ?: error("no activity")
            Host.main.post {
                try {
                    if (pkg.isNotEmpty()) { i.setPackage(pkg); act.startActivity(i) }
                    else act.startActivity(Intent.createChooser(i, "Share scan").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
                    ok(cb)
                } catch (e: Exception) {
                    // the app refused a direct share: fall back to the system list and tell the UI why
                    try { i.setPackage(null); act.startActivity(Intent.createChooser(i, "Share scan")); ok(cb, JSONObject().put("fallback", e.message ?: e.javaClass.simpleName)) } catch (e2: Exception) { fail(cb, e2) }
                }
            }
        } catch (e: Throwable) { fail(cb, e) }
    }

    @LynxMethod fun haptic(kind: String) {
        Host.main.post {
            val a = Host.activity?.get() ?: return@post
            val c = when (kind) { "tick" -> HapticFeedbackConstants.CLOCK_TICK; "heavy" -> HapticFeedbackConstants.LONG_PRESS
                "success" -> if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.VIRTUAL_KEY
                else -> HapticFeedbackConstants.KEYBOARD_TAP }
            a.window.decorView.performHapticFeedback(c)
        }
    }

    @LynxMethod fun exit() { Host.main.post { Host.activity?.get()?.finish() } }

    private fun renderPage(path: String, q: FloatArray, mode: String, longSide: Int): Bitmap {
        val src = Imaging.loadUpright(path, 3200) ?: error("cannot read image")
        val px = FloatArray(8) { if (it % 2 == 0) q[it].coerceIn(0f, 1f) * src.width else q[it].coerceIn(0f, 1f) * src.height }
        val w = Imaging.warp(src, px, longSide); src.recycle()
        val e = Imaging.enhance(w, mode); if (e !== w) w.recycle(); return e
    }
}
