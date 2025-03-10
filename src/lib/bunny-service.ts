import { cache } from "./cache";
import { dataStorage } from "./data-storage";
import { LibraryData } from "@/types/library-data";
import { showToast } from "../hooks/use-toast";
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

interface LibraryBandwidthData {
  [key: string]: {
    [date: string]: number;
  };
}

type ProcessingStatus = "pending" | "processing" | "completed" | "error";

interface VideoMetadata {
  library?: string;
  collection?: string;
  year?: string;
}

interface QueueItem {
  id: string;
  filename: string;
  status: ProcessingStatus;
  progress: number;
  errorMessage?: string;
  metadata: VideoMetadata;
}

interface Library {
  id: string;
  name: string;
  videoCount: number;
  storageUsage: number;
  trafficUsage: number;
  dateCreated: string;
  apiKey: string;
  regions: string[];
  resolutions: string[];
  bitrates: {
    [key: string]: number;
  };
  settings: {
    allowDirectPlay: boolean;
    enableMP4Fallback: boolean;
    keepOriginalFiles: boolean;
    playerKeyColor: string;
    fontFamily: string;
  };
}

interface Collection {
  id: string;
  name: string;
  videoCount: number;
  dateCreated: string;
}

interface Video {
  guid: string;
  title: string;
  // Add other fields as needed from Bunny.net response
}

interface BandwidthStat {
  date: string;
  bytesUsed: number;
  totalCost: number;
}

interface BunnyStatistic {
  Date: string;
  TotalRequests: number;
  TotalBytes: number;
  CacheHits: number;
  Status2xx: number;
  Status3xx: number;
  Status4xx: number;
  Status5xx: number;
}

interface BunnyStatisticsResponse {
  Statistics: BunnyStatistic[];
  From: string;
  To: string;
}

interface BunnyStatsResponse {
  BandwidthUsedChart: { [key: string]: number };
  TotalBandwidthUsed: number;
  UserBalanceHistoryChart: { [key: string]: number };
}

interface LibraryBandwidth {
  libraryName: string;
  bandwidth: {
    date: string;
    gigabytes: number;
    cost: number;
  }[];
}

interface StatisticsResponse {
  Statistics: Array<{
    Date: string;
    TotalBytes: number;
    TotalRequests: number;
    CacheHits: number;
    Status2xx: number;
    Status3xx: number;
    Status4xx: number;
    Status5xx: number;
  }>;
  From: string;
  To: string;
}

interface StatisticsChunk {
  startDate: Date;
  endDate: Date;
  data: StatisticsResponse;
}

class BunnyService {
  private baseUrl = "https://api.bunny.net";
  private videoBaseUrl = "https://video.bunnycdn.com";
  private publicApiKey: string;
  private currentLibraryKey: string | null = null;
  private apiKey: string;
  private initialized = false;
  private initializationError: string | null = null;
  private storage = dataStorage;

  constructor() {
    // Get API key from environment
    this.publicApiKey = import.meta.env.VITE_BUNNY_API_KEY || "";
    this.apiKey = this.publicApiKey;
    
    // Store API key in cache
    if (this.publicApiKey) {
      cache.set('default_api_key', this.publicApiKey);
    }
    
    // Initialize with stored API key if available
    const storedApiKey = localStorage.getItem("bunny_api_key");
    if (storedApiKey) {
      this.currentLibraryKey = storedApiKey;
    }
  }

  setLibraryApiKey(libraryId: string, apiKey: string): void {
    cache.set(`library_${libraryId}_api`, apiKey);
    if (apiKey) {
      this.currentLibraryKey = apiKey;
      localStorage.setItem("bunny_api_key", apiKey);
    }
  }

  private getApiKey(libraryId?: string, accessToken?: string): string {
    // 1. Use provided access token if available
    if (accessToken) {
      return accessToken;
    }

    // 2. For main API endpoints, use the main API key
    if (!libraryId) {
      return this.apiKey || this.publicApiKey;
    }

    // 3. For library-specific operations, try to get library key
    const libraryKey = cache.get(`library_${libraryId}_api`);
    if (libraryKey) {
      return libraryKey;
    }

    // 4. Fallback to current library key or public key
    return this.currentLibraryKey || this.apiKey || this.publicApiKey;
  }

