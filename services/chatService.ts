import { askAI } from './aiService';
import { getDB } from '../database';
import { chunkText, searchPdfContext } from './pdfRagService';

export interface ChatMessage { role: string, text: string }

export async function generateReply(text: string, equipId?: string, chatHistory: ChatMessage[] = []): Promise<string> {
  let contextStr = '';
  let equipName = 'Equipment';
  
  if (equipId) {
    try {
      const numericId = parseInt(equipId, 10);
      const db = getDB();
      const equipRec = db.getFirstSync<{name: string}>('SELECT name FROM Equipment WHERE id = ?', [numericId]);
      equipName = equipRec ? equipRec.name : 'Unknown Equipment';
      
      const docs = db.getAllSync<{ parsed_text: string }>(
        'SELECT parsed_text FROM Equipment_Documents WHERE equipment_id = ?',
        [numericId]
      );

      const guides = db.getAllSync<{ problem: string, solution: string }>(
        'SELECT problem, solution FROM Troubleshooting_Guides WHERE equipment_id = ? OR equipment_id IS NULL',
        [numericId]
      );
      
      let isGreeting = text.trim().length <= 15 && /^(hi|hello|hey)(\s|[^a-z]|$)/i.test(text.trim());
      
      let allText = '';
      if (docs && docs.length > 0) {
        allText += docs.map(d => d.parsed_text || '').join('\n');
      }
      if (guides && guides.length > 0) {
        allText += '\n\n' + guides.map(g => `Problem: ${g.problem}\nSolution: ${g.solution}`).join('\n\n');
      }
      allText = allText.trim();

      if (!allText) {
        contextStr = "No document uploaded for this equipment."; // Handled cleanly by AI System Prompt
      } else if (isGreeting) {
        contextStr = ""; // Handled by AI's greeting rule
      } else {
        const words = allText.split(/\s+/);
        // If the document is small enough to fit in LLaMA's memory (under 1200 words), stream it all!
        if (words.length < 1200) {
          contextStr = allText;
        } else {
          // Document is massive, use RAG chunking to find the best match
          const chunks = chunkText(allText);
          const pdfExcerpts = searchPdfContext(chunks, text);
          
          if (pdfExcerpts) {
            contextStr = pdfExcerpts;
          } else {
            contextStr = "This information is not available in the uploaded document.";
          }
        }
      }

  } catch(e) { console.error('RAG Error', e); }
  }

  try {
    const aiResponse = await askAI(text, contextStr, chatHistory, equipName);
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