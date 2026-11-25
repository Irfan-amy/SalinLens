package com.salinlens

import android.app.Activity
import android.content.Context
import android.os.Handler
import android.os.Looper
import java.lang.ref.WeakReference
import java.util.concurrent.Executors

/** Process-wide handles shared by the Lynx module and custom elements. */
object Host {
    lateinit var app: Context
    var activity: WeakReference<MainActivity>? = null
    var camera: WeakReference<CameraElement.CameraLayout>? = null
    val main = Handler(Looper.getMainLooper())
    val io = Executors.newFixedThreadPool(2) { Thread(it, "salin-io").apply { priority = Thread.NORM_PRIORITY - 1 } }
    val drafts = Executors.newSingleThreadExecutor { Thread(it, "salin-drafts") }
}
