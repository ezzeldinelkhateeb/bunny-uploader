import React from "react";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "@/lib/utils"; // Add this import

interface CollectionSelectorProps {
  collections: Array<{ id: string; name: string }>;
  selectedCollection: string;
  onCollectionChange: (value: string) => void;
  disabled?: boolean;
}

const CollectionSelector: React.FC<CollectionSelectorProps> = ({
  collections,
  selectedCollection,
  onCollectionChange,
  disabled
}) => {
  return (
    <div className="space-y-2">
      <Label>Collection</Label>
      <ScrollArea className={cn(
        "h-[200px] rounded-md border",
        disabled && "opacity-50"
      )}>
        <div className="p-4">
          {collections.map((collection) => (
            <div
              key={collection.id}
              className={cn(
                "p-2 cursor-pointer rounded-md transition-colors",
                selectedCollection === collection.id 
                  ? "bg-blue-100 hover:bg-blue-200" 
                  : "hover:bg-gray-100",
                disabled && "cursor-not-allowed"
              )}
              onClick={() => !disabled && onCollectionChange(collection.id)}
            >
              {collection.name}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default CollectionSelector;