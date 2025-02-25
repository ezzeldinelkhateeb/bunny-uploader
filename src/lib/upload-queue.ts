import {
  VideoUploadConfig,
  DEFAULT_UPLOAD_CONFIG,
  ProcessingStatus,
} from "../types/bunny";
import { bunnyService } from "./bunny-service";

interface QueueItem {
  id: string;
  file: File;
  libraryId: string;
  collectionId: string;
  status: ProcessingStatus;
  attempts: number;
}

export class UploadQueue {
  private queue: QueueItem[] = [];
  private processing: Set<string> = new Set();
  private config: VideoUploadConfig;

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
      libraryId,
      collectionId,
      status: { status: "pending", progress: 0 },
      attempts: 0,
    });

    this.processQueue(); // بدء المعالجة
    return id;
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
    const { file, libraryId } = item;

    // تحديث حالة التقدم أثناء الرفع
    const onProgress = (progress: number) => {
      item.status = { status: "processing", progress };
    };

    // رفع الملف باستخدام bunnyService
    await bunnyService.uploadVideo(file, libraryId, onProgress);
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
