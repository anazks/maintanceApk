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

  const systemPrompt = `You are an expert technical assistant.
Your sole purpose is to answer the user's question using ONLY the knowledge contained in the CONTEXT below.

CRITICAL RULES:
1. Synthesize the context to provide a direct, helpful, and accurate answer to the question.
2. If the user asks for more information or repeats a question, elaborate heavily on your previous answer using further details from the CONTEXT.
3. If the CONTEXT physically does not contain the topic needed to answer the question, you MUST immediately reply EXACTLY: "There is no data available regarding this question in the manual."
4. Do NOT use outside knowledge, common sense, or guessing.
5. Do NOT mention "According to the context" or "The manual says".

CONSTRAINED CONTEXT:
====================
${pdfContext}
====================`;

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
      n_predict: 400,
      temperature: 0.1,
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
