import Fuse from 'fuse.js';

// Split large document text into ~400 word chunks with 100 words of overlap to maintain massive sections logically intact
export function chunkText(text: string): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const chunks = [];
  // Expanded to 600 words to ensure huge sections with headings and their deep details aren't severed
  const chunkSize = 600; 
  const overlap = 150;
  
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

  // 1. Contextual Typo Auto-Correction Engine
  // We extract the document's vocabulary and use Fuse to auto-correct the user's typed keywords.
  // This seamlessly fixes errors like "secutiry" -> "security" mapped directly to actual document data.
  const sampleDocStr = textChunks.join(' ');
  const vocabWords = Array.from(new Set(sampleDocStr.toLowerCase().split(/[^\w]+/))).filter(w => w.length > 4);
  const typoFuse = new Fuse(vocabWords.map(w => ({ word: w })), { keys: ['word'], threshold: 0.3 });

  const correctedKeywords = keywords.map(kw => {
    if (kw.length > 4) {
      const match = typoFuse.search(kw);
      if (match.length > 0 && match[0].item) {
        return match[0].item.word;
      }
    }
    return kw;
  });

  console.log('RAG Original Keywords:', keywords);
  console.log('RAG Corrected Keywords:', correctedKeywords);

  // 2. Score Chunks based on Auto-Corrected Words
  const scoredChunks = textChunks.map((chunk, index) => {
    let score = 0;
    let distinctKeywords = 0;
    const chunkLower = chunk.toLowerCase();
    
    for (const kw of correctedKeywords) {
      // Basic stemming fallback: stripping trailing 's' to match singulars too
      const baseKw = kw.endsWith('s') ? kw.slice(0, -1) : kw;
      if (chunkLower.includes(baseKw)) {
        distinctKeywords += 1;
        // Minor frequency boost
        const extraMatches = chunkLower.match(new RegExp(baseKw, 'g'));
        if (extraMatches) {
          score += (extraMatches.length * 0.1);
        }
      }
    }
    
    // Core Logic: Paragraphs containing MORE of the unique words score exponentially higher
    score += (distinctKeywords * 100);

    // Exact Match Bonus: Check if the full corrected string matches chunks directly
    const correctedPhrase = correctedKeywords.join(' ');
    if (chunkLower.includes(correctedPhrase)) {
      score += 1000;
    }

    return { text: chunk, score, index };
  });

  const activeChunks = scoredChunks.filter(c => c.score > 0).sort((a, b) => b.score - a.score);

  if (activeChunks.length === 0) return '';

  // Take top 3 best-matching chunks (safely leaves enough tokens for n_predict out of 4096)
  // Sort them by original index to maintain the reading order from the PDF strictly.
  const topChunksObj = activeChunks.slice(0, 3).sort((a, b) => a.index - b.index);
  
  let formattedContext = "Manual Context:\n";
  formattedContext += topChunksObj.map(r => `[DOCUMENT LOCATION: Section ${r.index}]\n${r.text}`).join('\n\n-----------------\n\n');
  
  return formattedContext;
}
