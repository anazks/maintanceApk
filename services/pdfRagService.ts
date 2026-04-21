import Fuse from 'fuse.js';

// Split large document text into ~400 word chunks with 100 words of overlap to maintain massive sections logically intact
export function chunkText(text: string): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const chunks = [];
  const chunkSize = 400; // Increased massively to capture entire headings and step lists
  const overlap = 100;
  
  for (let i = 0; i < words.length; i += (chunkSize - overlap)) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }
  return chunks;
}

export function searchPdfContext(textChunks: string[], query: string): string {
  if (!textChunks || textChunks.length === 0) return '';
  
  const stopWords = new Set(['how', 'do', 'i', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'what', 'where', 'when', 'why', 'who', 'does', 'did', 'can', 'could', 'should', 'would', 'to', 'of', 'for', 'with', 'in', 'on', 'at', 'by', 'about', 'as']);
  const keywords = query.replace(/[^\w\s\.-]/g, '').toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));

  if (keywords.length === 0) return '';

  const scoredChunks = textChunks.map((chunk) => {
    let score = 0;
    let distinctKeywords = 0;
    const chunkLower = chunk.toLowerCase();
    
    for (const kw of keywords) {
      if (chunkLower.includes(kw)) {
        distinctKeywords += 1;
        // Minor frequency boost
        const extraMatches = chunkLower.match(new RegExp(kw, 'g'));
        if (extraMatches) {
          score += (extraMatches.length * 0.1);
        }
      }
    }
    
    // Core Logic: Paragraphs containing MORE of the unique words score exponentially higher
    score += (distinctKeywords * 100);

    // Exact Match Bonus: If the user's exact phrase exists natively
    if (chunkLower.includes(query.toLowerCase().trim())) {
      score += 1000;
    }

    return { text: chunk, score };
  });

  const activeChunks = scoredChunks.filter(c => c.score > 0).sort((a, b) => b.score - a.score);

  if (activeChunks.length === 0) return '';

  // Take top 2 best-matching chunks (approx 800 words), preventing Llama's 2048 context from overflowing
  const topChunks = activeChunks.slice(0, 2).map(r => r.text);
  
  let formattedContext = "Manual Context:\n";
  formattedContext += topChunks.join('\n---------\n');
  
  return formattedContext;
}
