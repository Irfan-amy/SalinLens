package com.salinlens

import android.app.Application
import com.lynx.tasm.LynxEnv

class SalinApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Host.app = applicationContext
        LynxEnv.inst().init(this, null, null, null)
        LynxEnv.inst().registerModule("SalinNative", SalinModule::class.java)
    }
}
