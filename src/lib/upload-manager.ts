import { bunnyService } from "./bunny-service";
import {
  parseFilename,
  determineLibrary,
  determineCollection,
  findMatchingLibrary, // Add this import
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
  errorMessage?: string;  // Add this line
  controller?: AbortController; // Add controller property
  isPaused?: boolean; // Add isPaused property
  uploadSpeed?: number;  // Speed in bytes per second
  lastProgressUpdate?: number;  // Timestamp of last progress update
  lastBytesLoaded?: number;    // Last known bytes loaded
  startTime?: number;
  pausedAt?: number;
  metadata: {
    library: string;
    collection: string;
    year: string;
    needsManualSelection?: boolean;
    reason?: string; // Add this to allow reason
    suggestedLibraries?: Array<{
      id: string;
      name: string;
      confidence: number;
    }>;
  };
}

interface UploadGroup {
  library: string;
  collection: string;
  items: QueueItem[];
  needsManualSelection?: boolean;
}

interface LibraryMatch {
  library: string;
  score: number;
}

export class UploadManager {
  private queue: QueueItem[] = [];
  private failedItems: QueueItem[] = [];  // للملفات التي فشل تحديد مكتبتها
  private onQueueUpdate: (groups: UploadGroup[]) => void;
  private onVideoUploaded?: (videoTitle: string, videoGuid: string, libraryId: string) => void;
  private batchSize = 5; // Process videos in batches of 5
  private processingCount = 0;
  private maxConcurrent = 3; // زيادة عدد الملفات المتزامنة
  private chunkSize = 10 * 1024 * 1024; // زيادة حجم ال chunk ل 10 ميجا
  private uploadChunkRetries = 3; // عدد محاولات إعادة رفع ال chunk
  private uploadRetryDelay = 1000; // تأخير بين المحاولات (1 ثانية)
  private isGloballyPaused = false;
  private isProcessing = false;
  private failedUploads: Set<string> = new Set(); // إضافة قائمة للملفات الفاشلة
  private maxRetries = 3; // عدد محاولات إعادة المحاولة
  private retryDelay = 5000; // تأخير 5 ثواني بين المحاولات

  constructor(
    onQueueUpdate: (groups: UploadGroup[]) => void,
    onVideoUploaded?: (videoTitle: string, videoGuid: string, libraryId: string) => void
  ) {
    this.onQueueUpdate = onQueueUpdate;
    this.onVideoUploaded = onVideoUploaded;
  }

  private async findBestLibraryMatch(targetName: string, libraries: any[]): Promise<LibraryMatch | null> {
    // Normalize the target name
    const normalizedTarget = targetName.toLowerCase()
      .replace(/\s+/g, '')
      .replace(/-/g, '');
    
    let bestMatch: LibraryMatch | null = null;
    let highestScore = 0;

    for (const lib of libraries) {
      const normalizedLibName = lib.name.toLowerCase()
        .replace(/\s+/g, '')
        .replace(/-/g, '');

      // Calculate similarity score
      let score = 0;
      const teacherCode = targetName.match(/P\d{4}/)?.[0];
      const libTeacherCode = lib.name.match(/P\d{4}/)?.[0];
      
      // Exact teacher code match is highest priority
      if (teacherCode && libTeacherCode && teacherCode === libTeacherCode) {
        score += 50;
      }

      // Check for academic year match (M1, S1, etc)
      const academicYear = targetName.match(/^[MS][1-3]/)?.[0];
      if (academicYear && lib.name.includes(academicYear)) {
        score += 30;
      }

      // Add points for each matching character in sequence
      let matchingChars = 0;
      for (let i = 0; i < normalizedTarget.length && i < normalizedLibName.length; i++) {
        if (normalizedTarget[i] === normalizedLibName[i]) {
          matchingChars++;
        }
      }
      score += (matchingChars / Math.max(normalizedTarget.length, normalizedLibName.length)) * 20;

      if (score > highestScore) {
        highestScore = score;
        bestMatch = { library: lib.name, score };
      }
    }

    // Only return match if score is above threshold
    return highestScore >= 70 ? bestMatch : null;
  }