  private async fetchWithError(
    url: string,
    options: RequestInit = {},
    libraryId?: string,
    accessToken?: string,
  ): Promise<any> {
    try {
      const apiKey = this.getApiKey(libraryId, accessToken);
      
      if (!apiKey) {
        throw new Error('No API key available');
      }

      const headers = new Headers({
        Accept: "application/json",
        "Content-Type":
          options.method === "PUT"
            ? "application/octet-stream"
            : "application/json",
        AccessKey: apiKey,
      });

      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (response.status === 401) {
        throw new Error("Unauthorized: Please check your API key");
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${errorText}`,
        );
      }

      const contentType = response.headers.get("content-type");
      return contentType?.includes("application/json")
        ? response.json()
        : response.text();
    } catch (error) {
      console.error(`Error fetching ${url}:`, error);
      throw error;
    }
  }

  async initialize(): Promise<void> {
    try {
      const savedData = dataStorage.getLibraryData();
      if (savedData) {
        // Use saved encrypted data
        this.setLibraryApiKey('default', savedData.mainApiKey);
        savedData.libraries.forEach(lib => {
          if (lib.apiKey) {
            cache.set(`library_${lib.id}_api`, lib.apiKey);
          }
        });
        return;
      }

      // Fallback to API if no saved data
      await this.initializeFromAPI();
    } catch (error) {
      console.error('Error initializing:', error);
      throw error;
    }
  }

  async initializeFromAPI() {
    // Add implementation
    try {
      // Add your initialization logic here
      return true;
    } catch (error) {
      console.error('Failed to initialize from API:', error);
      throw error;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      if (this.initializationError) {
        throw new Error(
          `Service not properly initialized: ${this.initializationError}`,
        );
      }
      await this.initialize();
    }
  }

  async getLibraries(): Promise<Library[]> {
    try {
      let allLibraries: Library[] = [];
      let currentPage = 1;
      let hasMorePages = true;

      while (hasMorePages) {
        const response = await this.fetchWithError(
          `${this.baseUrl}/videolibrary?page=${currentPage}&perPage=100`,
          { method: "GET" },
        );

        const libraries = (response.Items || []).map(
          (lib: any): Library => ({
            id: lib.Id?.toString() || "",
            name: lib.Name || "Unnamed Library",
            videoCount: lib.VideoCount || 0,
            storageUsage: lib.StorageUsage || 0,
            trafficUsage: lib.TrafficUsage || 0,
            dateCreated: lib.DateCreated || "",
            apiKey: lib.ApiKey || "",
            regions: lib.ReplicationRegions || [],
            resolutions: (lib.EnabledResolutions || "")
              .split(",")
              .filter(Boolean),
            bitrates: {
              "240p": lib.Bitrate240p || 0,
              "360p": lib.Bitrate360p || 0,
              "480p": lib.Bitrate480p || 0,
              "720p": lib.Bitrate720p || 0,
              "1080p": lib.Bitrate1080p || 0,
              "1440p": lib.Bitrate1440p || 0,
              "2160p": lib.Bitrate2160p || 0,
            },
            settings: {
              allowDirectPlay: lib.AllowDirectPlay || false,
              enableMP4Fallback: lib.EnableMP4Fallback || false,
              keepOriginalFiles: lib.KeepOriginalFiles || false,
              playerKeyColor: lib.PlayerKeyColor || "#ffffff",
              fontFamily: lib.FontFamily || "",
            },
          }),
        );

        allLibraries = [...allLibraries, ...libraries];
        
        // Check if we have more pages
        if (!response.Items || response.Items.length < 100) {
          hasMorePages = false;
        } else {
          currentPage++;
        }
      }

      return allLibraries;
    } catch (error) {
      console.error("Error fetching libraries:", error);
      throw error;
    }
  }

  async getCollections(libraryId: string): Promise<Collection[]> {
    if (!libraryId) {
      console.warn("No library ID provided to getCollections");
      return [];
    }

    try {
      const apiKey = cache.get(`library_${libraryId}_api`);
      if (!apiKey) {
        console.error(`No API key found for library ${libraryId}`);
        return [];
      }

      const response = await this.fetchWithError(
        `${this.videoBaseUrl}/library/${libraryId}/collections?page=1&itemsPerPage=100&orderBy=date`,
        { method: "GET" },
        libraryId,
      );

      const items = Array.isArray(response) ? response : response?.items || [];

      return items.map(
        (col: any): Collection => ({
          id: String(col.guid || col.Guid || ""),
          name: col.name || col.Name || "",
          videoCount: parseInt(col.videoCount || col.VideoCount || "0", 10),
          dateCreated: col.dateCreated || col.DateCreated || "",
        }),
      );
    } catch (error) {
      console.error(`Error fetching collections: ${error}`);
      return [];
    }
  }

  async getVideos(
    libraryId: string,
    collectionId?: string,
    accessToken?: string,
  ): Promise<Video[]> {
    try {
      const url = `${this.videoBaseUrl}/library/${libraryId}/videos?page=1&itemsPerPage=100${collectionId ? `&collection=${collectionId}` : ""}`;
      const response = await this.fetchWithError(
        url,
        { method: "GET" },
        libraryId,
        accessToken,
      );

      const videos = (response.items || []).map(
        (video: any): Video => ({
          guid: video.guid || "",
          title: video.title || "",
        }),
      );

      // Sort videos alphabetically with natural sorting for "Q" numbers, matching Python backend
      return videos.sort((a: Video, b: Video) => {
        const baseNameA = a.title.split("Q")[0];
        const baseNameB = b.title.split("Q")[0];

        if (baseNameA !== baseNameB) {
          return baseNameA.localeCompare(baseNameB);
        }

        const numA = parseInt(a.title.match(/Q(\d+)/)?.[1] || "0");
        const numB = parseInt(b.title.match(/Q(\d+)/)?.[1] || "0");
        return numA - numB;
      });
    } catch (error) {
      console.error("Error fetching videos:", error);
      throw error;
    }
  }

  async getVideoEmbedCode(
    libraryId: string,
    videoGuid: string,
  ): Promise<string> {
    // Generate embed code in the exact format from the Python backend, with autoplay=false
    return `
<div style="position:relative;padding-top:56.25%;"><iframe src="https://iframe.mediadelivery.net/embed/${libraryId}/${videoGuid}?autoplay=false&loop=false&muted=false&preload=true&responsive=true" loading="lazy" style="border:0;position:absolute;top:0;height:100%;width:100%;" allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;" allowfullscreen="true"></iframe></div>
    `.trim();
  }

  // Add method to create collection
  async createCollection(
    libraryId: string,
    collectionName: string,
    accessToken?: string
  ) {
    const response = await this.fetchWithError(
      `${this.videoBaseUrl}/library/${libraryId}/collections`,
      {
        method: "POST",
        body: JSON.stringify({
          name: collectionName
        }),
      },
      libraryId,
      accessToken
    );

    return response;
  }

  async uploadVideo(
    file: File,
    libraryId: string,
    onProgress?: (progress: number, bytesLoaded: number) => void,
    collectionId?: string,
    accessToken?: string, // Add accessToken parameter
    signal?: AbortSignal, // Add abort signal support
    customFilename?: string // Add parameter for custom filename
  ): Promise<{ guid: string; title: string }> {
    try {
      if (!libraryId) throw new Error("Library ID is required for upload");

      // Use custom filename if provided, otherwise use original filename
      const videoTitle = customFilename || file.name;

      // Create video entry with collection ID
      const createResponse = await this.fetchWithError(
        `${this.videoBaseUrl}/library/${libraryId}/videos`,
        {
          method: "POST",
          body: JSON.stringify({
            title: videoTitle,
            collectionId: collectionId // Add collection ID here
          }),
        },
        libraryId,
        accessToken
      );

      if (!createResponse?.guid) {
        throw new Error("Failed to create video entry");
      }

      // Upload the actual file with progress tracking
      const xhr = new XMLHttpRequest();
      
      await new Promise<void>((resolve, reject) => {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && onProgress) {
            const progress = Math.round((event.loaded / event.total) * 100);
            onProgress(progress, event.loaded);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error("Upload failed"));

        xhr.open(
          "PUT",
          `${this.videoBaseUrl}/library/${libraryId}/videos/${createResponse.guid}`,
          true
        );
        
        if (accessToken) {
          xhr.setRequestHeader("AccessKey", accessToken);
        }

        xhr.send(file);
      });

      return createResponse;
    } catch (error) {
      console.error("Error uploading video:", error);
      throw error;
    }
  }

  private createUploadStream(
    file: File,
    onProgress: (loaded: number, total: number) => void
  ): ReadableStream {
    const reader = file.stream().getReader();
    let loaded = 0;

    return new ReadableStream({
      async pull(controller) {
        const {done, value} = await reader.read();
        
        if (done) {
          controller.close();
          return;
        }
        
        loaded += value.length;
        onProgress(loaded, file.size);
        controller.enqueue(value);
      },
      cancel() {
        reader.cancel();
      }
    });
  }

  // Optional: Add method to fetch embed codes via backend, matching /get-bunny-embed-codes
  async getBunnyEmbedCodes(
    libraryId: string,
    accessToken: string,
    collectionId: string,
  ): Promise<any> {
    try {
      const response = await fetch("/get-bunny-embed-codes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bunny_library_id: libraryId.trim(),
          bunny_access_token: accessToken.trim(),
          bunny_collection_id: collectionId.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `API error: ${response.status}`);
      }

      const result = await response.json();
      if (!result.videos || result.videos.length === 0) {
        throw new Error("No videos found in collection");
      }

      return result.videos
        .map((video: any) => ({
          guid: video.name.split(".")[0], // Assuming guid is part of the name or needs extraction
          title: video.name,
          embedCode: video.embed_code.player_code || video.embed_code, // Handle both string and object formats
        }))
        .sort((a: any, b: any) => {
          const baseNameA = a.title.split("Q")[0];
          const baseNameB = b.title.split("Q")[0];

          if (baseNameA !== baseNameB) {
            return baseNameA.localeCompare(baseNameB);
          }

          const numA = parseInt(a.title.match(/Q(\d+)/)?.[1] || "0");
          const numB = parseInt(b.title.match(/Q(\d+)/)?.[1] || "0");
          return numA - numB;
        });
    } catch (error) {
      console.error("Error getting embed codes:", error);
      throw error;
    }
  }

  async fetchAllLibraryData(mainApiKey: string): Promise<LibraryData> {
    try {
      // Update instance API key
      this.apiKey = mainApiKey;
      
      // Also update in cache
      cache.set('default_api_key', mainApiKey);
      
      // Rest of the method remains the same
      // ...existing code...
      if (!mainApiKey) {
        // Try to get from environment if not provided
        mainApiKey = import.meta.env.VITE_BUNNY_API_KEY;
        if (!mainApiKey) {
          throw new Error("Main API key is required");
        }
      }

      // Update instance and cache with new API key
      this.publicApiKey = mainApiKey;
      this.apiKey = mainApiKey;
      cache.set('default_api_key', mainApiKey);

      // 5. Fetch libraries with the main API key
      const libraries = await this.getLibraries();
      
      // 6. Cache each library's API key
      libraries.forEach(lib => {
        if (lib.apiKey) {
          cache.set(`library_${lib.id}_api`, lib.apiKey);
        }
      });

      // 7. Fetch collections using library-specific keys
      const libraryInfos = await Promise.all(
        libraries.map(async (lib) => {
          const collections = await this.getCollections(lib.id);
          return {
            id: lib.id,
            name: lib.name,
            apiKey: lib.apiKey,
            collections: collections.map(col => ({
              id: col.id,
              name: col.name
            }))
          };
        })
      );

      const data: LibraryData = {
        lastUpdated: new Date().toISOString(),
        libraries: libraryInfos,
        mainApiKey
      };

      // 8. Save to persistent storage
      await dataStorage.saveLibraryData(data);

      showToast({
        title: "🔄 Library Update Complete",
        description: `Updated ${libraryInfos.length} libraries\nTotal collections: ${
          libraryInfos.reduce((acc, lib) => acc + lib.collections.length, 0)
        }`,
        variant: "success",
        duration: 5000
      });

      return data;

    } catch (error) {
      showToast({
        title: "❌ Library Update Failed", 
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
        duration: 5000
      });
      throw error;
    }
  }

  private async getStatisticsForDateRange(
    libraryId: string,
    startDate: Date,
    endDate: Date
  ): Promise<StatisticsResponse> {
    return this.fetchWithError(
      `${this.baseUrl}/statistics?` + new URLSearchParams({
        dateFrom: startDate.toISOString(),
        dateTo: endDate.toISOString(),
        pullZone: libraryId,
        serverZoneId: "-1",
        loadErrors: "false",
        hourly: "false"
      }),
      { method: "GET" }
    );
  }

  async getBandwidthStats(): Promise<void> {
    try {
      // Calculate date ranges in 30-day chunks for last 6 months
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 6);
      
      const libraries = await this.getLibraries();
      const libraryData: { [key: string]: StatisticsResponse[] } = {};

      // For each library
      for (const library of libraries) {
        libraryData[library.name] = [];
        let currentEnd = new Date(endDate);
        let currentStart = new Date(currentEnd);
        currentStart.setDate(currentStart.getDate() - 30); // 30-day chunks

        // Get data in 30-day chunks
        while (currentStart >= startDate) {
          try {
            const response = await this.getStatisticsForDateRange(
              library.id,
              currentStart,
              currentEnd
            );
            
            if (response?.Statistics) {
              libraryData[library.name].push(response);
            }

            // Move to next chunk
            currentEnd = new Date(currentStart);
            currentStart.setDate(currentStart.getDate() - 30);
          } catch (error) {
            console.warn(`Failed to fetch chunk for ${library.name}:`, error);
            break; // Move to next library if chunk fails
          }
        }
      }

      // Get unique months from all data
      const months = new Set<string>();
      Object.values(libraryData).forEach(chunks => {
        chunks.forEach(chunk => {
          chunk.Statistics.forEach(stat => {
            const month = stat.Date.substring(0, 7);
            months.add(month);
          });
        });
      });

      // Sort months in reverse chronological order
      const sortedMonths = Array.from(months).sort().reverse();

      // Create Excel data
      const excelData = [['Library Name', ...sortedMonths]];

      // Add library rows
      Object.entries(libraryData).forEach(([libraryName, chunks]) => {
        const row = [libraryName];
        sortedMonths.forEach(month => {
          // Sum bandwidth across all chunks for this month
          const monthlyBandwidth = chunks
            .flatMap(chunk => chunk.Statistics)
            .filter(stat => stat.Date.startsWith(month))
            .reduce((sum, stat) => sum + (stat.TotalBytes / (1024 * 1024 * 1024)), 0);
          
          row.push(monthlyBandwidth.toFixed(2));
        });
        excelData.push(row);
      });

      // Add total row
      const totalRow = ['Total'];
      sortedMonths.forEach((_, columnIndex) => {
        const total = excelData
          .slice(1)
          .reduce((sum, row) => sum + Number(row[columnIndex + 1]), 0);
        totalRow.push(total.toFixed(2));
      });
      excelData.push(totalRow);

      // Create Excel workbook with same styling
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(excelData);

      // Add column widths
      ws['!cols'] = [
        { wch: 30 },
        ...sortedMonths.map(() => ({ wch: 12 }))
      ];

      // Style header and total rows
      const headerRange = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let C = headerRange.s.c; C <= headerRange.e.c; ++C) {
        // Bold header row
        const headerAddress = XLSX.utils.encode_cell({ r: 0, c: C });
        if (!ws[headerAddress]) ws[headerAddress] = {};
        ws[headerAddress].s = { font: { bold: true } };

        // Bold total row
        const totalRowIndex = excelData.length - 1;
        const totalAddress = XLSX.utils.encode_cell({ r: totalRowIndex, c: C });
        if (!ws[totalAddress]) ws[totalAddress] = {};
        ws[totalAddress].s = { font: { bold: true } };
      }

      XLSX.utils.book_append_sheet(wb, ws, "Bandwidth Usage");

      // Save file
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const fileName = `bandwidth_stats_${new Date().toISOString().split('T')[0]}.xlsx`;
      const blob = new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      saveAs(blob, fileName);

    } catch (error) {
      console.error("Error downloading bandwidth stats:", error);
      throw error instanceof Error 
        ? error 
        : new Error("Failed to download bandwidth statistics");
    }
  }
}

export const bunnyService = new BunnyService();
