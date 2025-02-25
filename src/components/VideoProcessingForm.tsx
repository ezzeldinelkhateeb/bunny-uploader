import React from "react";
import { Card } from "./ui/card";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Search, Copy } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "./ui/use-toast";
import { bunnyService } from "../lib/bunny-service";
import { UploadManager } from "../lib/upload-manager"; // Ensure this path is correct
import { cache } from "../lib/cache"; // Ensure this path is correct

interface Library {
  id: string;
  name: string;
}

interface Collection {
  id: string;
  name: string;
}

interface UploadGroup {
  library: string;
  collection: string;
  items: {
    id: string;
    file: File;
    filename: string;
    status: "pending" | "processing" | "completed" | "error";
    progress: number;
    errorMessage?: string;
    metadata: {
      library: string;
      collection: string;
      year: string;
    };
  }[];
}

interface VideoProcessingFormProps {
  libraries?: Library[];
  collections?: Collection[];
  selectedLibrary?: string;
  selectedCollection?: string;
  selectedYear?: "2024" | "2025";
  onLibraryChange?: (value: string) => void;
  onCollectionChange?: (value: string) => void;
  onYearChange?: (value: "2024" | "2025") => void;
  disabled?: boolean;
}

const VideoProcessingForm = ({
  libraries = [],
  collections = [],
  selectedLibrary = "",
  selectedCollection = "",
  selectedYear = "2024",
  onLibraryChange = () => {},
  onCollectionChange = () => {},
  onYearChange = () => {},
}: VideoProcessingFormProps) => {
  const [librarySearch, setLibrarySearch] = React.useState("");
  const [collectionSearch, setCollectionSearch] = React.useState("");
  const [videos, setVideos] = React.useState<any[]>([]);
  const [sortedVideos, setSortedVideos] = React.useState<any[]>([]);
  const [selectedVideos, setSelectedVideos] = React.useState<Set<string>>(
    new Set(),
  );
  const [selectAll, setSelectAll] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<{
    groups: UploadGroup[];
  }>({ groups: [] });
  const uploadManagerRef = React.useRef<UploadManager | null>(null);

  React.useEffect(() => {
    if (!uploadManagerRef.current) {
      uploadManagerRef.current = new UploadManager((groups) =>
        setUploadProgress({ groups }),
      );
    }
  }, []);

  const filteredLibraries = React.useMemo(() => {
    return libraries.filter((lib) =>
      lib.name.toLowerCase().includes(librarySearch.toLowerCase()),
    );
  }, [libraries, librarySearch]);

  const filteredCollections = React.useMemo(() => {
    return collections.filter((col) =>
      col.name.toLowerCase().includes(collectionSearch.toLowerCase()),
    );
  }, [collections, collectionSearch]);

  const fetchVideos = React.useCallback(async () => {
    if (!selectedLibrary || !selectedCollection) return;
    try {
      const accessToken = cache.get(`library_${selectedLibrary}_api`) || "";
      const fetchedVideos = await bunnyService.getVideos(
        selectedLibrary,
        selectedCollection,
        accessToken,
      );
      setVideos(fetchedVideos);
      setSortedVideos(fetchedVideos); // Already sorted in bunnyService
    } catch (error) {
      console.error("Error fetching videos:", error);
      toast({
        title: "Error",
        description: "Failed to fetch videos. Please try again.",
        variant: "destructive",
      });
    }
  }, [selectedLibrary, selectedCollection]);

  React.useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const [copiedStates, setCopiedStates] = React.useState<{
    [key: string]: boolean;
  }>({});

  const getEmbedCode = async (videoGuid: string, videoTitle: string) => {
    if (!selectedLibrary) return;
    try {
      const embedCode = await bunnyService.getVideoEmbedCode(
        selectedLibrary,
        videoGuid,
      );
      await navigator.clipboard.writeText(embedCode);

      setCopiedStates((prev) => ({ ...prev, [videoGuid]: true }));
      setTimeout(() => {
        setCopiedStates((prev) => ({ ...prev, [videoGuid]: false }));
      }, 2000);

      toast({
        title: "✨ تم النسخ!",
        description: `تم نسخ كود الفيديو: ${videoTitle}`,
        className: "bg-green-50 border-green-200",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to get embed code. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Add file upload handler
  const handleFileUpload = (files: FileList) => {
    if (uploadManagerRef.current) {
      uploadManagerRef.current.addFiles(Array.from(files), selectedYear);
    } else {
      console.error("UploadManager not initialized");
      toast({
        title: "Error",
        description: "Upload manager not initialized. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="w-full p-6 bg-white space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="library">Library</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="library-search"
              placeholder="Search libraries..."
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <ScrollArea className="h-[200px] w-full rounded-md border">
            <div className="p-4 space-y-2">
              {filteredLibraries.length > 0 ? (
                filteredLibraries.map((library) => (
                  <div
                    key={library.id}
                    className={`p-2 rounded-lg cursor-pointer transition-colors ${selectedLibrary === library.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    onClick={() => onLibraryChange(library.id)}
                  >
                    {library.name || "Unnamed Library"}
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground text-sm">
                  No libraries found
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="space-y-2">
          <Label htmlFor="collection">Collection</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="collection-search"
              placeholder="Search collections..."
              value={collectionSearch}
              onChange={(e) => setCollectionSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <ScrollArea className="h-[200px] w-full rounded-md border">
            <div className="p-4 space-y-2">
              {filteredCollections.length > 0 ? (
                filteredCollections.map((collection) => (
                  <div
                    key={collection.id}
                    className={`p-2 rounded-lg cursor-pointer transition-colors ${selectedCollection === collection.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    onClick={() => onCollectionChange(collection.id)}
                  >
                    {collection.name || "Unnamed Collection"}
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground text-sm">
                  No collections found
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Year</Label>
        <RadioGroup
          value={selectedYear}
          onValueChange={onYearChange}
          className="flex space-x-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="2024" id="year-2024" />
            <Label htmlFor="year-2024">2024</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="2025" id="year-2025" />
            <Label htmlFor="year-2025">2025</Label>
          </div>
        </RadioGroup>
      </div>

      {/* File Upload Zone */}
      <div className="space-y-2 mt-4">
        <Label>File Upload</Label>
        <div
          className="border-2 border-dashed border-gray-300 p-4 rounded-lg text-center cursor-pointer hover:border-primary"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFileUpload(e.dataTransfer.files);
          }}
          onClick={() => document.getElementById("fileInput")?.click()}
        >
          <p>Drag and drop videos here or click to select</p>
          <input
            id="fileInput"
            type="file"
            multiple
            accept=".mp4,.avi"
            onChange={(e) => handleFileUpload(e.target.files || new FileList())}
            className="hidden"
          />
        </div>
      </div>

      {/* Upload Progress */}
      {uploadProgress.groups.length > 0 && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold">Upload Progress</h3>
          <ScrollArea className="h-[200px] w-full rounded-md border">
            <div className="p-4 space-y-2">
              {uploadProgress.groups.map((group) => (
                <div
                  key={`${group.library}-${group.collection}`}
                  className="text-sm"
                >
                  {group.library} → {group.collection}: {group.items.length}{" "}
                  videos (
                  {group.items.filter((i) => i.status === "completed").length}{" "}
                  completed,
                  {
                    group.items.filter((i) => i.status === "processing").length
                  }{" "}
                  processing,
                  {group.items.filter((i) => i.status === "error").length}{" "}
                  errors)
                  {group.items
                    .filter((i) => i.status === "error")
                    .map((item) => (
                      <div key={item.id} className="text-red-500 text-xs">
                        - {item.filename}: {item.errorMessage}
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {selectedLibrary && selectedCollection && videos.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Videos in Collection</h3>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="select-all"
                checked={selectAll}
                onChange={(e) => {
                  setSelectAll(e.target.checked);
                  if (e.target.checked) {
                    setSelectedVideos(new Set(videos.map((v) => v.guid)));
                  } else {
                    setSelectedVideos(new Set());
                  }
                }}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="select-all">Select All</Label>
            </div>
          </div>

          <ScrollArea className="h-[400px] w-full rounded-md border bg-white">
            <div className="space-y-2 p-4">
              {sortedVideos.map((video) => (
                <div
                  key={video.guid}
                  className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 gap-3 group transition-all duration-200"
                >
                  <input
                    type="checkbox"
                    checked={selectedVideos.has(video.guid)}
                    onChange={(e) => {
                      const newSelected = new Set(selectedVideos);
                      if (e.target.checked) {
                        newSelected.add(video.guid);
                      } else {
                        newSelected.delete(video.guid);
                      }
                      setSelectedVideos(newSelected);
                      setSelectAll(newSelected.size === videos.length);
                    }}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {video.title}
                    </span>
                    <span className="block truncate text-xs text-gray-500">
                      {new Date(video.dateUploaded).toLocaleDateString()}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => getEmbedCode(video.guid, video.title)}
                    className="ml-2 relative"
                  >
                    {copiedStates[video.guid] ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-green-500 text-white rounded-md animate-fade-in">
                        ✓
                      </div>
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>

          {selectedVideos.size > 0 && (
            <div className="mt-4 flex justify-end">
              <Button
                onClick={async () => {
                  try {
                    const selectedVideosList = [...sortedVideos].filter((v) =>
                      selectedVideos.has(v.guid),
                    );

                    const embedCodes = await Promise.all(
                      selectedVideosList.map(async (video) => {
                        const embedCode = await bunnyService.getVideoEmbedCode(
                          selectedLibrary,
                          video.guid,
                        );
                        return embedCode;
                      }),
                    );

                    const formattedCodes = embedCodes.join("\n");

                    await navigator.clipboard.writeText(formattedCodes);

                    // Show success animation for all selected videos
                    const newCopiedStates = {};
                    selectedVideosList.forEach((video) => {
                      newCopiedStates[video.guid] = true;
                    });
                    setCopiedStates(newCopiedStates);
                    setTimeout(() => {
                      setCopiedStates({});
                    }, 2000);

                    toast({
                      title: "🎉 تم النسخ!",
                      description: `تم نسخ ${selectedVideos.size} كود للفيديوهات المحددة`,
                      className: "bg-green-50 border-green-200",
                    });
                  } catch (error) {
                    toast({
                      title: "Error",
                      description: "Failed to get embed codes",
                      variant: "destructive",
                    });
                  }
                }}
              >
                Copy Selected ({selectedVideos.size})
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

export default VideoProcessingForm;
