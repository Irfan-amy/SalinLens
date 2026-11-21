plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val lynxVersion = "4.2.0"

android {
    namespace = "com.salinlens"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.salinlens.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
        ndk { abiFilters += listOf("arm64-v8a") }
    }

    signingConfigs {
        create("release") {
            // local debug keystore so the release APK is installable; replace for Play upload
            storeFile = file("${System.getProperty("user.home")}/.android/debug.keystore")
            storePassword = "android"; keyAlias = "androiddebugkey"; keyPassword = "android"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            signingConfig = signingConfigs.getByName("release")
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }
    packaging {
        resources.excludes += listOf("/META-INF/{AL2.0,LGPL2.1}", "kotlin/**", "DebugProbesKt.bin", "META-INF/*.version")
        jniLibs { useLegacyPackaging = true }
    }
    testOptions { unitTests.all { it.systemProperty("parity.dir", System.getenv("PARITY_DIR") ?: "") } }
    androidResources { localeFilters += listOf("en") }
}

// Build the ReactLynx bundle and ship it as an asset.
val buildLynx = tasks.register<Exec>("buildLynxBundle") {
    workingDir = file("../../web")
    commandLine("pnpm", "build")
    inputs.dir("../../web/src"); inputs.file("../../web/package.json"); inputs.file("../../web/lynx.config.ts")
    outputs.file("../../web/dist/main.lynx.bundle")
}
val copyBundle = tasks.register<Copy>("copyLynxBundle") {
    dependsOn(buildLynx)
    from("../../web/dist/main.lynx.bundle")
    into("src/main/assets")
}
tasks.matching { (it.name.startsWith("merge") && it.name.endsWith("Assets")) || it.name.lowercase().contains("lint") }.configureEach { dependsOn(copyBundle) }

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity:1.10.1")
    implementation("androidx.exifinterface:exifinterface:1.3.7")
    implementation("com.google.guava:guava:31.1-android") // already pulled in by Lynx; needed on the compile classpath for CameraX futures
    implementation("org.lynxsdk.lynx:xelement:$lynxVersion")
    implementation("org.lynxsdk.lynx:xelement-input:$lynxVersion")
    implementation("org.lynxsdk.lynx:lynx:$lynxVersion")
    implementation("org.lynxsdk.lynx:lynx-jssdk:$lynxVersion")
    implementation("org.lynxsdk.lynx:lynx-trace:$lynxVersion")
    implementation("org.lynxsdk.lynx:primjs:4.2.1")

    implementation("androidx.camera:camera-core:1.4.2")
    implementation("androidx.camera:camera-camera2:1.4.2")
    implementation("androidx.camera:camera-lifecycle:1.4.2")
    implementation("androidx.camera:camera-view:1.4.2")

    implementation("com.microsoft.onnxruntime:onnxruntime-android:1.22.0")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
}
