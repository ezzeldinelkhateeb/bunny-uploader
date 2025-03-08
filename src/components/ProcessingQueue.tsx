import React, { useState, useEffect } from "react";
import { ScrollArea } from "./ui/scroll-area";
import { Card } from "./ui/card";
import { CheckCircle2, AlertCircle, Clock, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Progress } from "./ui/progress";

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
    status: "pending" | "processing" | "completed" | "error";
    progress: number;
    errorMessage?: string;
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
}

const ProcessingQueue: React.FC<ProcessingQueueProps> = ({
  groups,
  libraries,
  onUpdateMetadata
}) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Upload Status</h3>
      <ScrollArea className="h-[300px] rounded-md border">
        <div className="p-4 space-y-4">
          {groups.map((group) => (
            <div key={`${group.library}-${group.collection}`} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold">
                    {group.items[0]?.metadata?.libraryName || group.library} → {group.items[0]?.metadata?.collectionName || group.collection}
                  </h3>
                </div>
              </div>
              
              <div className="space-y-3">
                {group.items.map((item) => (
                  <div key={item.id} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm truncate">{item.filename}</span>
                      <span className="text-sm text-gray-500">{item.progress}%</span>
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
