import { ParseResult, LibraryInfo } from '../types/filename-parser';
import { parseFilename, findMatchingLibrary } from './filename-parser';

interface FileGroup {
  collection: string;
  files: Array<{
    filename: string;
    parseResult: ParseResult;
    suggestedLibraries: LibraryInfo[];
  }>;
}

export class FileManager {
  private groups: Map<string, FileGroup> = new Map();
  
  processFiles(files: File[], libraries: LibraryInfo[]): Map<string, FileGroup> {
    this.groups.clear();

    for (const file of files) {
      const parseResult = parseFilename(file.name);
      const libraryMatch = findMatchingLibrary(parseResult.parsed!, libraries);

      if (!libraryMatch.library) {
        // Group by collection for manual assignment
        const collection = parseResult.collection.name;
        if (!this.groups.has(collection)) {
          this.groups.set(collection, {
            collection,
            files: []
          });
        }

        this.groups.get(collection)!.files.push({
          filename: file.name,
          parseResult,
          suggestedLibraries: libraryMatch.alternatives
        });
      }
    }

    return this.groups;
  }

  assignLibraryToGroup(collection: string, libraryId: string): void {
    const group = this.groups.get(collection);
    if (group) {
      group.files.forEach(file => {
        file.parseResult.libraryMatch.library = { id: libraryId, name: libraryId };
      });
    }
  }
}
