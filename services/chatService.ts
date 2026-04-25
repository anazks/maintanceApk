import { askAI } from './aiService';
import { getDB } from '../database';
import { chunkText, searchPdfContext } from './pdfRagService';

export interface ChatMessage { role: string, text: string }

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const documentChunkCache: Record<string, string[]> = {};

export async function generateReply(text: string, equipId?: string, chatHistory: ChatMessage[] = [], onProgress?: (msg: string) => void): Promise<string> {
  let contextStr = '';
  let pdfExcerpts = '';
  
  if (equipId) {
    try {
      let chunks = documentChunkCache[equipId];
      if (!chunks) {
        if (onProgress) { 
          onProgress("Loading PDF records from Database..."); 
          await sleep(50); 
        }
        const numericId = parseInt(equipId, 10);
        const db = getDB();
        
        const docs = db.getAllSync<{ parsed_text: string }>(
          'SELECT parsed_text FROM Equipment_Documents WHERE equipment_id = ?',
          [numericId]
        );
        
        if (!docs || docs.length === 0) {
          return "System Warning: No PDF manual has been attached to this equipment. Please upload the manual PDF first before asking questions.";
        }
        
        const allText = docs.map(d => d.parsed_text).join('\n').trim();
        if (!allText) {
          return "This PDF contains no readable text. Please upload a text-based PDF.";
        }
        
        chunks = chunkText(allText);
        documentChunkCache[equipId] = chunks;
      }

      
      // 1. Primary Search: Focus strictly on the current question to prevent topic-switch bleeding
      if (onProgress) {
        onProgress("Searching 700+ pages using BM25...");
        await sleep(50);
      }
      pdfExcerpts = searchPdfContext(chunks, text, equipId);

      // 2. Fallback Search: If Primary Search fails, add context from the last user message
      if (!pdfExcerpts || pdfExcerpts.trim().length < 20) {
        const lastUserMsg = chatHistory.filter(m => m.role === 'user').slice(-1)[0]?.text;
        if (lastUserMsg && lastUserMsg !== text) {
          console.log('Primary search failed/empty. Falling back to context-aware search...');
          const fallbackQuery = `${lastUserMsg} ${text}`;
          pdfExcerpts = searchPdfContext(chunks, fallbackQuery, equipId);
        }
      }

    } catch(e) { 
      console.error('RAG Error', e); 
      return "There is no data available regarding this question in the manual.";
    }
  }

  if (!pdfExcerpts || pdfExcerpts.trim().length < 20) {
    return "There is no data available regarding this question in the manual.";
  }

  contextStr = `${pdfExcerpts}`;

  try {
    if (onProgress) {
       onProgress("Querying LLM Engine... (this might take a few seconds)");
       await sleep(50);
    }
    const aiResponse = await askAI(text, contextStr, chatHistory);
    return aiResponse;
  } catch (error) {
    console.warn("AI generation failed", error);
    return "AI Module Offline: The AI model failed to load. Please ensure you are running a custom development build (not Expo Go) and the model file exists.";
  }
}

export async function handleMessage(input: string, equipId?: string, chatHistory: ChatMessage[] = [], onProgress?: (msg: string) => void): Promise<string> {
  if (equipId) {
    return await generateReply(input, equipId, chatHistory, onProgress);
  }
  return "Equipment context is missing. Please open the chat from a specific Equipment Detail page.";
}
