import * as FileSystem from 'expo-file-system/legacy';
import { initLlama, LlamaContext } from 'llama.rn';

let llamaContext: LlamaContext | null = null;

export interface ChatMessage { role: string, text: string }

export async function askAI(prompt: string, pdfContext: string = "", chatHistory: ChatMessage[] = [], equipName: string = "Equipment"): Promise<string> {
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

  const systemPrompt = `You are a strict technical support assistant for ${equipName}.
Your ONLY source of knowledge is the provided DOCUMENT CONTEXT.

INSTRUCTIONS:
- Answer the user's question explicitly and completely based ONLY on the DOCUMENT CONTEXT.
- If the document contains a list or checklist, you MUST write out every single item. Do not omit anything.
- If the user says a greeting (like "hi", "hello"), reply with: "Hello. How can I help you troubleshoot this equipment today?"
- If the DOCUMENT CONTEXT says "No document uploaded for this equipment.", reply exactly: "No document uploaded for this equipment."
- If the answer is not found in the DOCUMENT CONTEXT, reply exactly: "This information is not available in the uploaded document."
- Do NOT use outside knowledge. Do NOT explain your rules. Do NOT say "Based on the manual".

DOCUMENT CONTEXT:
${pdfContext}`;

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
      n_predict: 800, // Increased generation limit to prevent cutting off long checklists
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