  previewFiles(files: File[], selectedYear: string) {
    for (const file of files) {
      try {
        const parsed = parseFilename(file.name);
        if (!parsed.parsed) {
          throw new Error(`Invalid filename format: ${file.name}`);
        }

        const libraryName = determineLibrary(parsed.parsed);
        const collectionResult = determineCollection(parsed.parsed); // Remove second argument

        const queueItem: QueueItem = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
          file,
          filename: file.name,
          status: "pending",
          progress: 0,
          metadata: {
            library: libraryName,
            collection: collectionResult.name, // Use just the collection name
            year: selectedYear,
            needsManualSelection: true, // Default to true until we find a match
            reason: collectionResult.reason // Optionally store the reason if needed
          }
        };

        this.failedItems.push(queueItem);
        
        // Try to find matching library asynchronously
        this.tryMatchLibrary(queueItem);
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

  private async tryMatchLibrary(item: QueueItem) {
    try {
      const libraries = await bunnyService.getLibraries();
      const parseResult = parseFilename(item.filename);
      
      if (!parseResult.parsed) return;

      const match = findMatchingLibrary(parseResult.parsed, libraries);

      // Require higher confidence threshold or multiple good matches for auto-selection
      if (match.confidence >= 90) {
        // Move from failed items to queue with matched library
        const index = this.failedItems.findIndex(f => f.id === item.id);
        if (index !== -1) {
          const [movedItem] = this.failedItems.splice(index, 1);
          movedItem.metadata.needsManualSelection = false;
          movedItem.metadata.library = match.library!.name;
          this.queue.push(movedItem);
          
          showToast({
            title: "Library Matched",
            description: `Matched "${item.filename}" to library "${match.library!.name}" (${match.confidence.toFixed(0)}% confidence)`,
            variant: "success"
          });
        }
      } else {
        // Store suggested libraries for manual selection
        item.metadata.needsManualSelection = true;
        item.metadata.suggestedLibraries = match.alternatives.map(lib => ({
          id: lib.id,
          name: lib.name,
          confidence: match.confidence
        }));
      }
    } catch (error) {
      console.error(`Failed to match library for ${item.filename}:`, error);
    }
    this.updateGroups();
  }

  async startUpload(files: File[], selectedYear: Year) {
    this.sortQueue();
    
    for (const item of this.queue) {
      if (this.isGloballyPaused) {
        item.status = "paused";
        this.updateGroups();
        continue;
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
        this.failedUploads.add(item.id);
      }
      this.updateGroups();
    }

    const allCompleted = this.queue.every(item => 
      item.status === "completed" || item.status === "error"
    );

    if (allCompleted) {
      // محاولة إعادة رفع الملفات الفاشلة
      if (this.failedUploads.size > 0) {
        await this.retryFailedUploads();
      }

      const stats = this.getUploadStats();
      showToast({
        title: "🎉 All Uploads Completed",
        description: `Successfully uploaded ${stats.success} files\n${stats.failed} failed\nTotal time: ${stats.totalTime}`,
        variant: "success",
        duration: 5000
      });
    }
  }

  private async retryFailedUploads() {
    const failedItems = this.queue.filter(item => this.failedUploads.has(item.id));
    
    if (failedItems.length === 0) return;

    showToast({
      title: "⚠️ Retrying Failed Uploads",
      description: `Attempting to retry ${failedItems.length} failed uploads`,
      variant: "warning"
    });

    await new Promise(resolve => setTimeout(resolve, this.retryDelay));

    for (const item of failedItems) {
      let retryCount = 0;
      let success = false;

      while (retryCount < this.maxRetries && !success) {
        try {
          item.status = "processing";
          item.errorMessage = `Retry attempt ${retryCount + 1}/${this.maxRetries}`;
          this.updateGroups();

          await this.uploadFile(item);
          
          item.status = "completed";
          this.failedUploads.delete(item.id);
          success = true;
          
          showToast({
            title: "✅ Retry Successful",
            description: `Successfully uploaded ${item.filename}`,
            variant: "success"
          });
        } catch (error) {
          retryCount++;
          if (retryCount < this.maxRetries) {
            await new Promise(resolve => setTimeout(resolve, this.retryDelay));
          }
        }
      }

      if (!success) {
        item.status = "error";
        item.errorMessage = `Failed after ${this.maxRetries} retry attempts`;
        this.updateGroups();
      }
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
    if (item) {
      // إيقاف الطلب الحالي
      if (item.controller) {
        item.controller.abort();
      }
      
      // تعيين حالة الإيقاف المؤقت
      item.isPaused = true;
      item.status = "paused";
      
      // حفظ موقع التوقف الحالي
      item.pausedAt = item.lastBytesLoaded;
      
      this.updateGroups();
    }
  }

  async resumeUpload(fileId: string) {
    const item = this.findFile(fileId);
    if (item && item.isPaused) {
      // إعادة تعيين حالة الملف
      item.isPaused = false;
      item.status = "processing";
      item.controller = new AbortController();
      
      try {
        // بدء الرفع من جديد مع بيانات الاستئناف
        await this.uploadFile(item);
      } catch (error) {
        console.error('Failed to resume upload:', error);
        item.status = "error";
        item.errorMessage = "Failed to resume upload";
      }
      
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

      // تأكد من أن العملية لم يتم إيقافها قبل بدء الرفع
      if (item.isPaused) {
        return;
      }

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
        (progress, speed) => {
          if (this.isGloballyPaused) return;
          
          item.progress = progress;
          item.uploadSpeed = speed;
          this.updateGroups();
          
          // إذا كانت السرعة منخفضة جداً، حاول إعادة الاتصال
          if (speed < 500000) { // أقل من 500KB/s
            console.warn('Upload speed is very low, considering retry...');
          }
        },
        collectionId,
        accessToken,
        item.controller.signal, // Pass the abort signal
        filenameWithoutExt, // Pass filename without extension
        this.chunkSize // إضافة حجم القطع كمعامل جديد
      );

      // تأكد من أن العملية لم يتم إيقافها بعد اكتمال الرفع
      if (item.isPaused) {
        item.status = "paused";
        this.updateGroups();
        return;
      }

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
    // Create queue items for manual uploads
    const manualItems = files.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
      file,
      filename: file.name,
      status: "pending" as UploadStatus,
      progress: 0,
      errorMessage: undefined, // Add this line to include the errorMessage property
      controller: undefined,
      isPaused: false,
      metadata: {
        library: libraryId,
        collection: collectionId,
        year: selectedYear,
        needsManualSelection: false
      }
    }));

    // Add to main queue
    this.queue.push(...manualItems);
    this.updateGroups();

    // Process uploads
    for (const item of manualItems) {
      if (this.isGloballyPaused) {
        item.status = "paused";
        this.updateGroups();
        continue;
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
        item.errorMessage = error instanceof Error ? error.message : "Upload failed";
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
    this.queue = [];
    this.failedItems = [];
    this.updateGroups();
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
