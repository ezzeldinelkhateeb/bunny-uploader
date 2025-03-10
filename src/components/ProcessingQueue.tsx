import React, { useCallback } from "react";
import { ScrollArea } from "./ui/scroll-area";
import { Progress } from "./ui/progress";
import { Button } from "./ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogAction, AlertDialogCancel, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { Pause, Play, XCircle } from "lucide-react";
import { formatBytes } from "../lib/utils";

interface Library {
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
    status: "pending" | "processing" | "completed" | "error" | "paused";
    progress: number;
    errorMessage?: string;
    uploadSpeed?: number;
    timeRemaining?: number;
    metadata: {
      library: string;
      collection: string;
      year: string;
      libraryName: string;
      collectionName: string;
      needsManualSelection?: boolean;
      reason?: string; // Add this optional field
    };
  }[];
}

interface ProcessingQueueProps {
  groups: UploadGroup[];
  libraries: Library[];
  onUpdateMetadata: (fileId: string, library: string, collection: string) => void;
  onPauseUpload: (fileId: string) => void;  // Change to accept fileId
  onResumeUpload: (fileId: string) => void; // Change to accept fileId
  onCancelUpload: (fileId: string) => void;
  onGlobalPauseToggle: () => void;
  isGloballyPaused: boolean;
}

const ProcessingQueue: React.FC<ProcessingQueueProps> = ({
  groups,
  libraries,
  onUpdateMetadata,
  onPauseUpload,
  onResumeUpload,
  onCancelUpload,
  onGlobalPauseToggle,
  isGloballyPaused
}) => {
  // Calculate stats
  const totalFiles = groups.reduce((acc, group) => acc + group.items.length, 0);
  const completedFiles = groups.reduce((acc, group) => 
    acc + group.items.filter(item => item.status === "completed").length, 0);
  const processingFile = groups
    .flatMap(g => g.items)
    .find(item => item.status === "processing");

  const sortItems = useCallback((items: any[]) => {
    return [...items].sort((a, b) => {
      // First split by Q number
      const baseNameA = a.filename.split(/Q\d+/)[0];
      const baseNameB = b.filename.split(/Q\d+/)[0];

      if (baseNameA !== baseNameB) {
        return baseNameA.localeCompare(baseNameB);
      }

      // Then sort by Q number if base names are the same
      const qNumA = parseInt(a.filename.match(/Q(\d+)/)?.[1] || "0");
      const qNumB = parseInt(b.filename.match(/Q(\d+)/)?.[1] || "0");
      return qNumA - qNumB;
    });
  }, []);

  const sortedGroups = groups.map(group => ({
    ...group,
    items: sortItems(group.items)
  }));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">Upload Status</h3>
          <div className="text-sm text-gray-500">
            {completedFiles} / {totalFiles} files uploaded
            {processingFile && (
              <span className="ml-2">
                • {formatBytes(processingFile.uploadSpeed || 0)}/s
              </span>
            )}
          </div>
          {totalFiles > completedFiles && (
            <Button
              variant="outline"
              size="sm"
              onClick={onGlobalPauseToggle}
            >
              {isGloballyPaused ? (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Resume All
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  Pause All
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="h-[300px] rounded-md border">
        <div className="p-4 space-y-4">
          {sortedGroups.map((group) => (
            <div key={`${group.library}-${group.collection}`} className="border rounded-lg p-4">
              <div className="mb-4">
                <h3 className="font-semibold">
                  {group.library} → {group.collection}
                </h3>
              </div>

              <div className="space-y-3">
                {group.items.map((item) => (
                  <div key={item.id} className="space-y-2">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-sm truncate flex-1">{item.filename}</span>
                      <div className="flex items-center gap-2">
                        {item.uploadSpeed > 0 && (
                          <span className="text-xs text-gray-500">
                            {formatBytes(item.uploadSpeed)}/s
                          </span>
                        )}
                        <span className="text-sm text-gray-500 min-w-[60px] text-right">
                          {item.progress}%
                        </span>
                        {item.status === "processing" && (
                          <>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Cancel Upload?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will stop the current upload. The partially uploaded video
                                    will remain on Bunny.net and will need to be manually deleted.
                                    Are you sure you want to cancel?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>No, continue upload</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => onCancelUpload(item.id)}
                                    className="bg-red-500 hover:bg-red-600"
                                  >
                                    Yes, cancel upload
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </div>
                    <Progress value={item.progress} className="h-2" />
                    {item.errorMessage && (
                      <p className="text-xs text-red-500">{item.errorMessage}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ProcessingQueue;
