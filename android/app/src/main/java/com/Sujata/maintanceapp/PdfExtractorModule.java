package com.Sujata.maintanceapp;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import com.tom_roush.pdfbox.android.PDFBoxResourceLoader;
import com.tom_roush.pdfbox.pdmodel.PDDocument;
import com.tom_roush.pdfbox.text.PDFTextStripper;

import java.io.File;

public class PdfExtractorModule extends ReactContextBaseJavaModule {
    
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
                // If expo-document-picker gives a content:// URI, we'd need ContentResolver
                // But typically it copies to local cache: file:///data/...
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
