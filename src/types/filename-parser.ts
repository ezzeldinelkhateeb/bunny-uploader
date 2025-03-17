export interface ParsedFilename {
  type: 'RE' | 'QV' | 'FULL';
  academicYear: string; // e.g., "S1", "M2"
  term?: string; // e.g., "T1", "T2"
  unit?: string; // e.g., "U2"
  lesson?: string; // e.g., "L1"
  branch?: string; // e.g., "AR", "EN"
  teacherCode?: string; // e.g., "P0046"
  teacherName?: string; // e.g., "Zakaria Seif Eldin"
  class?: string; // e.g., "C30"
  arabicText?: string; // Text within curly braces
}

export interface LibraryInfo {
  id: string;
  name: string;
}

export interface LibraryMatch {
  library: LibraryInfo | null;
  confidence: number;
  alternatives: LibraryInfo[];
}

export interface CollectionResult {
  name: string;
  reason: string;
}

export interface ParseResult {
  filename: string;
  parsed: ParsedFilename | null;
  libraryMatch: LibraryMatch;
  collection: CollectionResult;
  unmatchedGroup?: string;
  error?: string;
}

export const VALID_COLLECTIONS = {
  TERM1: {
    NORMAL: "-2025",
    QUESTIONS: "T1-2025-QV",
    REVISION: "RE-T1-2025-QV"
  },
  TERM2: {
    NORMAL: "T2-2025",
    QUESTIONS: "T2-2025-QV",
    REVISION: "RE-T2-2025-QV"
  },
  REVISION: "RE-2025"
} as const;

// Add back valid collections with proper structure
export interface CollectionConfig {
  name: string;
  pattern: RegExp;
  reason: string;
}

export const COLLECTIONS_CONFIG: Record<string, CollectionConfig[]> = {
  "2025": [
    {
      name: "RE-2025",
      pattern: /^RE-(?!T[12])/,
      reason: "General revision video"
    },
    {
      name: "RE-T1-2025-QV",
      pattern: /^RE-T1/,
      reason: "Term 1 revision video"
    },
    {
      name: "RE-T2-2025-QV", 
      pattern: /^RE-T2/,
      reason: "Term 2 revision video"
    },
    {
      name: "T1-2025-QV",
      pattern: /Q\d+|quiz|اختبار/i,
      reason: "Questions video for term 1"
    },
    {
      name: "T2-2025-QV",
      pattern: /T2.*Q\d+/i,
      reason: "Questions video for term 2"
    },
    {
      name: "T1-2025",
      pattern: /^(?!.*Q\d+)(?!RE)/,
      reason: "Regular content video for term 1"
    },
    {
      name: "T2-2025",
      pattern: /T2(?!.*Q\d+)(?!RE)/,
      reason: "Regular content video for term 2"
    }
  ]
};
