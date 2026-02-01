
export enum Month {
  MAY = 'May',
  NOVEMBER = 'November'
}

export enum PaperType {
  PAPER_1 = 'Paper 1',
  PAPER_2 = 'Paper 2/1-b' // Covers Paper 2, 1-b, 3 etc.
}

export interface PdfPair {
  id: string;
  questionPdf: File;
  answerPdf: File;
}

export interface ExamMetadata {
  id: string;
  subject: string;
  year: number;
  month: Month;
  timezone?: string;
  paperType: PaperType;
  questionPdf?: File; // For backward compatibility
  answerPdf?: File;   // For backward compatibility
  pdfPairs?: PdfPair[]; 
}

export interface QuestionPart {
  id: string;
  label: string; // a, b, c... or 'i' for Paper 1
  
  // Supports multiple images per part (e.g. question spans two pages)
  questionImages: string[]; 
  answerImages?: string[]; 
  
  // Backward compatibility for old JSONs (optional)
  questionImage?: string;
  answerImage?: string;

  answerText?: string; // For Paper 1 MCQ (A, B, C, D)
}

export type StudyStatus = 'None' | 'Easy' | 'Hard' | 'Review';

export interface QuestionEntry {
  id: string;
  createdAt: number;
  keywords: string[];
  topics: string[]; // Actual tags applied to the question
  ocrText?: string; // Extracted text from question images for search
  
  // Study Mode Data
  userStatus?: StudyStatus;

  // Metadata copies for flattening
  year: number;
  month: Month;
  subject: string;
  timezone?: string;
  paperType: PaperType;
  
  questionNumber: string;
  
  // Paper 1 might have 1 part with no label, Paper 2 has multiple
  parts: QuestionPart[];
}

export interface Folder {
  id: string;
  name: string;
  subject: string;
  // Folders are "Smart Filters"
  filterKeywords: string[]; 
  filterTopics: string[];
  filterUncategorized?: boolean; // New: Only include questions with 0 topics
}

export interface Lesson {
  id: string;
  name: string;
  subject: string;
  triggerKeywords: string[];    // Rule 1: Keywords that trigger this tag
  triggerOcrPhrases: string[];  // Rule 2: OCR text that triggers this tag
  referenceText?: string;       // Context for Magic Tag generation
}

export interface AppState {
  exams: QuestionEntry[];
}
