
/**
 * Local NLP Service for "Magic Tagging"
 * Implements Term Frequency (TF) analysis and Heuristic Matching
 */

const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'of', 'for', 'with', 'to', 'in', 'it', 'is', 'are', 'was', 'were',
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'but', 'if', 'or', 'because', 'as', 'until', 'while',
  'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above',
  'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once'
]);

export interface MagicAnalysisResult {
  triggerKeywords: string[];
  triggerOcrPhrases: string[];
  confidence: number;
}

/**
 * Extracts significant triggers locally
 */
export const extractTriggersLocally = (text: string): MagicAnalysisResult => {
  if (!text) return { triggerKeywords: [], triggerOcrPhrases: [], confidence: 0 };

  // 1. Tokenize and clean
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w));

  // 2. Count frequencies
  const freq: Record<string, number> = {};
  words.forEach(w => {
    freq[w] = (freq[w] || 0) + 1;
  });

  // 3. Sort by frequency
  const sortedWords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0]);

  // Keywords (top single words)
  const keywords = sortedWords.slice(0, 8);
  
  // OCR Phrases (simulated by taking pairs of high freq words or common academic bigrams)
  // Here we just take slightly longer academic tokens for "Phrases"
  const phrases = sortedWords.filter(w => w.length > 6).slice(0, 5);

  return {
    triggerKeywords: keywords,
    triggerOcrPhrases: phrases,
    confidence: Math.min(0.95, 0.4 + (keywords.length * 0.05))
  };
};

/**
 * Simulates a slight delay to allow for "Advanced" UI animations
 */
export const simulateNlpProcessing = async (ms: number = 1500) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};
