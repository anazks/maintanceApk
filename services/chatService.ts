import { askAI } from './aiService';
import { getDB } from '../database';
import { chunkText, searchPdfContext } from './pdfRagService';

export interface ChatMessage { role: string, text: string }

export async function generateReply(text: string, equipId?: string, chatHistory: ChatMessage[] = []): Promise<string> {
  let contextStr = '';
  let pdfExcerpts = '';
  
  if (equipId) {
    try {
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
      
      const chunks = chunkText(allText);
      
      // Fix: Combine previous user messages to preserve keyword context for follow-up questions
      const prevUserMsgs = chatHistory.filter(m => m.role === 'user').slice(-2).map(m => m.text).join(' ');
      const searchQuery = prevUserMsgs + ' ' + text;
      
      pdfExcerpts = searchPdfContext(chunks, searchQuery);

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
