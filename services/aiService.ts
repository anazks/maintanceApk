import { initLlama, LlamaContext } from 'llama.rn';

const MODEL_PATH = 'file:///storage/emulated/0/tinyllama.gguf';
let llamaContext: LlamaContext | null = null;

export async function askAI(prompt: string, pdfContext: string = ""): Promise<string> {
  if (!llamaContext) {
    try {
      llamaContext = await initLlama({
        model: MODEL_PATH,
        use_mlock: true,
        n_ctx: 2048,
        n_gpu_layers: 1, // Optional: adjust for small offload
      });
    } catch (e: any) {
      throw new Error("Failed to load Llama model. Ensure the file exists at " + MODEL_PATH + "\nOriginal Error: " + e.message);
    }
  }

  let structuredPrompt = "";
  if (pdfContext) {
    structuredPrompt = `[INST] You are an expert maintenance technician. Use the following PDF manual excerpt to answer the question briefly:
Excerpt:
${pdfContext}

Question: ${prompt} [/INST]`;
  } else {
    structuredPrompt = `[INST] You are a friendly technician assistant. Rewrite this instruction in a brief, friendly, and conversational way (max 50 words): "${prompt}" [/INST]`;
  }

  const stopWords = ['</s>', '<|end|>', '<|eot_id|>', '<|end_of_text|>', '<|im_end|>', '<|EOT|>', '<|END_OF_TURN_TOKEN|>', '<|end_of_turn|>', '<|endoftext|>', '[/INST]'];

  try {
    const msgResult = await llamaContext.completion({
      prompt: structuredPrompt,
      n_predict: 200,
      stop: stopWords
    });

    return msgResult.text;
  } catch (e: any) {
    throw new Error("Failed to generate response: " + e.message);
  }
}
