import { google } from 'googleapis';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { envConfig } from '../../src/lib/env-config';

interface VideoData {
  name: string;
  embed_code: string;
}

interface UpdateResult {
  rowIndex?: number;
  videoName: string;
  status: 'updated' | 'notFound' | 'skipped';
}

interface BatchUpdate {
  range: string;
  values: string[][];
}

interface UpdateResponse {
  success: boolean;
  message: string;
  results: UpdateResult[];
  notFoundVideos: string[];
  stats: {
    updated: number;
    notFound: number;
    skipped: number;
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { videos } = req.body;

    if (!Array.isArray(videos) || videos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No videos provided',
        results: [],
        notFoundVideos: [],
        stats: { updated: 0, notFound: 0, skipped: 0 }
      });
    }

    const { spreadsheetId, sheetName, credentials } = envConfig.googleSheets;
    
    if (!spreadsheetId || !credentials) {
      throw new Error('Missing Google Sheets configuration');
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth }).spreadsheets;

    // Get current sheet data
    const sheetsResponse = await sheets.values.get({
      spreadsheetId,
      range: `${sheetName}!N:W`,
      valueRenderOption: 'UNFORMATTED_VALUE'
    });

    const rows = sheetsResponse.data.values || [];
    const nameToRowMap = new Map<string, number>();
    const existingEmbeds = new Map<number, string>();

    // Create maps for faster lookup
    rows.forEach((row, index) => {
      if (row[0]) { // Name column (N)
        const name = row[0].toString().split('.')[0].trim().toLowerCase();
        nameToRowMap.set(name, index + 1);
        if (row[9]) { // Embed column (W)
          existingEmbeds.set(index + 1, row[9].toString());
        }
      }
    });

    const results: UpdateResult[] = [];
    const updates: BatchUpdate[] = [];
    const notFoundVideos: string[] = [];
    const stats = { updated: 0, notFound: 0, skipped: 0 };

    // Process videos
    for (const video of videos) {
      const cleanName = video.name.split('.')[0].trim().toLowerCase();
      const rowIndex = nameToRowMap.get(cleanName);

      if (!rowIndex) {
        notFoundVideos.push(video.name);
        stats.notFound++;
        results.push({ videoName: video.name, status: 'notFound' });
        continue;
      }

      const existingEmbed = existingEmbeds.get(rowIndex);
      if (existingEmbed && existingEmbed.trim()) {
        stats.skipped++;
        results.push({ rowIndex, videoName: video.name, status: 'skipped' });
        continue;
      }

      updates.push({
        range: `${sheetName}!W${rowIndex}`,
        values: [[video.embed_code]]
      });
      stats.updated++;
      results.push({ rowIndex, videoName: video.name, status: 'updated' });
    }

    // Perform batch update if there are updates
    if (updates.length > 0) {
      try {
        await sheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
            data: updates,
            valueInputOption: 'RAW'
          }
        });
      } catch (error) {
        console.error('Batch update failed:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to update sheet data',
          results,
          notFoundVideos,
          stats
        });
      }
    }

    // Always return success if the operation completed, even if no updates
    const apiResponse: UpdateResponse = {
      success: true, // Changed from stats.updated > 0
      message: `Operation completed with ${stats.updated} updates`,
      results,
      notFoundVideos,
      stats
    };

    res.status(200).json(apiResponse); // Always return 200 if operation completed

  } catch (error) {
    console.error('Error in API handler:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error',
      results: [],
      notFoundVideos: [],
      stats: {
        updated: 0,
        notFound: 0,
        skipped: 0
      }
    });
  }
}
