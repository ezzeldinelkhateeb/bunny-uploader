import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Card } from "./ui/card";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Search, Copy, Save, Loader2, CheckCircle2 } from "lucide-react";
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

  useEffect(() => {
    uploadManagerRef.current = new UploadManager(
      (groups) => setUploadGroups(groups),
      toast
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
        title: "خطأ",
        description: "برجاء اختيار المكتبة أولاً",
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
        throw new Error("لم يتم العثور على embed code");
      }
  
      await copyToClipboard(embedCode);
  
      setCopiedStates(prev => ({ ...prev, [videoGuid]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [videoGuid]: false }));
      }, 2000);
  
      toast({
        title: "✨ تم النسخ!",
        description: `تم نسخ كود الفيديو ${videoTitle}`,
        className: "bg-green-50 border-green-200",
      });
    } catch (error) {
      console.error('Error getting embed code:', error);
      toast({
        title: "خطأ",
        description: "فشل في الحصول على كود الفيديو",
        variant: "destructive",
      });
    }
  };

  // Add file upload handler
  const handleFileSelect = (files: FileList) => {
    const fileArray = Array.from(files);
    setSelectedFiles(prev => [...prev, ...fileArray]);
    
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
        title: "🎉 تم النسخ!",
        description: `تم نسخ ${selectedVideos.size} كود للفيديوهات المحددة`,
        className: "bg-green-50 border-green-200",
      });
    } catch (error) {
      console.error('Error copying selected videos:', error);
      toast({
        title: "خطأ",
        description: "فشل في نسخ الفيديوهات المحددة",
        variant: "destructive",
      });
    }
  };

  const startUpload = async () => {
    if (!selectedFiles.length) {
      toast({
        title: "خطأ",
        description: "برجاء اختيار ملفات للرفع أولاً",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      await uploadManagerRef.current?.startUpload(selectedFiles, selectedYear);
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء الرفع",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdateMetadata = useCallback((fileId: string, library: string, collection: string) => {
    uploadManagerRef.current?.updateFileMetadata(fileId, library, collection);
  }, []);

  const handleUpdateSheet = async () => {
    if (selectedVideos.size === 0) {
      toast({
        title: "⚠️ تنبيه",
        description: "برجاء اختيار الفيديوهات أولاً",
        variant: "warning",
        duration: 3000
      });
      return;
    }
  
    setIsUpdatingSheet(true);
    
    // Show initial progress toast
    toast({
      title: "🔄 جاري التحديث",
      description: `جاري تحديث ${selectedVideos.size} فيديو...`,
      duration: 3000
    });
  
    try {
      const selectedVideosList = videos.filter(v => selectedVideos.has(v.guid));
      const totalVideos = selectedVideosList.length;
      let processedCount = 0;
  
      // Process videos in chunks to avoid overwhelming the API
      const chunkSize = 10;
      for (let i = 0; i < selectedVideosList.length; i += chunkSize) {
        const chunk = selectedVideosList.slice(i, i + chunkSize);
        
        const embedPromises = chunk.map(async (video) => {
          const embedCode = await bunnyService.getVideoEmbedCode(
            selectedLibrary,
            video.guid,
          );
          processedCount++;
          
          // Show progress update every 10 videos
          if (processedCount % 10 === 0) {
            toast({
              title: "🔄 جاري التحديث",
              description: `تم معالجة ${processedCount} من ${totalVideos} فيديو`,
              duration: 2000
            });
          }
          
          return {
            name: video.title,
            embed_code: embedCode,
          };
        });
  
        const embedResults = await Promise.all(embedPromises);
        const result = await googleSheetsService.updateEmbedsInSheet(embedResults);
  
        // Show batch success notification
        if (result.stats?.updated > 0) {
          toast({
            title: "✅ تم التحديث",
            description: result.message,
            variant: "success",
            duration: 3000
          });
        }
  
        // Show warnings if any
        if (result.not_found_videos?.length > 0) {
          toast({
            title: "⚠️ فيديوهات غير موجودة",
            description: result.not_found_videos.join('\n'),
            variant: "warning",
            duration: 5000
          });
        }
      }
  
      // Show final success message
      toast({
        title: "✅ تم الانتهاء!",
        description: "تم تحديث جميع الفيديوهات المحددة",
        variant: "success",
        duration: 5000
      });
  
    } catch (error) {
      console.error('Error updating sheet:', error);
      toast({
        title: "❌ خطأ",
        description: error instanceof Error ? error.message : "فشل تحديث Google Sheets",
        variant: "destructive",
        duration: 5000
      });
    } finally {
      setIsUpdatingSheet(false);
    }
  };

  return (
    <Card className="w-full p-6 bg-white space-y-6">
      {/* Automatic Upload Section */}
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Automatic File Upload</h3>
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
        />
      )}

      {/* Video Management Section */}
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
      
        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {sortedVideos.map((video) => (
              <div 
                key={video.guid} 
                className="flex items-center justify-between p-2 border rounded hover:bg-gray-50"
              >
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="checkbox"
                    checked={selectedVideos.has(video.guid)}
                    onChange={() => {
                      setSelectedVideos((prev) => {
                        const newSet = new Set(prev);
                        if (newSet.has(video.guid)) {
                          newSet.delete(video.guid);
                        } else {
                          newSet.add(video.guid);
                        }
                        return newSet;
                      });
                    }}
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
