export interface CollectionInfo {
  id: string;
  name: string;
}

export interface LibraryInfo {
  id: string;
  name: string;
  apiKey: string;
  collections: CollectionInfo[];
}

export interface LibraryData {
  lastUpdated: string;
  libraries: LibraryInfo[];
  mainApiKey: string;
}
