import {
  VideoUploadConfig,
  DEFAULT_UPLOAD_CONFIG,
  ProcessingStatus,
} from "../types/bunny";
import { bunnyService } from "./bunny-service";
import { parseFilename } from './filename-parser';
import { ParseResult } from '../types/filename-parser';

interface ParsedFilename {
  type?: 'RE' | 'QV' | 'FULL';
  academicYear?: string;
  term?: string;
  suggestedLibraries?: string[];
}

interface QueueItem {
  id: string;
  file: File;
  parsed: ParsedFilename | null;
  libraryId?: string;
  collectionId?: string;
  status: {
    status: "pending" | "processing" | "completed" | "error";
    progress: number;
    error?: string;
  };
  attempts: number;
}

interface UploadGroup {
  id: string;
  files: QueueItem[];
  collectionId: string;
  suggestedLibraries: string[];
  status: 'pending' | 'needsLibrary' | 'ready';
}

export class UploadQueue {
  private queue: QueueItem[] = [];
  private processing: Set<string> = new Set();
  private config: VideoUploadConfig;
  private groups: Map<string, UploadGroup> = new Map();

  constructor(config: Partial<VideoUploadConfig> = {}) {
    this.config = { ...DEFAULT_UPLOAD_CONFIG, ...config };
  }

  /**
   * إضافة ملف إلى قائمة الانتظار
   * @param file - الملف المراد رفعه
   * @param libraryId - معرف المكتبة
   * @param collectionId - معرف المجموعة
   * @returns معرف الملف في قائمة الانتظار
   */
  add(file: File, libraryId: string, collectionId: string): string {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.queue.push({
      id,
      file,
      parsed: null,
      libraryId,
      collectionId,
      status: { status: "pending", progress: 0 },
      attempts: 0,
    });

    this.processQueue(); // بدء المعالجة
    return id;
  }

  addFile(file: File): string {
    const parseResult = parseFilename(file.name);
    const groupId = findMatchingGroup(file.name);
    
    // Transform ParseResult to ParsedFilename
    const parsed: ParsedFilename = {
      type: parseResult.parsed?.type,
      academicYear: parseResult.parsed?.academicYear,
      term: parseResult.parsed?.term,
      suggestedLibraries: parseResult.libraryMatch?.alternatives?.map(lib => lib.id)
    };

    if (!this.groups.has(groupId)) {
      this.groups.set(groupId, {
        id: groupId,
        files: [],
        collectionId: '', // سيتم تحديده لاحقاً
        suggestedLibraries: [],
        status: 'pending'
      });
    }
    
    const group = this.groups.get(groupId)!;
    
    // إضافة الملف للمجموعة
    const queueItem: QueueItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      parsed: parsed,
      status: { status: "pending", progress: 0 },
      attempts: 0
    };
    
    group.files.push(queueItem);
    
    // Update group's suggested libraries
    if (parseResult.libraryMatch?.alternatives?.length) {
      group.suggestedLibraries = parseResult.libraryMatch.alternatives.map(lib => lib.id);
    }
    
    // تحديث حالة المجموعة
    this.updateGroupStatus(groupId);
    
    return queueItem.id;
  }

  private updateGroupStatus(groupId: string) {
    const group = this.groups.get(groupId);
    if (!group) return;

    const allFilesParsed = group.files.every(item => item.parsed);
    const hasLibrary = group.files.some(item => item.parsed?.suggestedLibraries?.length > 0);

    group.status = allFilesParsed 
      ? (hasLibrary ? 'ready' : 'needsLibrary')
      : 'pending';
  }

  async processGroup(groupId: string, selectedLibrary?: string) {
    const group = this.groups.get(groupId);
    if (!group) return;

    for (const item of group.files) {
      if (!item.libraryId || !item.collectionId) return;
      
      if (selectedLibrary) {
        await this.uploadFile(item);
      } else if (item.parsed?.suggestedLibraries?.[0]) {
        await this.uploadFile(item);
      }
    }
  }

  /**
   * معالجة قائمة الانتظار
   */
  private async processQueue() {
    // إذا وصلنا إلى الحد الأقصى للطلبات المتزامنة، توقف
    if (this.processing.size >= this.config.maxConcurrent) return;

    // البحث عن العنصر التالي الذي لم يتم معالجته
    const next = this.queue.find(
      (item) =>
        item.status.status === "pending" && !this.processing.has(item.id),
    );

    if (!next) return; // إذا لم يتم العثور على عنصر، توقف

    this.processing.add(next.id); // وضع العنصر في حالة "جارٍ المعالجة"
    next.status = { status: "processing", progress: 0 };

    try {
      await this.uploadFile(next); // رفع الملف
      next.status = { status: "completed", progress: 100 }; // تحديث الحالة إلى "مكتمل"
    } catch (error) {
      if (next.attempts < this.config.retryAttempts) {
        // إعادة المحاولة إذا كانت المحاولات أقل من الحد الأقصى
        next.attempts++;
        next.status = { status: "pending", progress: 0 };
      } else {
        // إذا فشلت جميع المحاولات، تحديث الحالة إلى "خطأ"
        next.status = {
          status: "error",
          progress: 0,
          error: error instanceof Error ? error.message : "Upload failed",
        };
      }
    } finally {
      this.processing.delete(next.id); // إزالة العنصر من قائمة المعالجة
      this.processQueue(); // معالجة العنصر التالي
    }
  }

  /**
   * رفع الملف إلى Bunny.net
   * @param item - العنصر المراد رفعه
   */
  private async uploadFile(item: QueueItem): Promise<void> {
    if (!item.libraryId) throw new Error("Library ID is required");
    if (!item.collectionId) throw new Error("Collection ID is required");

    const onProgress = (progress: number) => {
      item.status = { status: "processing", progress };
    };

    await bunnyService.uploadVideo(
      item.file,
      item.libraryId,
      onProgress,
      item.collectionId
    );
  }

  /**
   * الحصول على حالة العنصر
   * @param id - معرف العنصر
   * @returns حالة العنصر أو null إذا لم يتم العثور عليه
   */
  getStatus(id: string): ProcessingStatus | null {
    const item = this.queue.find((i) => i.id === id);
    return item ? item.status : null;
  }

  /**
   * مسح قائمة الانتظار
   */
  clear() {
    this.queue = [];
    this.processing.clear();
  }
}

// Add these helper functions
function findMatchingGroup(filename: string): string {
  // Simple implementation - you can enhance this
  return filename.split('-')[0];
}
