package com.salinlens

import android.content.Context
import com.lynx.tasm.provider.AbsTemplateProvider

class TemplateProvider(context: Context) : AbsTemplateProvider() {
    private val app = context.applicationContext
    override fun loadTemplate(uri: String, callback: Callback) {
        Thread {
            try { callback.onSuccess(app.assets.open(uri).use { it.readBytes() }) }
            catch (e: Exception) { callback.onFailed(e.message) }
        }.start()
    }
}
