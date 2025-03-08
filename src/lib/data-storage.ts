import { LibraryData, LibraryInfo } from "@/types/library-data";
import { cache } from './cache';
import CryptoJS from 'crypto-js';

class DataStorage {
  private readonly STORAGE_KEY = 'library_data';
  private readonly CONFIG_FILE = 'bunny-config.json';
  private readonly ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'your-fallback-key';

  private encryptData(data: any): string {
    return CryptoJS.AES.encrypt(JSON.stringify(data), this.ENCRYPTION_KEY).toString();
  }

  private decryptData(encryptedData: string): any {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, this.ENCRYPTION_KEY);
      const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
      return JSON.parse(decryptedString);
    } catch (error) {
      console.error('Error decrypting data:', error);
      return null;
    }
  }

  async saveLibraryData(data: LibraryData): Promise<void> {
    try {
      // Encrypt and save to localStorage
      const encryptedData = this.encryptData(data);
      localStorage.setItem(this.STORAGE_KEY, encryptedData);

      // Create encrypted file content
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `library_data_${timestamp}.json`;

      // Create file content with encryption
      const fileContent = {
        encrypted: encryptedData,
        timestamp: timestamp
      };

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(fileContent, null, 2)], {
        type: 'application/json'
      });

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';

      // Trigger download
      document.body.appendChild(a);
      a.click();

      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);

      // Update cache
      data.libraries.forEach(lib => {
        if (lib.apiKey) {
          cache.set(`library_${lib.id}_api`, lib.apiKey);
        }
      });

      console.log('Library data saved successfully');
    } catch (error) {
      console.error('Error saving library data:', error);
      throw error;
    }
  }

  getLibraryData(): LibraryData | null {
    try {
      const encryptedData = localStorage.getItem(this.STORAGE_KEY);
      if (!encryptedData) return null;
      
      return this.decryptData(encryptedData);
    } catch (error) {
      console.error('Error reading library data:', error);
      return null;
    }
  }

  getLibraryById(libraryId: string): LibraryInfo | null {
    const data = this.getLibraryData();
    return data?.libraries.find(lib => lib.id === libraryId) || null;
  }

  clearData(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    cache.clear();
  }

  hasStoredData(): boolean {
    return !!localStorage.getItem(this.STORAGE_KEY);
  }
}

export const dataStorage = new DataStorage();
