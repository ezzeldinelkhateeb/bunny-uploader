import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Card } from "./ui/card";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Search, Copy, Save, Loader2, CheckCircle2, Download } from "lucide-react";
import { Button } from "./ui/button";
import { useToast } from "./ui/use-toast";
import { bunnyService } from "../lib/bunny-service";
import { UploadManager } from "../lib/upload-manager";
import { cache } from "../lib/cache";
import { cn } from "@/lib/utils";
import { dataStorage } from "@/lib/data-storage";
import ProcessingQueue from "./ProcessingQueue";
import UploadZone from "./UploadZone";
import LibrarySelector from "./LibrarySelector";
import CollectionSelector from "./CollectionSelector";
import YearSelector from "./YearSelector";
import ManualUploadZone from "./ManualUploadZone";
import { googleSheetsService } from "../lib/google-sheets-service";

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
  selectedYear = "2025",
  onLibraryChange = () => {},
  onCollectionChange = () => {},
  onYearChange = () => {},
  disabled = false
}: VideoProcessingFormProps) => {
  const { toast } = useToast();
  const [librarySearch, setLibrarySearch] = useState("");
  const [collectionSearch, setCollectionSearch] = useState("");
  const [videos, setVideos] = useState<any[]>([]);
  const [sortedVideos, setSortedVideos] = useState<any[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [uploadGroups, setUploadGroups] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Add this line
  const [autoUploadFiles, setAutoUploadFiles] = useState<File[]>([]);
  const [isAutoUploading, setIsAutoUploading] = useState(false);
  const uploadManagerRef = useRef<UploadManager | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUpdatingSheet, setIsUpdatingSheet] = useState(false);
  const [lastCheckedIndex, setLastCheckedIndex] = useState<number | null>(null);
  const [isGloballyPaused, setIsGloballyPaused] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const updateSheetForVideo = async (videoTitle: string, videoGuid: string, libraryId: string) => {
    try {
      const embedCode = await bunnyService.getVideoEmbedCode(libraryId, videoGuid);
      const videoData = [{
        name: videoTitle,
        embed_code: embedCode
      }];

      await googleSheetsService.updateEmbedsInSheet(videoData);
      
      toast({
        title: "✅ Sheet Updated",
        description: `Successfully updated video link for ${videoTitle}`,
        duration: 3000
      });
    } catch (error) {
      console.error('Error updating sheet for video:', videoTitle, error);
      toast({
        title: "⚠️ Warning",
        description: `Failed to update sheet for video ${videoTitle}`,
        variant: "warning",
        duration: 3000
      });
    }
  };

  useEffect(() => {
    uploadManagerRef.current = new UploadManager(
      (groups) => setUploadGroups(groups),
      (videoTitle: string, videoGuid: string, libraryId: string) => {
        setTimeout(() => {
          updateSheetForVideo(videoTitle, videoGuid, libraryId);
        }, 0);
      }
    );
  }, []);

  const filteredLibraries = useMemo(() => {
    return libraries.filter((lib) =>
      lib.name.toLowerCase().includes(librarySearch.toLowerCase()),
    );
  }, [libraries, librarySearch]);

  const filteredCollections = useMemo(() => {
    return collections.filter((col) =>
      col.name.toLowerCase().includes(collectionSearch.toLowerCase()),
    );
  }, [collections, collectionSearch]);

  const fetchVideos = useCallback(async () => {
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

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const [copiedStates, setCopiedStates] = useState<{
    [key: string]: boolean;
  }>({});

  const copyToClipboard = async (text: string): Promise<void> => {
    if (!navigator.clipboard) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
      }
      document.body.removeChild(textArea);
      return;
    }
    
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      throw err;
    }
  };

  // Update getEmbedCode function
  const getEmbedCode = async (videoGuid: string, videoTitle: string) => {
    if (!selectedLibrary) {
      toast({
        title: "Error",
        description: "Please select a library first",
        variant: "destructive",
      });
      return;
    }
  
    try {
      const embedCode = await bunnyService.getVideoEmbedCode(
        selectedLibrary,
        videoGuid,
      );
  
      if (!embedCode) {
        throw new Error("Embed code not found");
      }
  
      await copyToClipboard(embedCode);
  
      setCopiedStates(prev => ({ ...prev, [videoGuid]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [videoGuid]: false }));
      }, 2000);
  
      toast({
        title: "✨ Copied!",
        description: `Video code copied for ${videoTitle}`,
        className: "bg-green-50 border-green-200",
      });
    } catch (error) {
      console.error('Error getting embed code:', error);
      toast({
        title: "Error",
        description: "Failed to get video embed code",
        variant: "destructive",
      });
    }
  };

  // Add file upload handler
  const handleFileSelect = (files: FileList) => {
    if (uploadManagerRef.current?.hasActiveUploads()) {
      toast({
        title: "⚠️ Active Uploads",
        description: "Please wait for current uploads to complete or cancel them before adding new files",
        variant: "warning",
        duration: 5000
      });
      return;
    }

    // Clear previous uploads if they're done
    uploadManagerRef.current?.clearQueue();
    
    const fileArray = Array.from(files);
    setSelectedFiles(fileArray);
    
    if (uploadManagerRef.current) {
      uploadManagerRef.current.previewFiles(fileArray, selectedYear);
    }
  };

  // Separate handlers for automatic and manual uploads
  const handleAutoUploadSelect = (files: FileList) => {
    const fileArray = Array.from(files);
    setAutoUploadFiles(prev => [...prev, ...fileArray]);
    
    if (uploadManagerRef.current) {
      uploadManagerRef.current.previewFiles(fileArray, selectedYear);
    }
  };

  const handleManualUploadSelect = (files: FileList) => {
    if (!selectedLibrary || !selectedCollection) {
      toast({
        title: "Error",
        description: "Please select a library and collection first",
        variant: "destructive",
      });
      return;
    }

    const fileArray = Array.from(files);
    setSelectedFiles(prev => [...prev, ...fileArray]);
  };

  const startAutoUpload = async () => {
    if (!autoUploadFiles.length) {
      toast({
        title: "Error",
        description: "Please select files to upload",
        variant: "destructive",
      });
      return;
    }

    setIsAutoUploading(true);
    try {
      await uploadManagerRef.current?.startUpload(autoUploadFiles, selectedYear);
    } catch (error) {
      toast({
        title: "Error",
        description: "Upload failed",
        variant: "destructive",
      });
    } finally {
      setIsAutoUploading(false);
    }
  };

  const startManualUpload = async () => {
    if (!selectedFiles.length) {
      toast({
        title: "Error",
        description: "Please select files to upload",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      // Use selected library and collection for manual uploads
      await uploadManagerRef.current?.startManualUpload(
        selectedFiles,
        selectedLibrary,
        selectedCollection,
        selectedYear
      );
    } catch (error) {
      toast({
        title: "Error",
        description: "Upload failed",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFetchAndSave = async () => {
    setIsLoading(true);
    try {
      const apiKey = import.meta.env.VITE_BUNNY_API_KEY;
      if (!apiKey) {
        throw new Error("Main API key not found");
      }
      await bunnyService.fetchAllLibraryData(apiKey);
      
      toast({
        title: "Success",
        description: "Library data updated and saved successfully",
        className: "bg-green-50 border-green-200",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update library data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Update copySelectedVideos function
  const copySelectedVideos = async () => {
    if (selectedVideos.size === 0) return;
  
    try {
      const selectedVideosList = videos.filter(v => selectedVideos.has(v.guid));
      const embedCodes = await Promise.all(
        selectedVideosList.map(async (video) => {
          const embedCode = await bunnyService.getVideoEmbedCode(
            selectedLibrary,
            video.guid,
          );
          return embedCode;
        })
      );
  
      const formattedCodes = embedCodes.join('\n');
      await copyToClipboard(formattedCodes);
  
      const newCopiedStates = {};
      selectedVideosList.forEach(video => {
        newCopiedStates[video.guid] = true;
      });
      setCopiedStates(newCopiedStates);
  
      setTimeout(() => {
        setCopiedStates({});
      }, 2000);
  
      toast({
        title: "🎉 Copied!",
        description: `Copied ${selectedVideos.size} video codes`,
        className: "bg-green-50 border-green-200",
      });
    } catch (error) {
      console.error('Error copying selected videos:', error);
      toast({
        title: "Error",
        description: "Failed to copy selected videos",
        variant: "destructive",
      });
    }
  };

  const startUpload = async () => {
    if (!selectedFiles.length) {
      toast({
        title: "Error",
        description: "Please select files to upload first",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      await uploadManagerRef.current?.startUpload(selectedFiles, selectedYear);
    } catch (error) {
      toast({
        title: "Error",
        description: "Upload failed",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdateMetadata = useCallback((fileId: string, library: string, collection: string) => {
    uploadManagerRef.current?.updateFileMetadata(fileId, library, collection);
  }, []); // Fix empty dependency array

  const handleUpdateSheet = async () => {
    if (selectedVideos.size === 0) {
      toast({
        title: "⚠️ Warning",
        description: "Please select videos first",
        variant: "warning",
      });
      return;
    }
  
    setIsUpdatingSheet(true);
    
    try {
      const selectedVideosList = videos.filter(v => selectedVideos.has(v.guid));
      const videosData = await Promise.all(
        selectedVideosList.map(async (video) => {
          const embedCode = await bunnyService.getVideoEmbedCode(
            selectedLibrary,
            video.guid
          );
          return {
            name: video.title,
            embed_code: embedCode,
          };
        })
      );
  
      const result = await googleSheetsService.updateEmbedsInSheet(videosData);
  
      // Update toast to always show the result
      toast({
        title: "Sheet Update Results",
        description: result.message,
        variant: result.stats?.updated ? "success" : "warning",
        duration: 10000
      });
  
    } catch (error) {
      toast({
        title: "❌ Update Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingSheet(false);
    }
  };

  const showConfetti = () => {
    // Add confetti animation logic here
    // You can use libraries like canvas-confetti
  };

  const handleCheckboxChange = (videoGuid: string, index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    // Access shiftKey from native event
    const isShiftPressed = event.nativeEvent instanceof MouseEvent ? event.nativeEvent.shiftKey : false;
  
    setSelectedVideos((prev) => {
      const newSet = new Set(prev);
      
      if (isShiftPressed && lastCheckedIndex !== null) {
        // Get the range of videos between last checked and current
        const start = Math.min(lastCheckedIndex, index);
        const end = Math.max(lastCheckedIndex, index);
        
        // Get the selection state from the target checkbox
        const shouldSelect = event.target.checked;
        
        // Apply the same selection state to all videos in range
        sortedVideos.slice(start, end + 1).forEach((video) => {
          if (shouldSelect) {
            newSet.add(video.guid);
          } else {
            newSet.delete(video.guid);
          }
        });
      } else {
        // Normal toggle behavior
        if (event.target.checked) {
          newSet.add(videoGuid);
        } else {
          newSet.delete(videoGuid);
        }
      }
      
      return newSet;
    });
    
    setLastCheckedIndex(index);
  };

  const handleGlobalPauseToggle = useCallback(() => {
    setIsGloballyPaused(!isGloballyPaused);
    uploadManagerRef.current?.toggleGlobalPause();
  }, [isGloballyPaused]);

  const handleExportBandwidth = async () => {
    setIsExporting(true);
    try {
      await bunnyService.getBandwidthStats();
      
      toast({
        title: "✅ Export Complete",
        description: "Bandwidth statistics have been downloaded",
        variant: "success"
      });
    } catch (error) {
      toast({
        title: "❌ Export Failed",
        description: error instanceof Error ? error.message : "Failed to export statistics",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card className="w-full p-6 bg-white space-y-6">
      {/* Add this button section at the top */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button
            onClick={handleExportBandwidth}
            disabled={isExporting}
            className={cn(
              "transition-all duration-300",
              isExporting ? "bg-gray-400" : "bg-green-500 hover:bg-green-600"
            )}
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Export Bandwidth Usage
          </Button>
        </div>
        
        <Button
          onClick={handleFetchAndSave}
          className={cn(
            "transition-all duration-300",
            isLoading ? "bg-gray-400" : "bg-blue-500 hover:bg-blue-600"
          )}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="animate-spin" /> : <Save />}
          Update Library Data
        </Button>
      </div>

      {/* Automatic Upload Section */}
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Automatic File Upload</h3>
        </div>

        <UploadZone
          onFileSelect={handleAutoUploadSelect}
          disabled={isAutoUploading}
          files={autoUploadFiles}
          onStartUpload={startAutoUpload}
          isUploading={isAutoUploading}
        />
      </section>

      {/* Library Settings & Manual Upload */}
      <section className="space-y-4 pt-6 border-t">
        <h3 className="text-lg font-semibold">Library Settings</h3>
        
        {/* Grid container for Library and Collection selectors */}
        <div className="grid grid-cols-2 gap-4">
          <div className="w-full">
            <LibrarySelector
              libraries={libraries}
              selectedLibrary={selectedLibrary}
              onLibraryChange={onLibraryChange}
            />
          </div>
          
          <div className="w-full">
            <CollectionSelector
              collections={collections}
              selectedCollection={selectedCollection}
              onCollectionChange={onCollectionChange}
              disabled={!selectedLibrary}
            />
          </div>
        </div>

        <YearSelector
          selectedYear={selectedYear}
          onYearChange={onYearChange}
        />

        <ManualUploadZone
          onFileSelect={handleManualUploadSelect}
          disabled={!selectedLibrary || !selectedCollection || isUploading}
          files={selectedFiles}
          onStartUpload={startManualUpload}
          isUploading={isUploading}
        />
      </section>

      {/* Processing Queue */}
      {uploadGroups.length > 0 && (
        <ProcessingQueue 
          groups={uploadGroups}
          libraries={libraries}
          onUpdateMetadata={handleUpdateMetadata}
          onPauseUpload={(fileId: string) => uploadManagerRef.current?.pauseUpload(fileId)}
          onResumeUpload={(fileId: string) => uploadManagerRef.current?.resumeUpload(fileId)}
          onCancelUpload={(fileId: string) => uploadManagerRef.current?.cancelUpload(fileId)}
          onGlobalPauseToggle={handleGlobalPauseToggle}
          isGloballyPaused={isGloballyPaused}
        />
      )}

      {/* Fix Video Management Section */}
      <section className="space-y-4 pt-6 border-t">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Video Management</h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (selectAll) {
                  setSelectedVideos(new Set());
                } else {
                  setSelectedVideos(new Set(sortedVideos.map(video => video.guid)));
                }
                setSelectAll(!selectAll);
              }}
            >
              {selectAll ? 'Deselect All' : 'Select All'}
            </Button>
            <Button 
              onClick={copySelectedVideos} 
              disabled={selectedVideos.size === 0}
              size="sm"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy Selected ({selectedVideos.size})
            </Button>
            <Button
              onClick={handleUpdateSheet}
              disabled={selectedVideos.size === 0 || isUpdatingSheet}
              size="sm"
            >
              {isUpdatingSheet ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Update Sheet
            </Button>
          </div>
        </div>
        
        <div className="text-sm text-gray-500 mt-2">
          💡 Tip: Hold Shift while clicking checkboxes to select multiple videos at once
        </div>
        
        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {sortedVideos.map((video, index) => (
              <div 
                key={video.guid} 
                className="flex items-center justify-between p-2 border rounded hover:bg-gray-50"
              >
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="checkbox"
                    checked={selectedVideos.has(video.guid)}
                    onChange={(e) => handleCheckboxChange(video.guid, index, e)}
                    className="h-4 w-4 flex-shrink-0"
                  />
                  <span className="break-all pr-4">{video.title}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => getEmbedCode(video.guid, video.title)}
                  className="ml-2 flex-shrink-0"
                >
                  {copiedStates[video.guid] ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </section>
    </Card>
  );
};

export default VideoProcessingForm;
