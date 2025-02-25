class DataStorage {
  private libraries: Map<string, any> = new Map();
  private collections: Map<string, any[]> = new Map();

  setLibraries(libraries: any[]): void {
    libraries.forEach((lib) => {
      this.libraries.set(lib.id, lib);
    });
  }

  getLibraries(): any[] {
    return Array.from(this.libraries.values());
  }

  setCollections(libraryId: string, collections: any[]): void {
    this.collections.set(libraryId, collections);
  }

  getCollections(libraryId: string): any[] {
    return this.collections.get(libraryId) || [];
  }
}

export const dataStorage = new DataStorage();
