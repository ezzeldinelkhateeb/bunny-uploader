import { VideoMetadata, VideoRule, VIDEO_RULES } from "../types/bunny";

export class VideoProcessor {
  static parseFilename(filename: string): VideoMetadata | null {
    try {
      // Extract metadata from filename using regex
      const parts = filename.split("_");

      // Determine video type
      let type: VideoMetadata["type"] = "FULL";
      if (filename.startsWith("RE_")) type = "RE";
      else if (filename.match(/^Q\d+/)) type = "QV";

      // Extract year - look for 2024 or 2025
      const yearMatch = filename.match(/(2024|2025)/);
      if (!yearMatch) throw new Error("Invalid year");

      const metadata: VideoMetadata = {
        type,
        year: yearMatch[0] as "2024" | "2025",
      };

      // Optional metadata
      if (parts.length > 2) {
        metadata.term = parts[1];
        metadata.branch = parts[2];
        metadata.teacherCode = parts[3]?.split(".")[0];
      }

      return metadata;
    } catch (error) {
      console.error("Error parsing filename:", error);
      return null;
    }
  }

  static determineCollection(filename: string): string {
    for (const rule of VIDEO_RULES) {
      if (rule.pattern.test(filename)) {
        return rule.collection;
      }
    }
    return VIDEO_RULES[VIDEO_RULES.length - 1].collection; // Default collection
  }

  static validateFile(file: File): string | null {
    // Validate file type
    const validTypes = [".mp4", ".mov", ".avi"];
    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!validTypes.includes(extension)) {
      return `Invalid file type. Supported types: ${validTypes.join(", ")}`;
    }

    // Validate file size (1GB max)
    const maxSize = 1024 * 1024 * 1024; // 1GB
    if (file.size > maxSize) {
      return `File too large. Maximum size: ${maxSize / (1024 * 1024)}MB`;
    }

    // Validate filename format
    const metadata = this.parseFilename(file.name);
    if (!metadata) {
      return "Invalid filename format";
    }

    return null; // No errors
  }
}
