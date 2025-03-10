import { google } from 'googleapis';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getGoogleAuthClient } from '@/lib/google-auth';

interface BatchUpdateRequest {
  videos: Array<{ name: string; embed_code: string }>;
  batchIndex: number;
  totalBatches: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { videos, batchIndex, totalBatches } = req.body as BatchUpdateRequest;
    
    const auth = await getGoogleAuthClient();
    const sheets = google.sheets({ version: 'v4', auth: auth as any });

    // Get all video names at once
    const sheetResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
      range: 'Videos!N:W' // Get both name and embed columns
    });

    const rows = sheetResponse.data.values || [];
    const nameToRowMap = new Map<string, number>();

    // Create efficient lookup map
    rows.forEach((row, index) => {
      if (row[0]) { // Column N (name)
        const name = row[0].toString().split('.')[0].trim().toLowerCase();
        nameToRowMap.set(name, index + 1);
      }
    });

    const results = [];
    const updates = [];
    const notFoundVideos = [];
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

      // Check if embed code already exists
      if (rows[rowIndex - 1][9]) { // Column W
        stats.skipped++;
        results.push({ rowIndex, videoName: video.name, status: 'skipped' });
        continue;
      }

      updates.push({ rowIndex, embedCode: video.embed_code });
      stats.updated++;
      results.push({ rowIndex, videoName: video.name, status: 'updated' });
    }

    // Perform batch update if there are updates
    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
        requestBody: {
          data: updates.map(update => ({
            range: `Videos!W${update.rowIndex}`,
            values: [[update.embedCode]]
          })),
          valueInputOption: 'RAW'
        }
      });
    }

    const apiResponse = {
      success: true,
      message: `Batch ${batchIndex + 1}/${totalBatches} complete`,
      results: results.map(r => ({
        rowIndex: r.rowIndex || null,
        videoName: r.videoName,
        status: r.status
      })),
      notFoundVideos,
      stats: {
        updated: stats.updated,
        notFound: stats.notFound,
        skipped: stats.skipped
      }
    };

    res.status(200).json(apiResponse);

  } catch (error) {
    console.error('Error in API handler:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}
