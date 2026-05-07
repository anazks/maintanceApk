package com.Sujata.maintanceapp

import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import com.facebook.react.bridge.*
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
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
            var text = stripper.getText(document)
            document.close()
            inputStream.close()

            // If the extracted text is empty or extremely short, perform OCR on the PDF pages
            if (text == null || text.trim().length < 200) {
                val ocrText = performOcrOnPdf(uri)
                if (ocrText.isNotBlank()) {
                    text = ocrText
                }
            }

            promise.resolve(text)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to extract text from PDF: ${e.message}")
        }
    }

    private fun performOcrOnPdf(uri: Uri): String {
        val contentResolver = reactApplicationContext.contentResolver
        var pfd: ParcelFileDescriptor? = null
        var renderer: PdfRenderer? = null
        val ocrStringBuilder = StringBuilder()

        try {
            pfd = contentResolver.openFileDescriptor(uri, "r")
            if (pfd != null) {
                renderer = PdfRenderer(pfd)
                val pageCount = renderer.pageCount
                val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

                for (i in 0 until pageCount) {
                    val page = renderer.openPage(i)
                    
                    // Downscale the rendered page bitmap for extremely fast on-device OCR and minimal memory usage
                    val maxDimension = 1200f
                    val scale = maxDimension / Math.max(page.width, page.height)
                    val targetWidth = if (scale < 1) (page.width * scale).toInt() else page.width
                    val targetHeight = if (scale < 1) (page.height * scale).toInt() else page.height
                    
                    val bitmap = Bitmap.createBitmap(targetWidth, targetHeight, Bitmap.Config.ARGB_8888)
                    page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                    
                    val image = InputImage.fromBitmap(bitmap, 0)
                    try {
                        val result = Tasks.await(recognizer.process(image))
                        ocrStringBuilder.append(result.text).append("\n")
                    } catch (e: Exception) {
                        e.printStackTrace()
                    } finally {
                        page.close()
                        bitmap.recycle()
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            try {
                renderer?.close()
                pfd?.close()
            } catch (ex: Exception) {
                ex.printStackTrace()
            }
        }

        return ocrStringBuilder.toString()
    }
}
