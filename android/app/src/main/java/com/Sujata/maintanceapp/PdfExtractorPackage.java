package com.Sujata.maintanceapp;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.uimanager.ViewManager;

import com.tom_roush.pdfbox.android.PDFBoxResourceLoader;
import com.tom_roush.pdfbox.pdmodel.PDDocument;
import com.tom_roush.pdfbox.text.PDFTextStripper;

import java.io.File;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Combined Package and Module for PDF Extraction
 * This consolidation ensures the Java compiler sees both classes simultaneously.
 */
public class PdfExtractorPackage implements ReactPackage {

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }

    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();
        modules.add(new PdfExtractorModule(reactContext));
        return modules;
    }
}

class PdfExtractorModule extends ReactContextBaseJavaModule {
    
    public PdfExtractorModule(ReactApplicationContext reactContext) {
        super(reactContext);
        // Initialize PDFBox android port
        PDFBoxResourceLoader.init(reactContext.getApplicationContext());
    }

    @Override
    public String getName() {
        return "PdfExtractorModule";
    }

    @ReactMethod
    public void extractText(String uriPath, Promise promise) {
        new Thread(() -> {
            PDDocument document = null;
            try {
                // Remove file prefix if present
                String path = uriPath.replace("file://", "");
                File file = new File(path);
                
                document = PDDocument.load(file);
                PDFTextStripper pdfStripper = new PDFTextStripper();
                String text = pdfStripper.getText(document);
                
                promise.resolve(text);
            } catch (Exception e) {
                promise.reject("PDF_ERROR", "Failed to extract text from PDF: " + e.getMessage());
            } finally {
                if (document != null) {
                    try { document.close(); } catch (Exception ignored) {}
                }
            }
        }).start();
    }
}
