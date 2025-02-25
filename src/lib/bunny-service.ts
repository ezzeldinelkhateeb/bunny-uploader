import { cache } from "./cache";
import { dataStorage } from "./data-storage";

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
    this.publicApiKey = import.meta.env.VITE_BUNNY_API_KEY || "";
    this.apiKey = this.publicApiKey;

    if (!this.publicApiKey) {
      console.warn("No Bunny API key found in configuration");
    }

    // Initialize with stored API key if available
    const storedApiKey = localStorage.getItem("bunny_api_key");
    if (storedApiKey) {
      this.apiKey = storedApiKey;
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
    // Prioritize accessToken (explicitly passed) over cached library key or public key
    if (accessToken) return accessToken;
    if (libraryId) {
      const libraryKey = cache.get(`library_${libraryId}_api`);
      return libraryKey || this.publicApiKey;
    }
    return this.publicApiKey;
  }

  private async fetchWithError(
    url: string,
    options: RequestInit = {},
    libraryId?: string,
    accessToken?: string,
  ): Promise<any> {
    try {
      const headers = new Headers({
        Accept: "application/json",
        "Content-Type":
          options.method === "PUT"
            ? "application/octet-stream"
            : "application/json",
        AccessKey: this.getApiKey(libraryId, accessToken), // Use accessToken if provided
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
      const libraries = await this.getLibraries();
      this.storage.setLibraries(libraries);
      libraries.forEach((lib) => {
        if (lib.apiKey) {
          cache.set(`library_${lib.id}_api`, lib.apiKey);
        }
      });
      this.initialized = true;
    } catch (error) {
      this.initializationError =
        error instanceof Error ? error.message : "Unknown error";
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
      const response = await this.fetchWithError(
        `${this.baseUrl}/videolibrary?page=1&perPage=100`,
        { method: "GET" },
      );

      return (response.Items || []).map(
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

  async uploadVideo(
    file: File,
    libraryId: string,
    onProgress?: (progress: number) => void,
    collectionId?: string,
    accessToken?: string, // Add accessToken parameter
  ): Promise<{ guid: string; title: string }> {
    try {
      if (!libraryId) throw new Error("Library ID is required for upload");

      const createResponse = await this.fetchWithError(
        `${this.videoBaseUrl}/library/${libraryId}/videos`,
        {
          method: "POST",
          body: JSON.stringify({
            title: file.name,
            collectionId: collectionId,
          }),
        },
        libraryId,
        accessToken,
      );

      if (!createResponse?.guid)
        throw new Error("Failed to create video entry");

      await this.fetchWithError(
        `${this.videoBaseUrl}/library/${libraryId}/videos/${createResponse.guid}`,
        {
          method: "PUT",
          body: file,
        },
        libraryId,
        accessToken,
      );

      return createResponse;
    } catch (error) {
      console.error("Error uploading video:", error);
      throw error;
    }
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
}

export const bunnyService = new BunnyService();
