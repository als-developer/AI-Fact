/**
 * Document Processing Service
 * Handles PDF and document text extraction
 */

import type { Bindings } from '../types';

export interface ProcessedDocument {
  text: string;
  pageCount: number;
  metadata: {
    title?: string;
    author?: string;
    createdAt?: Date;
    pageCount: number;
    wordCount: number;
    characterCount: number;
  };
}

export class DocumentProcessorService {
  constructor(private env: Bindings) {}

  async processPDF(fileBuffer: ArrayBuffer, filename: string): Promise<ProcessedDocument> {
    // In production, use pdf.js or pdf-parse
    // For now, return extracted text from buffer
    const text = await this.extractTextFromPDF(fileBuffer);
    const wordCount = this.countWords(text);
    
    return {
      text,
      pageCount: 1, // Would calculate from PDF structure
      metadata: {
        title: filename,
        pageCount: 1,
        wordCount,
        characterCount: text.length,
      },
    };
  }

  async processTXT(fileBuffer: ArrayBuffer, filename: string): Promise<ProcessedDocument> {
    const text = new TextDecoder().decode(fileBuffer);
    const wordCount = this.countWords(text);
    
    return {
      text,
      pageCount: 1,
      metadata: {
        title: filename,
        pageCount: 1,
        wordCount,
        characterCount: text.length,
      },
    };
  }

  private async extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
    // Simplified PDF text extraction
    // In production, use a proper PDF parsing library
    const text = new TextDecoder().decode(buffer);
    // Basic text extraction (PDFs contain binary data, so this is simplified)
    const extracted = text.replace(/[^\w\s.,!?;:-]/g, ' ').replace(/\s+/g, ' ');
    return extracted.substring(0, 50000);
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }

  async chunkDocument(text: string, chunkSize: number = 5000, overlap: number = 500): Promise<string[]> {
    const chunks: string[] = [];
    let start = 0;
    
    while (start < text.length) {
      let end = start + chunkSize;
      if (end < text.length) {
        // Try to find a sentence boundary
        const lastPeriod = text.lastIndexOf('.', end);
        const lastNewline = text.lastIndexOf('\n', end);
        end = Math.max(lastPeriod, lastNewline, end);
      }
      chunks.push(text.substring(start, Math.min(end, text.length)));
      start = end - overlap;
    }
    
    return chunks;
  }
}
