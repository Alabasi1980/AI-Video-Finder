
import { Injectable } from '@angular/core';
import { GoogleGenAI, Type } from '@google/genai';
import { VideoGroup } from '../models/video-info.model.ts';

// A simple in-memory cache to avoid re-fetching the same URL
const cache = new Map<string, VideoGroup[]>();

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  private readonly genAI: GoogleGenAI;

  constructor() {
    if (!process.env.API_KEY) {
      throw new Error("API_KEY environment variable not set");
    }
    this.genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async findVideosInUrl(url: string): Promise<VideoGroup[]> {
    if (cache.has(url)) {
      return Promise.resolve(cache.get(url)!);
    }

    const prompt = `
      Analyze the provided URL as an expert in web video extraction. Your goal is to identify all playable videos, including those on complex platforms like YouTube or Facebook.

      Your instructions are:
      1.  **Find All Video Sources:** Look for direct video links (.mp4, .webm) and streaming manifest files (.m3u8 for HLS, .mpd for DASH).
      2.  **Group Video Variants:** A single video is often available in multiple qualities. Group all these different files/streams under a single parent video object.
      3.  **Extract Metadata for Each Group:** For each conceptual video, find:
          - 'title', 'thumbnailUrl', 'category', 'uploadDate', 'popularity'.
      4.  **Detail Each Variant:** Within each group, list all available formats/qualities as 'variants'. Each variant must have:
          - 'url': The direct, absolute URL to the video file or manifest.
          - 'format': The file extension (e.g., 'mp4', 'm3u8').
          - 'resolution': A descriptive label for the quality (e.g., '1080p', 'Audio Only').
          - 'sizeMb': Estimated file size if available.
          - 'isProtected': A boolean. Set this to TRUE if the video URL domain is from a known streaming CDN (like 'googlevideo.com') OR if the URL contains security parameters like 'expire', 'sig', 'token', 'ei'. Otherwise, set it to FALSE or omit it. This is critical.

      URL: ${url}

      Return ONLY a valid JSON array of these grouped video objects. If no videos are found, return an empty array [].
    `;
    
    try {
      const response = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                thumbnailUrl: { type: Type.STRING },
                category: { type: Type.STRING },
                uploadDate: { type: Type.STRING },
                popularity: { type: Type.NUMBER },
                variants: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      url: { type: Type.STRING },
                      format: { type: Type.STRING },
                      resolution: { type: Type.STRING },
                      sizeMb: { type: Type.NUMBER },
                      isProtected: { type: Type.BOOLEAN }
                    },
                    required: ['url', 'format', 'resolution'],
                  }
                }
              },
              required: ['title', 'variants'],
            },
          },
        },
      });

      const jsonString = response.text.trim();
      const videoGroups: VideoGroup[] = JSON.parse(jsonString);
      
      const processedGroups = videoGroups.map(group => ({
        ...group,
        variants: group.variants.map(variant => {
          try {
            const absoluteUrl = new URL(variant.url, url).href;
            return { ...variant, url: absoluteUrl };
          } catch (e) {
            return variant;
          }
        }),
        thumbnailUrl: group.thumbnailUrl ? new URL(group.thumbnailUrl, url).href : undefined
      }));
      
      cache.set(url, processedGroups);
      return processedGroups;

    } catch (error) {
      console.error('Error calling Gemini API:', error);
      throw new Error('Failed to analyze the URL. The AI model could not process the request.');
    }
  }
}
