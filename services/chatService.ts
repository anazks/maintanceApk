import { detectIssue } from './issueDetector';
import { startIssue, handleAnswer } from './troubleshootEngine';
import { askAI } from './aiService';
import { getDB } from '../database';
import { chunkText, searchPdfContext } from './pdfRagService';

let active = false;

function humanize(text: string): string {
  const styles = [
    `Alright, let’s check this — ${text}`,
    `Okay, try this next: ${text}`,
    `Got it. Please check: ${text}`,
    `Let's dig deeper: ${text}`
  ];

  return styles[Math.floor(Math.random() * styles.length)];
}

export async function generateReply(text: string, equipId?: string): Promise<string> {
  let contextStr = '';
  
  if (equipId) {
    try {
      const db = getDB();
      const docs = db.getAllSync<{ parsed_text: string }>(
        'SELECT parsed_text FROM Equipment_Documents WHERE equipment_id = ?',
        [equipId]
      );
      if (docs && docs.length > 0) {
        const allText = docs.map(d => d.parsed_text).join('\n');
        const chunks = chunkText(allText);
        contextStr = searchPdfContext(chunks, text);
      }
    } catch(e) { console.error('RAG Error', e); }
  }

  try {
    const aiResponse = await askAI(text, contextStr);
    return aiResponse;
  } catch (error) {
    console.warn("AI generation failed", error);
    return humanize(text);
  }
}

export async function handleMessage(input: string, equipId?: string): Promise<string> {
  if (!active) {
    const issue = detectIssue(input);

    if (!issue) {
      if (equipId) {
        // Direct Q&A against the PDF
        return await generateReply(input, equipId);
      }
      return "Can you describe the issue more clearly?";
    }

    active = true;
    const step = startIssue(issue);

    return step?.question ? await generateReply(step.question, equipId) : "I couldn't find steps for this issue.";
  }

  const res = handleAnswer(input);

  if (res.result) {
    active = false;
    return res.result;
  }

  return res.question ? await generateReply(res.question, equipId) : "I'm not sure what to ask next.";
}
