package com.Sujata.maintanceapp;

public class LlamaRunner {
    
    // Load the native llama C++ library
    static {
        try {
            System.loadLibrary("llama");
        } catch (UnsatisfiedLinkError e) {
            // We ignore log printing here, but this catches if .so is missing during RN build
        }
    }

    // This method will link to a JNI signature in C++ or provide a mock
    public static native String generateText(String prompt);

    public static String run(String prompt) {
        try {
            return generateText(prompt);
        } catch (UnsatisfiedLinkError e) {
            // Fallback string indicating the native lib couldn't be loaded
            // The frontend will catch this and fallback to Humanizer
            throw new RuntimeException("llama.cpp native library not loaded or JNI method missing.");
        }
    }
}
