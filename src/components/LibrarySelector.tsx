import React, { useState, useMemo } from "react";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

interface LibrarySelectorProps {
  libraries: Array<{ id: string; name: string }>;
  selectedLibrary: string;
  onLibraryChange: (value: string) => void;
}

const LibrarySelector: React.FC<LibrarySelectorProps> = ({
  libraries,
  selectedLibrary,
  onLibraryChange,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredLibraries = useMemo(() => {
    return libraries.filter((lib) =>
      lib.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [libraries, searchTerm]);

  return (
    <div className="space-y-2">
      <Label>Library</Label>
      
      {/* Search Box */}
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search libraries..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-8"
        />
      </div>

      <ScrollArea className="h-[200px] rounded-md border">
        <div className="p-4 space-y-2">
          {filteredLibraries.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              No libraries found
            </div>
          ) : (
            filteredLibraries.map((library) => (
              <div
                key={library.id}
                className={cn(
                  "p-2 cursor-pointer rounded-md transition-colors",
                  selectedLibrary === library.id
                    ? "bg-blue-100 hover:bg-blue-200"
                    : "hover:bg-gray-100"
                )}
                onClick={() => onLibraryChange(library.id)}
              >
                {library.name}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default LibrarySelector;