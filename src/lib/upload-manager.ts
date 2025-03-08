import { bunnyService } from "./bunny-service";
import {
  parseFilename,
  determineLibrary,
  determineCollection,
} from "./filename-parser";
import type { Year } from "../types/common";

type UploadStatus = "pending" | "processing" | "completed" | "error";

interface QueueItem {
  id: string;
  file: File;
  filename: string;
  status: UploadStatus;
  progress: number;
  errorMessage?: string;
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
  private readonly toast: any;

  constructor(
    onQueueUpdate: (groups: UploadGroup[]) => void,
    toast: any
  ) {
    this.onQueueUpdate = onQueueUpdate;
    this.toast = toast;
  }

  previewFiles(files: File[], selectedYear: string) {
    for (const file of files) {
      try {
        const parsed = parseFilename(file.name);
        if (!parsed.parsed) {
          throw new Error(`تنسيق اسم الملف غير صحيح: ${file.name}`);
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
        this.toast({
          title: "تم تحديد المجموعة",
          description: `سيتم رفع "${file.name}" إلى مجموعة "${collectionResult.collection}" (${collectionResult.reason})`,
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
        
        this.toast({
          title: "تحتاج إلى تحديد يدوي",
          description: `الملف ${file.name} يحتاج إلى تحديد المكتبة والمجموعة يدوياً`,
          variant: "warning"
        });
      }
    }
    this.updateGroups();
  }

  async startUpload(files: File[], selectedYear: Year) {
    // Start actual upload process
    for (const item of this.queue) {
      try {
        item.status = "processing";
        this.updateGroups();

        // Actual upload logic here
        await this.uploadFile(item);

        item.status = "completed";
      } catch (error) {
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

  private async uploadFile(item: QueueItem) {
    try {
      // Find library by name with case-insensitive and normalized comparison
      const libraries = await bunnyService.getLibraries();
      const normalizedTargetName = item.metadata.library.replace(/\s+/g, ' ').trim();
      
      const library = libraries.find((l) => {
        const normalizedLibName = l.name.replace(/\s+/g, ' ').trim();
        return normalizedLibName.toLowerCase() === normalizedTargetName.toLowerCase();
      });

      if (!library) {
        throw new Error(`لم يتم العثور على المكتبة: ${item.metadata.library}`);
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
      const accessToken = library.apiKey || ''; // Remove getAccessToken call

      // Upload with collection ID
      await bunnyService.uploadVideo(
        item.file,
        library.id,
        (progress) => {
          item.progress = progress;
          this.updateGroups();
        },
        collectionId,
        accessToken
      );

      item.status = "completed";
      item.progress = 100;
      
      // Convert complex object to string for toast message
      const successMessage = typeof item.metadata.collection === 'string' 
        ? `تم رفع ${item.filename} إلى ${item.metadata.collection}`
        : `تم رفع ${item.filename}`;

      this.toast({
        title: "تم الرفع بنجاح",
        description: successMessage
      });

    } catch (error) {
      item.status = "error";
      // Ensure error message is always a string
      item.errorMessage = error instanceof Error ? error.message : String(error);
      
      this.toast({
        title: "خطأ في الرفع",
        description: item.errorMessage,
        variant: "destructive"
      });
    }

    this.updateGroups();
  }

  async startManualUpload(
    files: File[],
    libraryId: string,
    collectionId: string,
    selectedYear: string
  ) {
    try {
      // Get library and collection info first
      const libraries = await bunnyService.getLibraries();
      const library = libraries.find(l => l.id === libraryId);
      
      if (!library) {
        throw new Error(`لم يتم العثور على المكتبة`);
      }
  
      const collections = await bunnyService.getCollections(libraryId);
      const collection = collections.find(c => c.id === collectionId);
  
      if (!collection) {
        throw new Error(`لم يتم العثور على المجموعة`);
      }
  
      // Add files to queue with proper metadata
      for (const file of files) {
        const queueItem: QueueItem = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
          file,
          filename: file.name,
          status: "pending",
          progress: 0,
          metadata: {
            library: library.name,
            collection: collection.name,
            year: selectedYear,
            needsManualSelection: false
          }
        };
  
        this.queue.push(queueItem);
      }
  
      // Update UI to show queued files
      this.updateGroups();
  
      // Process uploads
      for (const item of this.queue) {
        try {
          item.status = "processing";
          this.updateGroups();
  
          await bunnyService.uploadVideo(
            item.file,
            libraryId,
            (progress) => {
              item.progress = progress;
              this.updateGroups();
            },
            collectionId,
            library.apiKey
          );
  
          item.status = "completed";
          item.progress = 100;
          
          this.toast({
            title: "تم الرفع بنجاح",
            description: `تم رفع ${item.filename} إلى ${collection.name}`,
          });
  
        } catch (error) {
          item.status = "error";
          item.errorMessage = error instanceof Error ? error.message : "Upload failed";
          
          this.toast({
            title: "خطأ في الرفع",
            description: item.errorMessage,
            variant: "destructive"
          });
        }
        this.updateGroups();
      }
  
    } catch (error) {
      this.toast({
        title: "خطأ",
        description: error instanceof Error ? error.message : "Upload failed", 
        variant: "destructive"
      });
      throw error;
    }
  }
}
