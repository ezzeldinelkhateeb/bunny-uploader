import React from "react";
import { ScrollArea } from "./ui/scroll-area";
import { Card } from "./ui/card";
import FileProgressRow from "./FileProgressRow";

type ProcessingStatus = "pending" | "processing" | "completed" | "error";

interface QueueItem {
  id: string;
  filename: string;
  status: ProcessingStatus;
  progress: number;
  errorMessage?: string;
  metadata: {
    library: string;
    collection: string;
    year: string;
  };
}

interface ProcessingQueueProps {
  items?: QueueItem[];
}

const ProcessingQueue = ({ items = defaultItems }: ProcessingQueueProps) => {
  // Group items by library and collection
  const groups = React.useMemo(() => {
    const groupMap = new Map<
      string,
      {
        library: string;
        collection: string;
        items: typeof items;
      }
    >();

    items.forEach((item) => {
      const key = `${item.metadata.library}|${item.metadata.collection}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          library: item.metadata.library,
          collection: item.metadata.collection,
          items: [],
        });
      }
      groupMap.get(key)?.items.push(item);
    });

    return Array.from(groupMap.values());
  }, [items]);
  return (
    <Card className="w-full bg-gray-50 p-6">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold">Processing Queue</h2>
        <p className="text-gray-500">Track the status of your video uploads</p>
      </div>

      <ScrollArea className="h-[400px] w-full rounded-md border">
        <div className="space-y-6 p-4">
          {groups.map((group) => (
            <div
              key={`${group.library}|${group.collection}`}
              className="space-y-2"
            >
              <div className="sticky top-0 bg-white/90 backdrop-blur-sm p-2 border-b">
                <h3 className="font-semibold">{group.library}</h3>
                <p className="text-sm text-muted-foreground">
                  {group.collection}
                </p>
              </div>
              <div className="space-y-2 pl-2">
                {group.items.map((item) => (
                  <FileProgressRow
                    key={item.id}
                    filename={item.filename}
                    status={item.status}
                    progress={item.progress}
                    errorMessage={item.errorMessage}
                    metadata={item.metadata}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
};

// Default items for demonstration
const defaultItems: QueueItem[] = [
  {
    id: "1",
    filename: "physics-lecture-2024.mp4",
    status: "completed",
    progress: 100,
    metadata: {
      library: "Science Library",
      collection: "Physics",
      year: "2024",
    },
  },
  {
    id: "2",
    filename: "chemistry-lab-2024.mp4",
    status: "processing",
    progress: 45,
    metadata: {
      library: "Science Library",
      collection: "Chemistry",
      year: "2024",
    },
  },
  {
    id: "3",
    filename: "biology-class-2024.mp4",
    status: "error",
    progress: 30,
    errorMessage: "Upload failed. Please try again.",
    metadata: {
      library: "Science Library",
      collection: "Biology",
      year: "2024",
    },
  },
  {
    id: "4",
    filename: "math-tutorial-2024.mp4",
    status: "pending",
    progress: 0,
    metadata: {
      library: "Main Library",
      collection: "Mathematics",
      year: "2024",
    },
  },
];

export default ProcessingQueue;
