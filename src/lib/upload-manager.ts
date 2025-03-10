import { bunnyService } from "./bunny-service";
import {
  parseFilename,
  determineLibrary,
  determineCollection,
} from "./filename-parser";
import type { Year } from "../types/common";
import { showToast } from "../hooks/use-toast" // Fix import path

type UploadStatus = "pending" | "processing" | "completed" | "error" | "paused";

interface QueueItem {
  id: string;
  file: File;
  filename: string;
  status: UploadStatus;
  progress: number;
  errorMessage?: string;
  controller?: AbortController; // Add controller property
  isPaused?: boolean; // Add isPaused property
  uploadSpeed?: number;  // Speed in bytes per second
  lastProgressUpdate?: number;  // Timestamp of last progress update
  lastBytesLoaded?: number;    // Last known bytes loaded
  startTime?: number;
  metadata: {
    library: string;
    collection: string;
    year: string;
    needsManualSelection?: boolean;
    reason?: string; // Add this to allow reason
  };
}

interface UploadGroup {
  library: string;
  collection: string;
  items: QueueItem[];
  needsManualSelection?: boolean;
}

export class UploadManager {
  private queue: QueueItem[] = [];
  private failedItems: QueueItem[] = [];  // للملفات التي فشل تحديد مكتبتها
  private onQueueUpdate: (groups: UploadGroup[]) => void;
  private onVideoUploaded?: (videoTitle: string, videoGuid: string, libraryId: string) => void;
  private batchSize = 5; // Process videos in batches of 5
  private processingCount = 0;
  private maxConcurrent = 1; // تعديل ليسمح برفع فيديو واحد فقط
  private isGloballyPaused = false;
  private isProcessing = false;

  constructor(
    onQueueUpdate: (groups: UploadGroup[]) => void,
    onVideoUploaded?: (videoTitle: string, videoGuid: string, libraryId: string) => void
  ) {
    this.onQueueUpdate = onQueueUpdate;
    this.onVideoUploaded = onVideoUploaded;
  }

