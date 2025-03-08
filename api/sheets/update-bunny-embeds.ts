import { google } from 'googleapis';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { envConfig } from '../../src/lib/env-config';

interface VideoData {
  name: string;
  embed_code: string;
}

interface UpdateResult {
  updated: Array<{ name: string; row: number }>;
  notFound: string[];
  existingEmbeds: Array<{ name: string; row: number }>;
}

async function findVideoRowAndCheckEmbed(
  sheets: any,
  spreadsheetId: string,
  sheetName: string,
  videoName: string
): Promise<{ rowIndex: number | null; hasExistingEmbed: boolean }> {
  try {
    // Get all values from column N (video names)
    const nameResponse = await sheets.values.get({
      spreadsheetId,
      range: `${sheetName}!N:N`,
    });

    const rows = nameResponse.data.values || [];
    let rowIndex: number | null = null;

    // Find the exact match (case-sensitive)
    for (let i = 1; i < rows.length; i++) {
      if (rows[i]?.[0]?.trim() === videoName.trim()) {
        rowIndex = i + 1; // Convert to 1-based index
        break;
      }
    }

    if (!rowIndex) {
      return { rowIndex: null, hasExistingEmbed: false };
    }

    // Check if there's an existing embed code in column W
    const embedResponse = await sheets.values.get({
      spreadsheetId,
      range: `${sheetName}!W${rowIndex}`,
    });

    const hasExistingEmbed = !!(embedResponse.data.values?.[0]?.[0]);

    return { rowIndex, hasExistingEmbed };
  } catch (error) {
    console.error('Error checking row:', error);
    throw error;
  }
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

    if (!Array.isArray(videos)) {
      return res.status(400).json({ 
        message: 'Invalid videos data',
        received: req.body 
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
    
    const result: UpdateResult = {
      updated: [],
      notFound: [],
      existingEmbeds: []
    };

    // Process each video
    for (const video of videos) {
      console.log('Processing video:', video.name);
      
      const { rowIndex, hasExistingEmbed } = await findVideoRowAndCheckEmbed(
        sheets.values,
        spreadsheetId,
        sheetName,
        video.name
      );

      if (!rowIndex) {
        result.notFound.push(video.name);
        continue;
      }

      if (hasExistingEmbed) {
        result.existingEmbeds.push({ name: video.name, row: rowIndex });
        continue;
      }

      // Update embed code in column W
      await sheets.values.update({
        spreadsheetId,
        range: `${sheetName}!W${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[video.embed_code]]
        }
      });

      result.updated.push({ name: video.name, row: rowIndex });
    }

    return res.status(200).json({
      success: true,
      message: `تم تحديث ${result.updated.length} فيديو بنجاح`,
      result
    });

  } catch (error) {
    console.error('Error in API handler:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? String(error) : undefined
    });
  }
}
