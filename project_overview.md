# Technical Project Overview: Offline RAG AI Maintenance App

This document provides a detailed overview of the application's AI and technical architecture, intended to address questions regarding the integration of offline AI models, RAG (Retrieval-Augmented Generation) mechanics, and overall system frameworks.

---

### 1. Which parts were coded fully in-house and which libraries/frameworks were used?
**Fully In-House Components:**
- **Custom RAG Pipeline (`pdfRagService`):** Logic for text chunking, overlap handling, keyword extraction, and contextual search mechanisms.
- **AI Orchestration (`aiService` & `chatService`):** System prompt engineering, conversation history management, and the contextual data injection pipeline linking the local database to the local LLM.
- **Native Android Bridging (`PdfExtractorModule.kt`):** A custom React Native bridge built in Kotlin to facilitate deep integration between the Java-based PDF engine and the React Native application.
- **UI & Application State:** Equipment tracking interfaces, document management screens, chat UX, and navigation flow.
- **Database Schema:** SQLite schema definitions and relationships optimized for offline data persistence.

**Key Libraries & Frameworks:**
- **React Native (v0.81.5) & Expo (v54.0.33):** The foundational mobile framework for cross-platform development, utilizing Expo Router for navigation elements.
- **llama.rn (v0.11.4):** A React Native binding for the powerful `llama.cpp` library, driving local, on-device AI inference without cloud dependency or connectivity.
- **Fuse.js (v7.1.0):** An algorithmic fuzzy-search library utilized for local document retrieval within the RAG pipeline.
- **pdfbox-android:** An Android adaptation of Apache PDFBox used natively via our custom bridge for pure extraction of text from PDF files.
- **expo-sqlite:** Handles the local, on-device SQL database for persisting equipment records, parsed documents, and troubleshooting guides.

### 2. Which local AI model is being used?
The application is designed to be **model-agnostic**, provided the model follows the standardized `.gguf` format. 
- It dynamically loads a local model file (e.g., `ai_model.gguf`) securely placed on the device storage.
- Through the `llama.rn` integration, it utilizes a context window of up to 2048 tokens and leverages hardware offloading (`n_gpu_layers`) for optimized generation on the mobile device. 
- Typical deployments rely on small-parameter local models (like Mistral, Llama-3 8B, Qwen, or Gemma quantized for offline mobile hardware), which are selected and flashed to the device during setup.

### 3. How are PDFs being processed — direct text extraction or OCR also?
PDFs are processed strictly using **direct text extraction**.
- When a technical manual is uploaded, the app passes the file URI to our custom native Android bridge (`PdfExtractorModule.kt`).
- The bridge uses `pdfbox-android` (Apache PDFBox) to parse the document and strip the embedded raw text layer directly.
- **Is OCR implemented?** No. Currently, the system relies strictly on direct text extraction. Scanned images (PDFs comprised purely of images without a built-in text layer) will yield blank output. Documents must be text-searchable PDFs natively.

### 4. How is the document search/retrieval being handled?
The document retrieval mechanism embodies the **"Retrieval" (R)** in our Offline **RAG** architecture:
1. **Dynamic Chunking:** Once extracted, the PDF text is divided into manageable chunks (approx. 350 words) with a defined trailing overlap (75 words) to ensure no context is lost at sentence boundaries, lists, or tables.
2. **Immediate Bypass for Small Files:** If a document is sufficiently small (under 1200 words), it bypasses chunked search and the entire text is passed to the AI to guarantee 100% context retention.
3. **Keyword Filtering:** For larger documents, the system takes the user's chat query, removes "stop words" (like *how*, *what*, *the*, *is*), and isolates core keywords.
4. **Fuzzy Search Strategy:** It uses `Fuse.js` with a tuned 0.6 threshold to tolerate typos and user misspellings, algorithmically matching the keywords against all chunks to find the most contextually relevant sections regardless of where they sit in the manual.
5. **Prompt Injection:** The top-matching chunks (up to ~750 words total) are seamlessly chained together and injected into the AI’s system prompt.

### 5. Is answer generation fully local and offline?
**Yes, explicitly so.** 
The chat generation connects directly to the loaded `.gguf` model using `llama.rn`. No external cloud APIs (like OpenAI, AWS, or Google Cloud) are utilized. The entire operation—from PDF extraction, to fuzzy retrieval, to AI response generation—is securely completed in a completely air-gapped, offline environment on the Android device's local hardware.

### 6. Does the system provide source file/page reference for each answer?
In its current iteration, the system **does not** output specific page numbers or filenames in the AI’s response. 
- The native integration pulls text in a continuous stream directly from the PDF DOM (`PDFTextStripper().getText(document)`).
- Because strict pagination tags are inherently lost when distilling the PDF down to raw contiguous text strings for chunking, the AI can relay the *technical information* accurately from the document, but it cannot confidently cite exact page numbers. 

### 7. How many PDFs / how much data has it been tested on?
*Note: This specific milestone may vary based on deployment scale.*
- Architecturally, the system avoids AI memory bottlenecks by running local retrieval first (via SQLite and `Fuse.js`) rather than feeding the entire PDF to the model. 
- **Theoretically**, you can upload as many physical documents into the SQL database as the device storage can hold. 
- Under the hood, the RAG mechanism ensures that whether the document is 5 pages or 5,000 pages, the AI limits itself strictly to the top 3 best-matching text chunks (~750 total words) per chat query to completely circumvent out-of-memory crashes on the tablet hardware.

### 8. What is the response speed on the current tablet/system?
Response speeds are **highly hardware-dependent** and heavily influenced by three factors:
1. The specific `.gguf` model being used (a 1-billion parameter model generates exponentially faster than an 8-billion parameter one).
2. The chipset (CPU/NPU/RAM) of the Android tablet/device acting as the host.
3. The amount of context data loaded.
Typically, high-quality local mobile inference speeds average between **1 to 5 seconds to initial generation**, processing at a rate of roughly 4-15 tokens per second depending on the specific hardware deployed in the field.

### 9. Is the code and deployment package being handed over fully?
*(Subject to formal project handover terms)*
**Yes.** The repository is fully comprehensive. It contains all source files (TypeScript logic, React UI components, SQLite schemas), the complete `android/` directory containing all native bridge customizations and build files (Kotlin/Gradle configs). It can be packaged into an independent standard release `.apk` for direct sideloading or MDM deployment on client tablets.
