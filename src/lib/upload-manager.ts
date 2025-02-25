import { bunnyService } from "./bunny-service";
import {
  parseFilename,
  determineLibrary,
  determineCollection,
} from "./filename-parser";

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
  };
}

interface UploadGroup {
  library: string;
  collection: string;
  items: QueueItem[];
}

export class UploadManager {
  private queue: QueueItem[] = [];
  private onQueueUpdate: (groups: UploadGroup[]) => void;

  constructor(onQueueUpdate: (groups: UploadGroup[]) => void) {
    this.onQueueUpdate = onQueueUpdate;
  }

  async addFiles(files: File[], selectedYear: "2024" | "2025") {
    for (const file of Array.from(files)) {
      const parsed = parseFilename(file.name);
      if (!parsed.parsed) {
        console.error(
          `Invalid filename format: ${file.name} - ${parsed.error}`,
        );
        const queueItem: QueueItem = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
          file,
          filename: file.name,
          status: "error",
          progress: 0,
          errorMessage: parsed.error,
          metadata: {
            library: "",
            collection: "",
            year: selectedYear,
          },
        };
        this.queue.push(queueItem);
        continue;
      }

      try {
        const libraryName = determineLibrary(parsed.parsed);
        const collectionName = determineCollection(parsed.parsed, selectedYear);

        const queueItem: QueueItem = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
          file,
          filename: file.name,
          status: "pending",
          progress: 0,
          metadata: {
            library: libraryName,
            collection: collectionName,
            year: selectedYear,
          },
        };

        this.queue.push(queueItem);
      } catch (error) {
        console.error(`Error processing file ${file.name}: ${error.message}`);
        const queueItem: QueueItem = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
          file,
          filename: file.name,
          status: "error",
          progress: 0,
          errorMessage: error.message,
          metadata: {
            library: "",
            collection: "",
            year: selectedYear,
          },
        };
        this.queue.push(queueItem);
      }
    }

    this.updateGroups();
    this.processQueue();
  }

  private updateGroups() {
    const groups: UploadGroup[] = [];
    const groupMap = new Map<string, UploadGroup>();

    for (const item of this.queue) {
      const key = `${item.metadata.library}|${item.metadata.collection}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          library: item.metadata.library,
          collection: item.metadata.collection,
          items: [],
        });
      }
      groupMap.get(key)?.items.push(item);
    }

    groups.push(...Array.from(groupMap.values()));
    this.onQueueUpdate(groups);
  }

  private async processQueue() {
    const pendingItems = this.queue.filter((item) => item.status === "pending");

    for (const item of pendingItems) {
      try {
        item.status = "processing";
        this.updateGroups();

        // Find library by name and get its ID and API key
        const libraries = await bunnyService.getLibraries();
        const library = libraries.find((l) => l.name === item.metadata.library);

        if (!library) {
          throw new Error(`Library not found: ${item.metadata.library}`);
        }

        // Use library-specific API key for upload
        const accessToken =
          library.apiKey || bunnyService.getApiKey(library.id);

        await bunnyService.uploadVideo(
          item.file,
          library.id,
          (progress) => {
            item.progress = progress;
            this.updateGroups();
          },
          undefined, // No collection ID in initial upload (handled via filename)
          accessToken,
        );

        item.status = "completed";
        item.progress = 100;
      } catch (error) {
        item.status = "error";
        item.errorMessage =
          error instanceof Error ? error.message : "Upload failed";
      }

      this.updateGroups();
    }
  }
}
