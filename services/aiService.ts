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
        use_mlock: true,
        n_ctx: 2048,
        n_gpu_layers: 1, // Optional: adjust for small offload
      });
    } catch (e: any) {
      throw new Error("Failed to load Llama model.\nOriginal Error: " + e.message);
    }
  }

  let systemPrompt = `You are an expert, friendly maintenance assistant.
Provide clear troubleshooting instructions based solely on the referenced text below.
CRITICAL RULES:
1. DO NOT use phrases like "According to the manual", "Based on the excerpt", or "The text says". Give the instructions directly and confidently as your own expert knowledge.
2. DO NOT invent steps or use outside knowledge.
3. DO NOT use bullet points or lists. Write a single, easy-to-read, conversational paragraph.`;
  if (pdfContext) {
    systemPrompt += `\nReference this manual context ONLY to help the technician:\n${pdfContext}`;
  } else {
    systemPrompt += `\n(There is no specific manual uploaded yet. Politely mention the user can use 'Upload PDF' if they have one.)`;
  }

  let structuredPrompt = `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n${systemPrompt}<|eot_id|>`;
  
  const recentHistory = chatHistory.slice(-4);
  for (const msg of recentHistory) {
     if (msg.role === 'user') {
       structuredPrompt += `<|start_header_id|>user<|end_header_id|>\n\n${msg.text}<|eot_id|>`;
     } else {
       structuredPrompt += `<|start_header_id|>assistant<|end_header_id|>\n\n${msg.text}<|eot_id|>`;
     }
  }

  structuredPrompt += `<|start_header_id|>user<|end_header_id|>\n\n${prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n`;

  const stopWords = ['</s>', '<|end|>', '<|eot_id|>', '<|end_of_text|>', '<|im_end|>', '<|EOT|>', '<|END_OF_TURN_TOKEN|>', '<|end_of_turn|>', '<|endoftext|>', '[/INST]'];

  try {
    const msgResult = await llamaContext.completion({
      prompt: structuredPrompt,
      n_predict: 400, // Increased generation limit to prevent empty/cut-off messages
      stop: stopWords
    });

    let text = msgResult.text?.trim() || '';
    if (!text) {
      text = "I apologize, but I was unable to formulate a response based on the manual. Could you please rephrase your question?";
    }
    return text;
  } catch (e: any) {
    throw new Error("Failed to generate response: " + e.message);
  }
}
