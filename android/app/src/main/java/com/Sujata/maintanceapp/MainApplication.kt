package com.Sujata.maintanceapp

import android.app.Application
import android.content.res.Configuration

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactNativeHost

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper
import com.facebook.soloader.SoLoader

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost = ReactNativeHostWrapper(
      this,
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // Packages that cannot be autolinked yet can be added manually here, for example:
              // add(MyReactNativePackage())
              add(PdfExtractorPackage())
            }

          override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"

          override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

          override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
      }
  )

  override val reactHost: ReactHost
    get() = ReactNativeHostWrapper.createReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    SoLoader.init(this, false)
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      try {
        // Force-load the local (Java) feature flags accessor to bypass failing C++ JNI bridge
        val ffClass = Class.forName("com.facebook.react.internal.featureflags.ReactNativeFeatureFlags")
        val localAccessorClass = Class.forName("com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsLocalAccessor")
        val localAccessor = localAccessorClass.getDeclaredConstructor().newInstance()
        val accessorField = ffClass.getDeclaredField("accessor")
        accessorField.isAccessible = true
        accessorField.set(ffClass.getField("INSTANCE").get(null), localAccessor)
      } catch (e: Throwable) {
        // Fallback or log if reflection fails
      }

      try {
        DefaultNewArchitectureEntryPoint.load()
      } catch (e: Throwable) {
        // Fallback or log. In 0.81.5, some core libs can be missing or merged.
      }
    }
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
