# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# llama.rn
-keep class com.rnllama.** { *; }
-keep class com.rnllama.LlamaContext { *; }

# pdfbox-android
-keep class com.tom_roush.pdfbox.** { *; }
-keep class org.apache.fontbox.** { *; }
-keep class org.apache.pdfbox.** { *; }

# expo-sqlite
-keep class io.expo.modules.sqlite.** { *; }

# react-native-worklets
-keep class com.shopify.reactnative.worklets.** { *; }

# Add any project specific keep options here:
