import Fuse from 'fuse.js';

// Increase chunk size to maintain context for tables and multi-step troubleshooting guides
export function chunkText(text: string): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const chunks = [];
  const chunkSize = 350; // Increased to 350 words to ensure long checklists aren't split
  const overlap = 75;    // Keep overlapping context high
  
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
    threshold: 0.6, // Reverted to 0.6 to properly tolerate spelling errors and typos
    ignoreLocation: true, // Crucial for matching text anywhere in long chunks
    includeScore: true,
    minMatchCharLength: 3
  });

  // Basic stopword removal to improve Fuse.js keyword matching results
  const stopWords = ['a', 'an', 'the', 'is', 'are', 'in', 'on', 'what', 'how', 'to', 'fix', 'my', 'i', 'have', 'problem', 'with', 'can', 'you', 'help', 'me', 'troubleshoot', 'error', 'when'];
  const queryKeywords = query.toLowerCase()
                             .split(/\W+/)
                             .filter(w => w.length > 1 && !stopWords.includes(w))
                             .join(' ');

  // Search using keywords if available, else original query
  const searchString = queryKeywords.trim().length > 0 ? queryKeywords : query;

  const results = fuse.search(searchString);
  if (results.length === 0) {
    return '';
  }

  // Take top 3 best-matching chunks (approx 750 words) to avoid missing table rows
  const topChunks = results.slice(0, 3).map(r => r.item.text);
  return topChunks.join('\n\n--- [Next Document Section] ---\n\n');
}
