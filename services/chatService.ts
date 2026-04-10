import { askAI } from './aiService';
import { getDB } from '../database';
import { chunkText, searchPdfContext } from './pdfRagService';

export interface ChatMessage { role: string, text: string }

export async function generateReply(text: string, equipId?: string, chatHistory: ChatMessage[] = []): Promise<string> {
  let contextStr = '';
  
  if (equipId) {
    try {
      const numericId = parseInt(equipId, 10);
      const db = getDB();
      const equipRec = db.getFirstSync<{name: string}>('SELECT name FROM Equipment WHERE id = ?', [numericId]);
      const equipName = equipRec ? equipRec.name : 'Unknown Equipment';
      
      const docs = db.getAllSync<{ parsed_text: string }>(
        'SELECT parsed_text FROM Equipment_Documents WHERE equipment_id = ?',
        [numericId]
      );
      
      let pdfExcerpts = '';
      if (docs && docs.length > 0) {
        const allText = docs.map(d => d.parsed_text).join('\n').trim();
        
        if (!allText) {
          pdfExcerpts = "Warning: The uploaded PDF contained no machine-readable text (it was likely scanned images).";
        } else {
          const chunks = chunkText(allText);
          
          if (text.trim().length <= 15 && (text.toLowerCase().includes('hi') || text.toLowerCase().includes('hello'))) {
              // The user is just saying hi. Do not force text chunks into the prompt, to avoid abbreviation rambling.
              pdfExcerpts = `(The user is just greeting you. Reply with a highly professional, short, and friendly greeting. Acknowledge that you are the designated expert for '${equipName}'. DO NOT explain abbreviations or read from the manual right now.)`;
          } else {
              pdfExcerpts = searchPdfContext(chunks, text);
              if (!pdfExcerpts && chunks.length > 0) {
                  pdfExcerpts = chunks[0];
              }
          }
        }
      }
      
      contextStr = `Current Equipment: ${equipName}\n\n`;
      if (pdfExcerpts) {
          if (pdfExcerpts.startsWith('(The user')) {
              contextStr += pdfExcerpts; // Special greeting instruction bypass
          } else {
              contextStr += `Manual Excerpts for Reference:\n${pdfExcerpts}`;
          }
      } else {
          contextStr += `(No PDF manual uploaded yet. Reply based on general knowledge and ask user to use 'Upload PDF' option if needed.)`;
      }

    } catch(e) { console.error('RAG Error', e); }
  }

  try {
    const aiResponse = await askAI(text, contextStr, chatHistory);
    return aiResponse;
  } catch (error) {
    console.warn("AI generation failed", error);
    return "AI Module Offline: The AI model failed to load. Please ensure you are running a custom development build (not Expo Go) and the model file exists.";
  }
}

export async function handleMessage(input: string, equipId?: string, chatHistory: ChatMessage[] = []): Promise<string> {
  if (equipId) {
    return await generateReply(input, equipId, chatHistory);
  }
  return "Equipment context is missing. Please open the chat from a specific Equipment Detail page.";
}
