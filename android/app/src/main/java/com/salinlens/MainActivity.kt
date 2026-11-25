package com.salinlens

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.View
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.lynx.react.bridge.JavaOnlyArray
import com.lynx.tasm.LynxView
import com.lynx.tasm.LynxViewBuilder
import com.lynx.xelement.XElementBehaviors
import java.io.File
import java.lang.ref.WeakReference

class MainActivity : ComponentActivity() {
    private lateinit var lynxView: LynxView
    private var permCb: ((Boolean) -> Unit)? = null
    private var pickCb: ((String?) -> Unit)? = null
    private var insetTop = 0f; private var insetBottom = 0f

    private val permLauncher = registerForActivityResult(ActivityResultContracts.RequestPermission()) { g -> permCb?.invoke(g); permCb = null }
    private val pickLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri -> handlePick(uri) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Host.activity = WeakReference(this)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT; window.navigationBarColor = Color.TRANSPARENT
        val b = LynxViewBuilder()
        b.addBehaviors(XElementBehaviors().create())
        b.addBehaviors(SalinBehaviors.create())
        b.setTemplateProvider(TemplateProvider(this))
        lynxView = b.build(this)
        setContentView(lynxView)
        ViewCompat.setOnApplyWindowInsetsListener(lynxView) { _, w ->
            val i = w.getInsets(WindowInsetsCompat.Type.systemBars()); val d = resources.displayMetrics.density
            insetTop = i.top / d; insetBottom = i.bottom / d; w
        }
        ViewCompat.requestApplyInsets(lynxView)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() { lynxView.sendGlobalEvent("salinBack", JavaOnlyArray()) }
        })
        lynxView.renderTemplateUrl("main.lynx.bundle", "")
        // debug builds only: `am start --es img <path>` opens the adjust screen on an image (used for automated screenshots)
        if (applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE != 0) {
            intent.getStringExtra("nav")?.let { n -> Host.main.postDelayed({ lynxView.sendGlobalEvent("salinNav", JavaOnlyArray().apply { pushString(n) }) }, 3200) }
            intent.getStringExtra("img")?.let { p -> Host.main.postDelayed({ lynxView.sendGlobalEvent("salinOpenImage", JavaOnlyArray().apply { pushString(p) }) }, 3200) }
        }
    }

    fun setLightIcons(light: Boolean) { WindowInsetsControllerCompat(window, window.decorView).apply { isAppearanceLightStatusBars = !light; isAppearanceLightNavigationBars = !light } }
    fun insets(): FloatArray {
        ViewCompat.getRootWindowInsets(window.decorView)?.getInsets(WindowInsetsCompat.Type.systemBars())?.let {
            val d = resources.displayMetrics.density; insetTop = it.top / d; insetBottom = it.bottom / d
        }
        return floatArrayOf(insetTop, insetBottom)
    }

    fun cameraPermission(ask: Boolean, cb: (Boolean) -> Unit) {
        val has = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        if (has || !ask) { cb(has); return }
        permCb = cb; runOnUiThread { permLauncher.launch(Manifest.permission.CAMERA) }
    }

    fun pickImage(cb: (String?) -> Unit) { pickCb = cb; runOnUiThread { pickLauncher.launch("image/*") } }
    private fun handlePick(uri: Uri?) {
        val cb = pickCb; pickCb = null
        if (uri == null) { cb?.invoke(null); return }
        Host.io.execute {
            val f = Drafts.photo(this, "imp")
            try { contentResolver.openInputStream(uri)?.use { i -> f.outputStream().use { i.copyTo(it) } }; cb?.invoke(f.absolutePath) } catch (_: Exception) { cb?.invoke(null) }
        }
    }

    override fun onDestroy() { super.onDestroy(); lynxView.destroy() }
}
