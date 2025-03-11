import React from "react";
import { Card } from "./ui/card";
import VideoProcessingForm from "./VideoProcessingForm";
import { bunnyService } from "../lib/bunny-service";

interface Library {
  id: string;
  name: string;
}

interface Collection {
  id: string;
  name: string;
}

const Home = () => {
  const [libraries, setLibraries] = React.useState<Library[]>([]);
  const [collections, setCollections] = React.useState<Collection[]>([]);
  const [selectedLibrary, setSelectedLibrary] = React.useState("");
  const [selectedCollection, setSelectedCollection] = React.useState("");
  const [selectedYear, setSelectedYear] = React.useState<string>("2025");

  // Initialize bunny service and fetch libraries on mount
  React.useEffect(() => {
    const storedApiKey = localStorage.getItem("bunny_api_key");
    if (!storedApiKey) {
      const apiKey = prompt("Please enter your Bunny.net API key:");
      if (apiKey) {
        localStorage.setItem("bunny_api_key", apiKey);
        bunnyService.setLibraryApiKey("default", apiKey);
      }
    }

    const initializeAndFetchLibraries = async () => {
      try {
        await bunnyService.initialize();
        const libs = await bunnyService.getLibraries();
        const transformedLibs = libs.map((lib) => ({
          id: lib.id || "",
          name: lib.name || "Unnamed Library",
        }));
        setLibraries(transformedLibs);
      } catch (error) {
        console.error("Error fetching libraries:", error);
      }
    };
    initializeAndFetchLibraries();
  }, []);

  // Fetch collections when library changes
  React.useEffect(() => {
    const fetchCollections = async () => {
      if (!selectedLibrary) return;
      try {
        const cols = await bunnyService.getCollections(selectedLibrary);
        const transformedCols = cols.map((col) => ({
          id: col.id || "",
          name: col.name || "Unnamed Collection",
        }));
        setCollections(transformedCols);
      } catch (error) {
        console.error("Error fetching collections:", error);
        setCollections([]);
      }
    };
    fetchCollections();
  }, [selectedLibrary]);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Video Processing System
          </h1>
          <p className="mt-2 text-gray-600">
            Upload and process educational videos for your library collections
          </p>
        </div>

        <Card className="p-6">
          <VideoProcessingForm
            libraries={libraries}
            collections={collections}
            selectedLibrary={selectedLibrary}
            selectedCollection={selectedCollection}
            selectedYear={selectedYear}
            onLibraryChange={setSelectedLibrary}
            onCollectionChange={setSelectedCollection}
            onYearChange={setSelectedYear}
          />
        </Card>
      </div>
    </div>
  );
};

export default Home;