  previewFiles(files: File[], selectedYear: string) {
    for (const file of files) {
      try {
        const parsed = parseFilename(file.name);
        if (!parsed.parsed) {
          throw new Error(`Invalid filename format: ${file.name}`);
        }

        const libraryName = determineLibrary(parsed.parsed);
        const collectionResult = determineCollection(parsed.parsed, selectedYear as "2024" | "2025");

        const queueItem: QueueItem = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
          file,
          filename: file.name,
          status: "pending",
          progress: 0,
          metadata: {
            library: libraryName,
            collection: collectionResult.collection, // Use just the collection name
            year: selectedYear,
            needsManualSelection: false,
            reason: collectionResult.reason // Optionally store the reason if needed
          }
        };

        this.queue.push(queueItem);
        
        // Show informative toast with the reason
        showToast({
          title: "Collection Selected",
          description: `"${file.name}" will be uploaded to "${collectionResult.collection}" (${collectionResult.reason})`,
        });

      } catch (error) {
        // Handle failed items as before
        const failedItem: QueueItem = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
          file,
          filename: file.name,
          status: "pending",
          progress: 0,
          metadata: {
            library: "",
            collection: "",
            year: selectedYear,
            needsManualSelection: true
          }
        };
        this.failedItems.push(failedItem);
        
        showToast({
          title: "Manual Selection Needed",
          description: `File ${file.name} needs manual library and collection selection`,
          variant: "warning"
        });
      }
    }
    this.updateGroups();
  }

  async startUpload(files: File[], selectedYear: Year) {
    this.sortQueue(); // Sort before starting upload
    
    for (const item of this.queue) {
      if (this.isGloballyPaused) {
        // توقف إذا كان هناك إيقاف شامل
        item.status = "paused";
        this.updateGroups();
        break;
      }

      try {
        item.status = "processing";
        this.updateGroups();

        await this.uploadFile(item);

        item.status = "completed";
      } catch (error) {
        if (error.name === 'AbortError') {
          break; // توقف عن المتابعة في حالة الإيقاف
        }
        item.status = "error";
        item.errorMessage = error instanceof Error ? error.message : "خطأ غير معروف";
      }
      this.updateGroups();
    }
  }

  // إضافة طريقة لتحديث معلومات الملف يدوياً
  updateFileMetadata(fileId: string, library: string, collection: string) {
    const item = [...this.queue, ...this.failedItems].find(i => i.id === fileId);
    if (item) {
      item.metadata.library = library;
      item.metadata.collection = collection;
      item.metadata.needsManualSelection = false;
      
      // نقل من قائمة الفاشلة إلى قائمة الانتظار إذا كان موجوداً فيها
      const failedIndex = this.failedItems.findIndex(i => i.id === fileId);
      if (failedIndex !== -1) {
        this.queue.push(...this.failedItems.splice(failedIndex, 1));
      }
      
      this.updateGroups();
    }
  }

  // تعديل updateGroups لتشمل الملفات التي تحتاج إلى تحديد يدوي
  private updateGroups() {
    const groups: UploadGroup[] = [];
    const groupMap = new Map<string, UploadGroup>();

    // إضافة مجموعة خاصة للملفات التي تحتاج إلى تحديد يدوي
    if (this.failedItems.length > 0) {
      groups.push({
        library: "يحتاج إلى تحديد",
        collection: "يحتاج إلى تحديد",
        items: this.failedItems,
        needsManualSelection: true
      });
    }

    // إضافة باقي المجموعات
    for (const item of this.queue) {
      const key = `${item.metadata.library}|${item.metadata.collection}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          library: item.metadata.library,
          collection: item.metadata.collection,
          items: [],
          needsManualSelection: false
        });
      }
      groupMap.get(key)?.items.push(item);
    }

    groups.push(...Array.from(groupMap.values()));
    this.onQueueUpdate(groups);
  }

  pauseUpload(fileId: string) {
    const item = this.findFile(fileId);
    if (item && item.controller) {
      item.controller.abort('pause'); // Use specific abort reason
      item.isPaused = true;
      item.status = "paused";
      this.updateGroups();
    }
  }

  resumeUpload(fileId: string) {
    const item = this.findFile(fileId);
    if (item && item.isPaused) {
      item.isPaused = false;
      item.status = "processing";
      this.uploadFile(item); // Restart the upload with new controller
      this.updateGroups();
    }
  }

  cancelUpload(fileId: string) {
    const item = this.findFile(fileId);
    if (item && item.controller) {
      item.controller.abort('cancel'); // Use specific abort reason
      this.queue = this.queue.filter(i => i.id !== fileId);
      
      // Show warning toast about manual cleanup needed
      showToast({
        title: "Upload Cancelled",
        description: "Please note: You'll need to manually delete the partially uploaded video from Bunny.net",
        variant: "warning",
        duration: 5000
      });
      
      this.updateGroups();
    }
  }

  private async uploadFile(item: QueueItem) {
    if (this.isGloballyPaused) {
      item.status = "paused";
      this.updateGroups();
      return;
    }

    try {
      item.startTime = Date.now(); // Add start time when upload begins
      // Create new abort controller for this upload
      item.controller = new AbortController();
      item.isPaused = false;
      item.lastProgressUpdate = Date.now();
      item.lastBytesLoaded = 0;

      // Find library by name with case-insensitive and normalized comparison
      const libraries = await bunnyService.getLibraries();
      const normalizedTargetName = item.metadata.library.replace(/\s+/g, ' ').trim();
      
      const library = libraries.find((l) => {
        const normalizedLibName = l.name.replace(/\s+/g, ' ').trim();
        return normalizedLibName.toLowerCase() === normalizedTargetName.toLowerCase();
      });

      if (!library) {
        throw new Error(`Library not found: ${item.metadata.library}`);
      }

      // Get collections for this library
      const collections = await bunnyService.getCollections(library.id);
      const collection = collections.find(c => c.name === item.metadata.collection);
      
      // Create collection if it doesn't exist
      let collectionId = collection?.id;
      if (!collection) {
        const newCollection = await bunnyService.createCollection(
          library.id,
          item.metadata.collection
        );
        collectionId = newCollection.id;
      }

      // Use library-specific API key for upload
      const accessToken = library.apiKey || '';

      // Check if video already exists
      const exists = await this.checkExistingVideo(
        item.filename,
        library.id,
        collectionId
      );

      if (exists) {
        showToast({
          title: "Skip Upload",
          description: `${item.filename} already exists in the collection`,
          variant: "warning"
        });
        item.status = "completed";
        item.progress = 100;
        this.updateGroups();
        return;
      }

      // Remove extension from filename before upload
      const filenameWithoutExt = item.filename.split('.')[0];

      const response = await bunnyService.uploadVideo(
        item.file,
        library.id,
        (progress, bytesLoaded) => {
          if (this.isGloballyPaused) return;
          const now = Date.now();
          if (item.lastProgressUpdate && item.lastBytesLoaded !== undefined) {
            const timeDiff = (now - item.lastProgressUpdate) / 1000; // Convert to seconds
            const bytesDiff = bytesLoaded - item.lastBytesLoaded;
            item.uploadSpeed = bytesDiff / timeDiff; // Bytes per second
          }
          
          item.progress = progress;
          item.lastProgressUpdate = now;
          item.lastBytesLoaded = bytesLoaded;
          this.updateGroups();
        },
        collectionId,
        accessToken,
        item.controller.signal, // Pass the abort signal
        filenameWithoutExt // Pass filename without extension
      );

      item.status = "completed";
      item.progress = 100;
      
      showToast({
        title: "Upload Success",
        description: `Successfully uploaded ${item.filename} to ${item.metadata.collection}`
      });

      // Call callback if provided
      if (this.onVideoUploaded) {
        await this.onVideoUploaded(item.filename, response.guid, library.id);
      }

      // Check if all uploads are completed
      const allCompleted = this.queue.every(item => 
        item.status === "completed" || item.status === "error"
      );

      if (allCompleted) {
        const stats = this.getUploadStats();
        showToast({
          title: "🎉 All Uploads Completed",
          description: `Successfully uploaded ${stats.success} files\n${stats.failed} failed\nTotal time: ${stats.totalTime}`,
          variant: "success",
          duration: 5000
        });
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        // Handle abort case differently if needed
        return;
      }
      item.status = "error";
      item.errorMessage = error instanceof Error ? error.message : String(error);
      
      showToast({
        title: "Upload Error",
        description: item.errorMessage,
        variant: "destructive"
      });
    } finally {
      // Clean up controller after upload completes or fails
      delete item.controller;
    }

    this.updateGroups();
  }

  private async processNextBatch() {
    if (this.processingCount >= this.maxConcurrent) return;

    const pendingItems = this.queue.filter(item => item.status === "pending");
    if (!pendingItems.length) return;

    const itemsToProcess = pendingItems.slice(0, this.batchSize);
    
    for (const item of itemsToProcess) {
      if (this.processingCount >= this.maxConcurrent) break;
      
      this.processingCount++;
      item.status = "processing";
      this.updateGroups();
      
      // Process in background without awaiting
      this.uploadFile(item).catch(error => {
        console.error('Upload error:', error);
        this.processingCount--;
      });
    }
  }

  private findFile(fileId: string): QueueItem | undefined {
    return [...this.queue, ...this.failedItems].find(item => item.id === fileId);
  }

  async startManualUpload(
    files: File[],
    libraryId: string,
    collectionId: string,
    selectedYear: string
  ) {
    // نفس منطق الرفع التلقائي
    for (const item of this.queue) {
      if (this.isGloballyPaused) {
        item.status = "paused";
        this.updateGroups();
        break;
      }

      try {
        item.status = "processing";
        this.updateGroups();

        await this.uploadFile(item);

        item.status = "completed";
      } catch (error) {
        if (error.name === 'AbortError') {
          break;
        }
        item.status = "error";
        item.errorMessage = error instanceof Error ? error.message : "خطأ غير معروف";
      }
      this.updateGroups();
    }
  }

  toggleGlobalPause() {
    this.isGloballyPaused = !this.isGloballyPaused;
    
    if (this.isGloballyPaused) {
      // Pause all active uploads
      this.queue.forEach(item => {
        if (item.status === "processing") {
          item.controller?.abort('pause');
          item.isPaused = true;
          item.status = "paused";
        }
      });
    } else {
      // Resume all paused uploads
      this.queue.forEach(item => {
        if (item.status === "paused") {
          item.isPaused = false;
          item.status = "processing";
          this.uploadFile(item);
        }
      });
    }
    
    this.updateGroups();
  }

  private sortQueue() {
    this.queue.sort((a, b) => {
      // Remove extensions and compare
      const nameA = a.filename.split('.')[0];
      const nameB = b.filename.split('.')[0];

      // First split by Q number
      const baseNameA = nameA.split(/Q\d+/)[0];
      const baseNameB = nameB.split(/Q\d+/)[0];

      if (baseNameA !== baseNameB) {
        return baseNameA.localeCompare(baseNameB);
      }

      // Then sort by Q number
      const qNumA = parseInt(nameA.match(/Q(\d+)/)?.[1] || "0");
      const qNumB = parseInt(nameB.match(/Q(\d+)/)?.[1] || "0");
      return qNumA - qNumB;
    });
  }

  private async checkExistingVideo(filename: string, libraryId: string, collectionId: string): Promise<boolean> {
    try {
      const nameWithoutExt = filename.split('.')[0];
      const videos = await bunnyService.getVideos(libraryId, collectionId);
      return videos.some(video => video.title.split('.')[0] === nameWithoutExt);
    } catch (error) {
      console.error('Error checking existing video:', error);
      return false;
    }
  }

  clearQueue() {
    // Only clear if all uploads are completed or failed
    const hasActiveUploads = this.queue.some(item => 
      item.status === "processing" || item.status === "pending"
    );

    if (hasActiveUploads) {
      showToast({
        title: "⚠️ Warning",
        description: "Cannot clear queue while uploads are in progress",
        variant: "warning",
        duration: 3000
      });
      return false;
    }

    this.queue = [];
    this.failedItems = [];
    this.updateGroups();
    return true;
  }

  private getUploadStats() {
    const success = this.queue.filter(i => i.status === "completed").length;
    const failed = this.queue.filter(i => i.status === "error").length;
    const totalTime = this.calculateTotalUploadTime();
    return { success, failed, totalTime };
  }

  private calculateTotalUploadTime(): string {
    // Calculate total time in seconds
    const now = Date.now();
    const startTime = Math.min(...this.queue.map(i => i.startTime || now));
    const seconds = Math.round((now - startTime) / 1000);
    
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes}m ${seconds % 60}s`;
    }
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  hasActiveUploads(): boolean {
    return this.queue.some(item => 
      item.status === "processing" || item.status === "pending"
    );
  }
}
