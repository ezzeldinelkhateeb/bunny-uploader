import React from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { Button } from './ui/button';

interface UploadZoneProps {
  onFileSelect: (files: FileList) => void;
  disabled: boolean;
  files: File[];
  onStartUpload: () => Promise<void>;
  isUploading: boolean;
}

const UploadZone: React.FC<UploadZoneProps> = ({
  onFileSelect,
  disabled,
  files,
  onStartUpload,
  isUploading
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary'
        }`}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled && e.dataTransfer.files) {
            onFileSelect(e.dataTransfer.files);
          }
        }}
      >
        <input
          type="file"
          multiple
          className="hidden"
          ref={inputRef}
          onChange={(e) => e.target.files && onFileSelect(e.target.files)}
          disabled={disabled}
        />
        <Upload className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2">Drag and drop files here or click to select</p>
      </div>

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

export default UploadZone;
