package com.Sujata.maintanceapp

import android.net.Uri
import com.facebook.react.bridge.*
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import java.io.InputStream

class PdfExtractorModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    init {
        PDFBoxResourceLoader.init(reactContext)
    }

    override fun getName(): String {
        return "PdfExtractorModule"
    }

    @ReactMethod
    fun extractText(fileUri: String, promise: Promise) {
        try {
            val uri = Uri.parse(fileUri)
            val inputStream: InputStream? = reactApplicationContext.contentResolver.openInputStream(uri)
            
            if (inputStream == null) {
                promise.reject("ERROR", "Could not open file URI")
                return
            }

            val document = PDDocument.load(inputStream)
            val stripper = PDFTextStripper()
            val text = stripper.getText(document)
            document.close()
            inputStream.close()

            promise.resolve(text)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to extract text from PDF: ${e.message}")
        }
    }
}
