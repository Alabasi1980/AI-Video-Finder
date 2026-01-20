
// This represents a single downloadable file/stream
export interface VideoVariant {
  url: string;
  format: string; // e.g., 'mp4', 'webm', 'm3u8'
  resolution?: string; // e.g., '1080p', 'Audio Only'
  sizeMb?: number; // File size in megabytes
  isProtected?: boolean; // True if the URL is temporary/signed (e.g., from googlevideo.com)
}

// This groups all variants of a single conceptual video
export interface VideoGroup {
  title: string;
  thumbnailUrl?: string;
  category?: string; // e.g., 'Tutorial', 'Music Video', 'Vlog'
  uploadDate?: string; // e.g., '2023-10-27'
  popularity?: number; // A score from 0-100
  variants: VideoVariant[];
}
