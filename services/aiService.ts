import { initLlama, LlamaContext } from 'llama.rn';
import * as FileSystem from 'expo-file-system/legacy';

let llamaContext: LlamaContext | null = null;

export interface ChatMessage { role: string, text: string }

export async function askAI(prompt: string, pdfContext: string = "", chatHistory: ChatMessage[] = []): Promise<string> {
  const MODEL_PATH = (FileSystem as any).documentDirectory + 'ai_model.gguf';

  if (!llamaContext) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(MODEL_PATH);
      if (!fileInfo.exists) {
         throw new Error("AI Model not found on device. Please click 'Load Model' in Equipment Details to select the model file.");
      }

      llamaContext = await initLlama({
        model: MODEL_PATH,
        use_mlock: false, // Turn off memory lock to prevent OS-level fragmentation/truncation on 8GB devices
        n_ctx: 4096, // Increased to massive size to fit larger 600+ pg doc contexts and thick generations
        n_gpu_layers: 0, // Set to 0 to ensure CPU-only 100% deterministic execution and avoid GPU driver (Mali vs Adreno) differences
      });
    } catch (e: any) {
      throw new Error("Failed to load Llama model.\nOriginal Error: " + e.message);
    }
  }

  const systemPrompt = `You are an expert technical assistant.
Your sole purpose is to answer the user's specific current question using ONLY the knowledge contained in the provided CURRENT CONTEXT.

CRITICAL RULES:
1. Provide a HIGHLY DETAILED, exhaustive, and full-length answer exactly like ChatGPT would. Do not shorten, summarize, or skip ANY details. If a heading or image reference contains multiple points, explain every single piece of information listed underneath it completely.
2. If the context contains bullet points, numbered lists, headings, tables, or image details, extract and quote them exactly as they appear in the same order. Do not change their order, format, or sequence.
3. If the CURRENT CONTEXT physically does not contain the topic needed to answer the question, you MUST immediately reply EXACTLY: "There is no data available regarding this question in the manual."
4. If the provided context snippets ([DOCUMENT LOCATION: Section X]) indicate that the issue, procedure, or topic is mentioned in two or more different places or has multiple variations, explicitly inform the user that it appears in multiple sections and provide the structured details from EACH section.
5. Answer the user's CURRENT question independently. Do NOT rely on or weave in previous chat history if the new question explicitly shifts topics.
6. Do NOT use outside knowledge, common sense, or guessing.
7. Do NOT mention "According to the context" or "The manual says".`;

  let structuredPrompt = `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n${systemPrompt}<|eot_id|>`;
  
  const recentHistory = chatHistory.slice(-4);
  for (const msg of recentHistory) {
     if (msg.role === 'user') {
       structuredPrompt += `<|start_header_id|>user<|end_header_id|>\n\n${msg.text}<|eot_id|>`;
     } else {
       // CRITICAL: Aggressively truncate past AI responses to prevent massive token overflow (n_ctx crash) on the 2nd/3rd turn.
       const shortAI = msg.text.length > 250 ? msg.text.substring(0, 250) + '\n...[Extended answer omitted for context memory]' : msg.text;
       structuredPrompt += `<|start_header_id|>assistant<|end_header_id|>\n\n${shortAI}<|eot_id|>`;
     }
  }

  const finalPrompt = `CURRENT CONTEXT (Use ONLY this to answer the question):
====================
${pdfContext}
====================

Question: ${prompt}`;

  structuredPrompt += `<|start_header_id|>user<|end_header_id|>\n\n${finalPrompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n`;

  const stopWords = ['</s>', '<|end|>', '<|eot_id|>', '<|end_of_text|>', '<|im_end|>', '<|EOT|>', '<|END_OF_TURN_TOKEN|>', '<|end_of_turn|>', '<|endoftext|>', '[/INST]'];

  try {
    const msgResult = await llamaContext.completion({
      prompt: structuredPrompt,
      n_predict: 1000,
      temperature: 0.0, // Forced greedy decoding for exact determinism across different devices
      top_k: 1,         // Remove random sampling completely
      top_p: 1.0,
      stop: stopWords
    });

    let text = msgResult.text?.trim() || '';
    if (!text) {
      text = "There is no data available regarding this question in the manual.";
    }
    return text;
  } catch (e: any) {
    throw new Error("Failed to generate response: " + e.message);
  }
}
