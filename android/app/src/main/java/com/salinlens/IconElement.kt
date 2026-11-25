package com.salinlens

import android.content.Context
import android.graphics.*
import android.view.View
import androidx.core.graphics.PathParser
import com.lynx.tasm.behavior.LynxContext
import com.lynx.tasm.behavior.LynxProp
import com.lynx.tasm.behavior.ui.LynxUI

/** <salin-icon name|d color stroke filled> — 24x24 icons drawn from path data (no SVG library, no bitmaps). `d` = raw path data (brand glyphs). */
class IconElement(ctx: LynxContext) : LynxUI<IconElement.IconView>(ctx) {
    override fun createView(context: Context) = IconView(context)
    @LynxProp(name = "name") fun setIconName(v: String) { mView.setName(v) }
    @LynxProp(name = "d") fun setIconPath(v: String) { mView.setPathData(v) }
    @LynxProp(name = "color") fun setIconColor(v: String) { mView.setColor(v) }
    @LynxProp(name = "stroke") fun setIconStroke(v: Double) { mView.stroke = v.toFloat(); mView.invalidate() }
    @LynxProp(name = "filled") fun setIconFilled(v: Boolean) { mView.filled = v; mView.invalidate() }

    class IconView(ctx: Context) : View(ctx) {
        var stroke = 2f; var filled = false
        private var path: Path? = null
        private val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND; color = Color.BLACK }
        // props arrive in any order and brand icons send name="" next to d=...: keep both and resolve at draw time, so an empty name can never wipe the path
        private var nameKey = ""; private var raw = "" // raw path data = brand glyph = always a solid fill
        private fun resolve() { path = try { if (raw.isNotEmpty()) PathParser.createPathFromPathData(raw) else ICONS[nameKey]?.let { PathParser.createPathFromPathData(it) } } catch (_: Exception) { null }; invalidate() }
        fun setName(n: String) { nameKey = n; resolve() }
        fun setPathData(d: String) { raw = d; resolve() }
        fun setColor(c: String) { try { p.color = Color.parseColor(c) } catch (_: Exception) { }; invalidate() }
        override fun onDraw(c: Canvas) {
            val pa = path ?: return
            val s = minOf(width, height) / 24f
            c.save(); c.translate((width - 24 * s) / 2f, (height - 24 * s) / 2f); c.scale(s, s)
            p.style = if (raw.isNotEmpty() || (filled && stroke <= 0f)) Paint.Style.FILL else if (filled) Paint.Style.FILL_AND_STROKE else Paint.Style.STROKE; p.strokeWidth = stroke
            c.drawPath(pa, p); c.restore()
        }
    }
    companion object {
        val ICONS = mapOf(
            // app logo (ink-scan-brackets-dawn.svg redrawn on the 24 grid; draw with stroke 1.36)
            "logo" to "M5.53 9.05V5.53H9.05 M14.95 5.53H18.47V9.05 M18.47 14.95V18.47H14.95 M9.05 18.47H5.53V14.95 M7.64 12H16.36",
            "scan" to "M3 7V5a2 2 0 0 1 2-2h2 M17 3h2a2 2 0 0 1 2 2v2 M21 17v2a2 2 0 0 1-2 2h-2 M7 21H5a2 2 0 0 1-2-2v-2 M7 12h10",
            "image" to "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M21 15l-5-5L5 21",
            "flash" to "M13 2L4 14h7l-1 8 9-12h-7z",
            "flashOff" to "M13 2L4 14h7l-1 8 9-12h-7z M3 3l18 18",
            "close" to "M18 6L6 18 M6 6l12 12",
            "check" to "M5 12.5l4.5 4.5L19 7.5",
            "back" to "M15 5l-7 7 7 7",
            "chevron" to "M9 5l7 7-7 7",
            "share" to "M12 15V3 M7 8l5-5 5 5 M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6",
            "filePlus" to "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M12 11v6 M9 14h6",
            "file" to "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M9 13h6 M9 17h4",
            "trash" to "M4 7h16 M10 11v6 M14 11v6 M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12 M9 7V4h6v3",
            "plus" to "M12 5v14 M5 12h14",
            "rotate" to "M20 11a8 8 0 1 0-2.3 5.7 M20 4v7h-7",
            "crop" to "M6 2v14a2 2 0 0 0 2 2h14 M18 22V8a2 2 0 0 0-2-2H2",
            "wand" to "M5 19L16 8 M16 4v3 M14.5 5.5h3 M20 10v3 M18.5 11.5h3 M7 4v3 M5.5 5.5h3",
            "camera" to "M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z M12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
            "convert" to "M4 8h14 M14 4l4 4-4 4 M20 16H6 M10 12l-4 4 4 4",
            "edit" to "M4 20h4L19 9l-4-4L4 16z M13 7l4 4",
            "search" to "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M20 20l-4-4",
            "download" to "M12 3v12 M7 10l5 5 5-5 M5 21h14",
            "sparkle" to "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z",
            "layers" to "M12 3l9 5-9 5-9-5z M3 13l9 5 9-5",
        )
    }
}
