import React from "react";
import { Card } from "./ui/card";
import UploadZone from "./UploadZone";
import VideoProcessingForm from "./VideoProcessingForm";
import ProcessingQueue from "./ProcessingQueue";
import { bunnyService } from "../lib/bunny-service";
import { UploadManager } from "../lib/upload-manager";
import {
  parseFilename,
  determineLibrary,
  determineCollection,
} from "../lib/filename-parser";

interface Library {
  id: string;
  name: string;
}

interface Collection {
  id: string;
  name: string;
}

const Home = () => {
  const [isUploading, setIsUploading] = React.useState(false);
  const [libraries, setLibraries] = React.useState<Library[]>([]);
  const [collections, setCollections] = React.useState<Collection[]>([]);
  const [selectedLibrary, setSelectedLibrary] = React.useState("");
  const [selectedCollection, setSelectedCollection] = React.useState("");
  const [selectedYear, setSelectedYear] = React.useState<"2024" | "2025">(
    "2024",
  );
  const [queueItems, setQueueItems] = React.useState([]);

  // Initialize bunny service and fetch libraries on mount
  React.useEffect(() => {
    const storedApiKey = localStorage.getItem("bunny_api_key");
    if (!storedApiKey) {
      const apiKey = prompt("Please enter your Bunny.net API key:");
      if (apiKey) {
        localStorage.setItem("bunny_api_key", apiKey);
        bunnyService.setLibraryApiKey("default", apiKey);
      }
    }

    const initializeAndFetchLibraries = async () => {
      try {
        await bunnyService.initialize();
        const libs = await bunnyService.getLibraries();
        const transformedLibs = libs.map((lib) => ({
          id: lib.id || "",
          name: lib.name || "Unnamed Library",
        }));
        setLibraries(transformedLibs);
      } catch (error) {
        console.error("Error fetching libraries:", error);
      }
    };
    initializeAndFetchLibraries();
  }, []);

  // Fetch collections when library changes
  React.useEffect(() => {
    const fetchCollections = async () => {
      if (!selectedLibrary) return;
      try {
        const cols = await bunnyService.getCollections(selectedLibrary);
        const transformedCols = cols.map((col) => ({
          id: col.id || "",
          name: col.name || "Unnamed Collection",
        }));
        setCollections(transformedCols);
      } catch (error) {
        console.error("Error fetching collections:", error);
        setCollections([]);
      }
    };
    fetchCollections();
  }, [selectedLibrary]);

  const handleFilesSelected = async (files: FileList) => {
    setIsUploading(true);
    try {
      // Process each file and determine its library/collection
      const errors: string[] = [];
      const processedFiles = Array.from(files).map((file) => {
        // Always use selected library and collection if available
        if (selectedLibrary && selectedCollection) {
          const library = libraries.find((l) => l.id === selectedLibrary);
          const collection = collections.find(
            (c) => c.id === selectedCollection,
          );

          return {
            file,
            libraryId: selectedLibrary,
            collectionId: selectedCollection,
            metadata: {
              library: library?.name || "Unknown Library",
              collection: collection?.name || "Unknown Collection",
              year: selectedYear,
            },
          };
        }

        // Otherwise try to parse the filename
        const { parsed, error } = parseFilename(file.name);
        if (!parsed) {
          errors.push(`${file.name}: ${error}`);
          return null;
        }

        const libraryName = determineLibrary(parsed);
        const collectionName = determineCollection(parsed, selectedYear);

        // Find matching library and collection IDs
        const library = libraries.find((l) => l.name === libraryName);

        if (!library) {
          throw new Error(`Library not found: ${libraryName}`);
        }

        return {
          file,
          libraryId: library.id,
          metadata: {
            library: libraryName,
            collection: collectionName,
            year: selectedYear,
          },
        };
      });

      // Filter out failed files and group successful ones
      const validFiles = processedFiles.filter(
        (item): item is NonNullable<typeof item> => item !== null,
      );

      if (errors.length > 0) {
        setQueueItems((prev) => [
          ...prev,
          ...errors.map((error) => ({
            id: `error-${Date.now()}-${Math.random()}`,
            filename: "Multiple files",
            status: "error" as const,
            progress: 0,
            errorMessage: error,
            metadata: { library: "N/A", collection: "N/A", year: selectedYear },
          })),
        ]);
      }

      // Group files by library/collection
      const groups = new Map<string, typeof validFiles>();
      validFiles.forEach((item) => {
        const key = `${item.metadata.library}|${item.metadata.collection}`;
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)?.push(item);
      });

      // Process each group
      for (const [groupKey, files] of groups) {
        const [libraryName, collectionName] = groupKey.split("|");

        for (const { file, libraryId, metadata } of files) {
          const queueId = `${Date.now()}-${Math.random().toString(36).substring(2)}`;

          // Add to queue as pending
          setQueueItems((prev) => [
            ...prev,
            {
              id: queueId,
              filename: file.name,
              status: "pending",
              progress: 0,
              metadata,
            },
          ]);

          try {
            await bunnyService.uploadVideo(
              file,
              libraryId,
              (progress) => {
                setQueueItems((prev) =>
                  prev.map((item) =>
                    item.id === queueId
                      ? { ...item, status: "processing", progress }
                      : item,
                  ),
                );
              },
              selectedCollection, // Pass the selected collection ID
            );

            setQueueItems((prev) =>
              prev.map((item) =>
                item.id === queueId
                  ? { ...item, status: "completed", progress: 100 }
                  : item,
              ),
            );
          } catch (error) {
            setQueueItems((prev) =>
              prev.map((item) =>
                item.id === queueId
                  ? {
                      ...item,
                      status: "error",
                      progress: 0,
                      errorMessage:
                        error instanceof Error
                          ? error.message
                          : "Upload failed",
                    }
                  : item,
              ),
            );
          }
        }
      }
    } catch (error) {
      console.error("Error processing files:", error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Video Processing System
          </h1>
          <p className="mt-2 text-gray-600">
            Upload and process educational videos for your library collections
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Upload Videos</h2>
            <UploadZone
              onFilesSelected={handleFilesSelected}
              isUploading={isUploading}
              acceptedFileTypes={[".mp4", ".mov", ".avi"]}
              maxFileSize={1024 * 1024 * 1000}
            />
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Processing Settings</h2>
            <VideoProcessingForm
              libraries={libraries}
              collections={collections}
              selectedLibrary={selectedLibrary}
              selectedCollection={selectedCollection}
              selectedYear={selectedYear}
              onLibraryChange={setSelectedLibrary}
              onCollectionChange={setSelectedCollection}
              onYearChange={setSelectedYear}
            />
          </Card>

          <ProcessingQueue items={queueItems} />
        </div>
      </div>
    </div>
  );
};

export default Home;
