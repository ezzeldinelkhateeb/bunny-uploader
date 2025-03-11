import React from 'react';
import { Button } from './ui/button';
import { Select, SelectItem } from './ui/select';
import { Progress } from './ui/progress';

interface UploadGroup {
  id: string;
  status: 'pending' | 'needsLibrary' | 'ready';
  suggestedLibraries: string[];
  files: {
    id: string;
    file: File;
    status: {
      status: 'pending' | 'processing' | 'completed' | 'error';
      progress: number;
      error?: string;
    };
  }[];
}

interface GroupedUploadProps {
  group: UploadGroup;
  onLibrarySelect: (libraryId: string) => void;
  onUpload: () => void;
}

const GroupedUpload: React.FC<GroupedUploadProps> = ({
  group,
  onLibrarySelect,
  onUpload
}) => {
  return (
    <div className="border rounded p-4 mb-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">Group: {group.id}</h3>
        {group.status === 'needsLibrary' && (
          <Select onValueChange={onLibrarySelect}>
            {group.suggestedLibraries.map(lib => (
              <SelectItem key={lib} value={lib}>
                {lib}
              </SelectItem>
            ))}
          </Select>
        )}
      </div>
      
      <div className="space-y-2">
        {group.files.map(file => (
          <div key={file.id} className="flex items-center gap-2">
            <div className="flex-1">
              {file.file.name}
              {file.status.status === 'error' && (
                <span className="text-red-500 ml-2">{file.status.error}</span>
              )}
            </div>
            <div className="w-24">
              {file.status.status === 'processing' && (
                <Progress value={file.status.progress} />
              )}
            </div>
          </div>
        ))}
      </div>
      
      {group.status === 'ready' && (
        <Button onClick={onUpload} className="mt-4">
          Upload Group
        </Button>
      )}
    </div>
  );
};

export default GroupedUpload;
