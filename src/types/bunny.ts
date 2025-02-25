export interface VideoMetadata {
  type: "RE" | "QV" | "FULL";
  year: "2024" | "2025";
  term?: string;
  branch?: string;
  teacherCode?: string;
}

export interface VideoRule {
  pattern: RegExp;
  collection: string;
}

export const VIDEO_RULES: VideoRule[] = [
  { pattern: /^RE_/, collection: "Revision Collection" },
  { pattern: /^Q\d+/, collection: "Questions Collection" },
  { pattern: /.*/, collection: "Full Videos Collection" },
];

export const VALID_YEARS = ["2024", "2025"] as const;

export interface ProcessingStatus {
  status: "pending" | "processing" | "completed" | "error";
  progress: number;
  error?: string;
}

export interface VideoUploadConfig {
  maxConcurrent: number;
  retryAttempts: number;
  chunkSize: number;
  timeoutMs: number;
}

export const DEFAULT_UPLOAD_CONFIG: VideoUploadConfig = {
  maxConcurrent: 3,
  retryAttempts: 3,
  chunkSize: 1024 * 1024 * 5, // 5MB chunks
  timeoutMs: 30000, // 30 seconds
};
