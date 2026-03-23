package com.Sujata.maintanceapp;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class LlamaModule extends ReactContextBaseJavaModule {
    
    public LlamaModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "LlamaModule";
    }

    @ReactMethod
    public void generate(String prompt, Promise promise) {
        new Thread(() -> {
            try {
                // Background thread for generation (Phase 5: Step 17)
                String result = LlamaRunner.run(prompt);
                promise.resolve(result);
            } catch (Exception e) {
                promise.reject("LLAMA_ERROR", "Failed to generate text from AI: " + e.getMessage());
            }
        }).start();
    }
}
