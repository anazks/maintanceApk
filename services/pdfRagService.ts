import Fuse from 'fuse.js';

// Split large document text into ~80 word chunks with 20 words of overlap
export function chunkText(text: string): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const chunks = [];
  const chunkSize = 80;
  const overlap = 20;
  
  for (let i = 0; i < words.length; i += (chunkSize - overlap)) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }
  return chunks;
}

export function searchPdfContext(textChunks: string[], query: string): string {
  if (!textChunks || textChunks.length === 0) return '';
  
  const docs = textChunks.map((c, i) => ({ id: i, text: c }));
  const fuse = new Fuse(docs, {
    keys: ['text'],
    threshold: 0.6, // Lenient semantic/keyword fallback
    ignoreLocation: true, // Crucial for matching text anywhere in long chunks
    includeScore: true
  });

  const results = fuse.search(query);
  if (results.length === 0) {
    return '';
  }

  // Take top 2 best-matching chunks avoiding huge prompts
  const topChunks = results.slice(0, 2).map(r => r.item.text);
  return topChunks.join('\n...\n');
}
