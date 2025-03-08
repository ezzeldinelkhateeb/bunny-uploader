export interface LibraryInfo {
  id: string;
  name: string;
  collections?: {
    id: string;
    name: string;
  }[];
}