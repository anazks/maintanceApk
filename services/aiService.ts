import * as FileSystem from 'expo-file-system/legacy';
import { initLlama, LlamaContext } from 'llama.rn';

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
        n_ctx: 2048,      // Optimized for ultra-fast 1-5 second "nano" model processing
        n_gpu_layers: 0,  // Set to 0 to ensure CPU-only 100% deterministic execution
        n_threads: 4,     // Hardware Acceleration Tuning: use 4 high-performance cores to avoid throttling
      });
    } catch (e: any) {
      throw new Error("Failed to load Llama model.\nOriginal Error: " + e.message);
    }
  }

  const systemPrompt = `You are a precise technical troubleshooting assistant. Your sole purpose is to provide the exact solutions, steps, and bullet points from the CURRENT CONTEXT to resolve the user's issue.

CRITICAL RULES:
1. Always begin your response by stating the exact "[DOCUMENT LOCATION: Section X]" (replace X with the actual section/page number from the context) so the user knows exactly where the answer is found.
2. Locate the full troubleshooting steps, lists, or instructions for the user's issue and output them completely. Do NOT summarize, shorten, condense, or paraphrase the data. Give full steps.
3. List all steps, bullets, or numbers in the exact same order and format as they appear in the text (e.g. use original bullets, numbers, dashes) with no change in order of content.
4. Do NOT add any conversational intro, outro, filler text, or greetings. Start immediately with the Document Location and the steps.
5. Copy the steps and facts word-for-word without making any guesses, assumptions, or modifications.
6. If the CURRENT CONTEXT does not contain any troubleshooting steps or solutions for the user's issue, reply EXACTLY: "There is no data available regarding this question in the manual."`;

  let structuredPrompt = `<|im_start|>system\n${systemPrompt}<|im_end|>\n`;
  
  const recentHistory = chatHistory.slice(-4);
  for (const msg of recentHistory) {
     if (msg.role === 'user') {
       structuredPrompt += `<|im_start|>user\n${msg.text}<|im_end|>\n`;
     } else {
       const shortAI = msg.text.length > 250 ? msg.text.substring(0, 250) + '\n...[Extended answer omitted]' : msg.text;
       structuredPrompt += `<|im_start|>assistant\n${shortAI}<|im_end|>\n`;
     }
  }

  const finalPrompt = `CURRENT CONTEXT:
====================
${pdfContext}
====================

Question: ${prompt}`;

  structuredPrompt += `<|im_start|>user\n${finalPrompt}<|im_end|>\n<|im_start|>assistant\n`;

  const stopWords = ['</s>', '<|end|>', '<|eot_id|>', '<|end_of_text|>', '<|im_end|>', '<|EOT|>', '<|END_OF_TURN_TOKEN|>', '<|end_of_turn|>', '<|endoftext|>', '[/INST]'];

  try {
    const msgResult = await llamaContext.completion({
      prompt: structuredPrompt,
      n_predict: 500,   // Increased to 500 to ensure full complete answers under headings without any truncation
      temperature: 0.0, // Forced greedy decoding for exact determinism across different devices
      top_k: 1,         // Remove random sampling completely
      top_p: 1.0,
      stop: stopWords
    });

    let text = msgResult.text?.trim() || '';
    
    // Safety Parrot-Filter: If the model repeats the question because the PDF lacks actual answers/steps
    const cleanText = text.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanPrompt = prompt.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (!text || cleanText === cleanPrompt || cleanText.includes(cleanPrompt) || cleanPrompt.includes(cleanText)) {
      text = "There is no data available regarding this question in the manual.";
    }
    return text;
  } catch (e: any) {
    throw new Error("Failed to generate response: " + e.message);
  }
}
