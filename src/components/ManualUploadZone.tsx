import React from "react";
import { Button } from "./ui/button";
import { Loader2, Upload } from "lucide-react";

interface ManualUploadZoneProps {
  onFileSelect: (files: FileList) => void;
  disabled?: boolean;
  files: File[];
  onStartUpload: () => void;
  isUploading: boolean;
}

const ManualUploadZone: React.FC<ManualUploadZoneProps> = ({
  onFileSelect,
  disabled,
  files,
  onStartUpload,
  isUploading
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      <input
        type="file"
        multiple
        className="hidden"
        ref={inputRef}
        onChange={(e) => e.target.files && onFileSelect(e.target.files)}
      />
      <Button
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        variant="outline"
        className="w-full"
      >
        Select Files
      </Button>
      {files.length > 0 && (
        <Button
          onClick={onStartUpload}
          disabled={isUploading}
          className="w-full"
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload {files.length} Files
            </>
          )}
        </Button>
      )}
    </div>
  );
};

export default ManualUploadZone;