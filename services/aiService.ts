import { initLlama, LlamaContext } from 'llama.rn';
import * as FileSystem from 'expo-file-system/legacy';

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
        n_threads: 4, // Optimize for quad-core mobile CPUs
        n_gpu_layers: 1,
      });
    } catch (e: any) {
      throw new Error("Failed to load Llama model.\nOriginal Error: " + e.message);
    }
  }

  let systemPrompt = `Role: Professional Technical Support Assistant for Industrial Equipment: '${equipName}'.
STRICT MANUAL MODE:
1. Use ONLY the provided manual context below to answer technical questions.
2. If the context does not contain the answer, you MUST say EXACTLY this FIRST: "I'm sorry, but the current manual does not contain specific information regarding this issue. Please consult a senior supervisor or refer to the manufacturer's extended documentation."
3. ONLY AFTER the fallback message above, you may suggest basic industrial troubleshooting (e.g. check power, physical inspection) specific to '${equipName}'.
4. NEVER mention CPUs, computers, or office electronics. Stay focused on the industrial context of '${equipName}'.

GREETINGS:
- Respond friendly: "Hello! How can I assist with troubleshooting the '${equipName}' today?"
- Do NOT show the "no info" message for greetings.

STYLE:
- Professional, safety-conscious, concise.
- Use bullet points for steps.
- DO NOT say "According to the manual".`;
  if (pdfContext) {
    systemPrompt += `\nReference this manual context ONLY for '${equipName}':\n${pdfContext}`;
  } else {
    systemPrompt += `\nSTRICT: No manual is uploaded for '${equipName}'. For technical questions, follow the 'STRICT MANUAL MODE' fallback protocol.`;
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
      n_predict: 256, // Optimized for concise troubleshooting steps
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
