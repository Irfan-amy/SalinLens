package com.salinlens

import com.lynx.tasm.behavior.Behavior
import com.lynx.tasm.behavior.LynxContext
import com.lynx.tasm.behavior.ui.LynxUI

object SalinBehaviors {
    fun create(): List<Behavior> = listOf(
        object : Behavior("salin-camera") { override fun createUI(c: LynxContext): LynxUI<*> = CameraElement(c) },
        object : Behavior("salin-crop") { override fun createUI(c: LynxContext): LynxUI<*> = CropElement(c) },
        object : Behavior("salin-photo") { override fun createUI(c: LynxContext): LynxUI<*> = PhotoElement(c) },
        object : Behavior("salin-icon") { override fun createUI(c: LynxContext): LynxUI<*> = IconElement(c) },
    )
}
