import Fuse from 'fuse.js';

interface DocumentIndex {
  idfs: Record<string, number>;
  tfList: Record<string, number>[];
  avgdl: number;
  docLengths: number[];
  N: number;
  typoFuse: Fuse<{ word: string }>;
  versionHash: string;
}

const docCache: Record<string, DocumentIndex> = {};

// Basic BM25 Implementation Parameters
const k1 = 1.2;
const b = 0.75;

// Split large document text into ~180 word micro-chunks with 40 words of overlap to maintain sections logically intact
// Split large document text into ~180 word micro-chunks by lines, preserving original paragraphs and bullet point spacing
export function chunkText(text: string): string[] {
  if (!text) return [];
  const lines = text.split('\n');
  const chunks = [];
  let currentChunk: string[] = [];
  let currentWordCount = 0;
  
  for (const line of lines) {
    currentChunk.push(line);
    const wordsInLine = line.trim().split(/\s+/).filter(w => w.length > 0).length;
    currentWordCount += wordsInLine;
    
    if (currentWordCount >= 180) {
      chunks.push(currentChunk.join('\n'));
      // Keep last 3 lines for clean overlap and context flow
      currentChunk = currentChunk.slice(-3);
      currentWordCount = currentChunk.join(' ').split(/\s+/).filter(w => w.length > 0).length;
    }
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n'));
  }
  return chunks;
}

export function searchPdfContext(textChunks: string[], query: string, equipId?: string): string {
  if (!textChunks || textChunks.length === 0) return '';
  
  const stopWords = new Set(['how', 'do', 'i', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'what', 'where', 'when', 'why', 'who', 'does', 'did', 'can', 'could', 'should', 'would', 'to', 'of', 'for', 'with', 'in', 'on', 'at', 'by', 'about', 'as']);
  const keywords = query.replace(/[^a-z0-9\s\.-]/gi, '').toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));

  if (keywords.length === 0) return '';

  const cacheKey = equipId || 'temp_' + Math.random().toString(36);
  // Hash to avoid using old index if chunks change
  const versionHash = textChunks.length.toString() + (textChunks[0] ? textChunks[0].substring(0, 20) : '');

  // 1. Check or Build Cached BM25 and Typo-Correction Index
  if (!docCache[cacheKey] || docCache[cacheKey].versionHash !== versionHash) {
    console.log(`Building BM25 Index for cacheKey: ${cacheKey}...`);
    
    const idfs: Record<string, number> = {};
    const tfList: Record<string, number>[] = [];
    const docLengths: number[] = [];
    let totalLength = 0;
    const documentFrequencies: Record<string, number> = {};
    const vocabSet = new Set<string>();

    for (const chunk of textChunks) {
      const words = chunk.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ');
      const filteredWords = words.filter(w => w.length > 2 && !stopWords.has(w));
      
      const chunkLength = filteredWords.length;
      docLengths.push(chunkLength);
      totalLength += chunkLength;

      const tf: Record<string, number> = {};
      const uniqueWordsInChunk = new Set<string>();

      for (const w of filteredWords) {
        tf[w] = (tf[w] || 0) + 1;
        uniqueWordsInChunk.add(w);
        if (w.length > 4) vocabSet.add(w);
      }
      
      tfList.push(tf);

      for (const uw of uniqueWordsInChunk) {
        documentFrequencies[uw] = (documentFrequencies[uw] || 0) + 1;
      }
    }

    const N = textChunks.length;
    const avgdl = N > 0 ? totalLength / N : 0;

    for (const word in documentFrequencies) {
      const nq = documentFrequencies[word];
      // BM25 IDF formula
      const idf = Math.log((N - nq + 0.5) / (nq + 0.5) + 1);
      idfs[word] = idf;
    }

    const vocabWords = Array.from(vocabSet);
    const typoFuse = new Fuse(vocabWords.map(w => ({ word: w })), { keys: ['word'], threshold: 0.3 });

    docCache[cacheKey] = {
      idfs,
      tfList,
      avgdl,
      docLengths,
      N,
      typoFuse,
      versionHash
    };
    console.log(`BM25 Index Built successfully.`);
  }

  const index = docCache[cacheKey];

  // 2. Contextual Typo Auto-Correction Engine (Instant using Cached Fuse)
  const correctedKeywords = keywords.map(kw => {
    if (kw.length > 4) {
      const match = index.typoFuse.search(kw);
      if (match.length > 0 && match[0].item) {
        return match[0].item.word;
      }
    }
    return kw;
  });

  console.log('RAG Original Keywords:', keywords);
  console.log('RAG Corrected Keywords:', correctedKeywords);

  // 3. Score Chunks based on BM25 Algorithm + Exact Phrase Cache
  const correctedPhrase = correctedKeywords.join(' ');
  
  const scoredChunks = textChunks.map((chunk, i) => {
    let score = 0;
    const chunkLower = chunk.toLowerCase();
    
    // Exact Phrase Match Bonus (Keeps chunks with phrases like "replace motor filter" clustered perfectly)
    if (chunkLower.includes(correctedPhrase)) {
      score += 1000;
    }

    const tf = index.tfList[i];
    const dl = index.docLengths[i];

    // Core BM25 Calculation
    for (const kw of correctedKeywords) {
        // Basic stemming check without external libraries
        const stems = [kw];
        if (kw.endsWith('s')) stems.push(kw.slice(0, -1));

        for (const stem of stems) {
            if (tf[stem]) {
               const f = tf[stem];
               const idf = index.idfs[stem] || 0;
               const termScore = idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * (dl / index.avgdl)));
               score += termScore;
               // Only count a word once even if its stem also hits to prevent double-scoring
               break; 
            }
        }
    }

    return { text: chunk, score, index: i };
  });

  const activeChunks = scoredChunks.filter(c => c.score > 0).sort((a, b) => b.score - a.score);

  if (activeChunks.length === 0) {
    // Fallback: simple case-insensitive substring search to guarantee context retrieval if keywords exist
    const fallbackScored = textChunks.map((chunk, i) => {
      let score = 0;
      const chunkLower = chunk.toLowerCase();
      for (const kw of correctedKeywords) {
        if (chunkLower.includes(kw)) {
          score += 1;
        }
      }
      return { text: chunk, score, index: i };
    });
    
    const fallbackActive = fallbackScored.filter(c => c.score > 0).sort((a, b) => b.score - a.score);
    if (fallbackActive.length === 0) return '';
    
    const topChunksObj = fallbackActive.slice(0, 2).sort((a, b) => a.index - b.index);
    let formattedContext = "Manual Context:\n";
    formattedContext += topChunksObj.map(r => `[DOCUMENT LOCATION: Section ${r.index}]\n${r.text}`).join('\n\n-----------------\n\n');
    return formattedContext;
  }

  // Take top 2 best-matching micro-chunks to ensure ultra-fast context processing
  // Sort them by original index to maintain the reading order exactly from the PDF.
  const topChunksObj = activeChunks.slice(0, 2).sort((a, b) => a.index - b.index);
  
  let formattedContext = "Manual Context:\n";
  formattedContext += topChunksObj.map(r => `[DOCUMENT LOCATION: Section ${r.index}]\n${r.text}`).join('\n\n-----------------\n\n');
  
  return formattedContext;
}
