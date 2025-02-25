import React from "react";
import { Progress } from "./ui/progress";
import { Badge } from "./ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { CheckCircle2, AlertCircle, Clock, XCircle } from "lucide-react";

type ProcessingStatus = "pending" | "processing" | "completed" | "error";

interface FileProgressRowProps {
  filename?: string;
  status?: ProcessingStatus;
  progress?: number;
  errorMessage?: string;
  metadata?: {
    library?: string;
    collection?: string;
    year?: string;
  };
}

const FileProgressRow = ({
  filename = "example-video-2024.mp4",
  status = "pending",
  progress = 0,
  errorMessage = "",
  metadata = {
    library: "Main Library",
    collection: "Science",
    year: "2024",
  },
}: FileProgressRowProps) => {
  const statusConfig = {
    pending: {
      icon: <Clock className="h-5 w-5 text-yellow-500" />,
      label: "Pending",
      color: "bg-yellow-100 text-yellow-800",
    },
    processing: {
      icon: <Clock className="h-5 w-5 text-blue-500 animate-spin" />,
      label: "Processing",
      color: "bg-blue-100 text-blue-800",
    },
    completed: {
      icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
      label: "Completed",
      color: "bg-green-100 text-green-800",
    },
    error: {
      icon: <XCircle className="h-5 w-5 text-red-500" />,
      label: "Error",
      color: "bg-red-100 text-red-800",
    },
  };

  const currentStatus = statusConfig[status];

  return (
    <div className="w-full p-4 bg-white border rounded-lg shadow-sm flex items-center gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          {currentStatus.icon}
          <span className="font-medium truncate">{filename}</span>
          <Badge variant="secondary" className={currentStatus.color}>
            {currentStatus.label}
          </Badge>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Progress value={progress} className="h-2" />
          </div>
          <span className="text-sm text-gray-500 w-12">{progress}%</span>
        </div>

        {status === "error" && errorMessage && (
          <div className="mt-2 flex items-center gap-2 text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{errorMessage}</span>
          </div>
        )}
      </div>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <div className="text-right">
              <div className="text-sm font-medium">{metadata.library}</div>
              <div className="text-sm text-gray-500">
                {metadata.collection} - {metadata.year}
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Library: {metadata.library}</p>
            <p>Collection: {metadata.collection}</p>
            <p>Year: {metadata.year}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default FileProgressRow;
