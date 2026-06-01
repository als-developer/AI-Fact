export class SentenceSplitterService {
  private readonly patterns = {
    en: /(?<![A-Z][a-z]\.)(?<![Dk]t\.)(?<![Mh]r\.)(?<![Ms]\.)(?<![Dr]\.)(?<![Prof]\.)(?<=\.|\?|\!)\s+(?=[A-Z])/g,
    multilingual: /(?<![A-ZÄÖÜ][a-zäöüß]\.)(?<![Dk]t\.)(?<![Mh]r\.)(?<![Ms]\.)(?<![Dr]\.)(?<=\.|\?|\!|。|！|？)\s+/g,
  };

  async splitIntoClaims(text: string, language: string = 'en'): Promise<string[]> {
    const cleaned = this.cleanText(text);
    const pattern = language === 'en' ? this.patterns.en : this.patterns.multilingual;
    let sentences = cleaned.split(pattern).filter(s => s.trim().length > 15);
    const finalClaims: string[] = [];
    for (const sentence of sentences) {
      if (sentence.length > 300) finalClaims.push(...this.splitByClauses(sentence));
      else finalClaims.push(sentence);
    }
    return finalClaims;
  }

  private cleanText(text: string): string {
    return text.replace(/\s+/g, ' ').replace(/\.\.+/g, '.').replace(/\!\s*\!/g, '!').replace(/\?\s*\?/g, '?').replace(/([.!?])([A-Za-z])/g, '$1 $2').trim();
  }

  private splitByClauses(sentence: string): string[] {
    const clauseMarkers = [',', ';', '—', '–', ' however ', ' therefore ', ' moreover '];
    let bestSplit = [sentence];
    let bestScore = Infinity;
    for (const marker of clauseMarkers) {
      const parts = sentence.split(marker);
      if (parts.length > 1) {
        const maxLength = Math.max(...parts.map(p => p.length));
        if (maxLength < bestScore) { bestScore = maxLength; bestSplit = parts; }
      }
    }
    return bestSplit.map(p => p.trim()).filter(p => p.length > 10);
  }

  extractEntities(text: string): string[] {
    const entityPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
    return [...new Set(text.match(entityPattern) || [])];
  }

  detectClaimType(claim: string): 'factual' | 'opinion' | 'prediction' | 'definition' {
    const lowerClaim = claim.toLowerCase();
    if (['is defined as', 'refers to', 'means that'].some(w => lowerClaim.includes(w))) return 'definition';
    if (['will', 'would', 'shall', 'forecast', 'predict'].some(w => lowerClaim.includes(w))) return 'prediction';
    if (['think', 'believe', 'feel', 'suggest', 'probably'].some(w => lowerClaim.includes(w))) return 'opinion';
    return 'factual';
  }
}
