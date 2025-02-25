import React from "react";
import { Button } from "./ui/button";
import { Upload, FileUp } from "lucide-react";

interface UploadZoneProps {
  onFilesSelected?: (files: FileList) => void;
  isUploading?: boolean;
  acceptedFileTypes?: string[];
  maxFileSize?: number;
}

const UploadZone = ({
  onFilesSelected = () => {},
  isUploading = false,
  acceptedFileTypes = [".mp4", ".mov", ".avi"],
  maxFileSize = 1024 * 1024 * 1000, // 1GB
}: UploadZoneProps) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const { files } = e.dataTransfer;
    if (files && files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = e.target;
    if (files && files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full bg-white p-8 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors">
      <div
        className={`flex flex-col items-center justify-center h-64 ${
          isDragging ? "bg-gray-50" : ""
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isUploading ? (
          <Upload className="h-12 w-12 text-gray-400 animate-bounce" />
        ) : (
          <FileUp className="h-12 w-12 text-gray-400" />
        )}
        <h3 className="mt-4 text-lg font-medium text-gray-700">
          {isDragging
            ? "Drop your files here"
            : "Drag and drop your video files here"}
        </h3>
        <p className="mt-2 text-sm text-gray-500">
          or click the button below to browse
        </p>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          multiple
          accept={acceptedFileTypes.join(",")}
          onChange={handleFileInput}
        />
        <Button
          onClick={handleButtonClick}
          className="mt-4"
          disabled={isUploading}
        >
          Select Files
        </Button>
        <p className="mt-4 text-xs text-gray-400">
          Supported formats: {acceptedFileTypes.join(", ")} (max{" "}
          {maxFileSize / (1024 * 1024)}MB)
        </p>
      </div>
    </div>
  );
};

export default UploadZone;
