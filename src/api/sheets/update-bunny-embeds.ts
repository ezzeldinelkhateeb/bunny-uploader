import { google } from 'googleapis';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import cors from 'cors';
import { Request, Response } from 'express';
import { googleSheetsService } from "@/lib/google-sheets-service";
import { bunnyService } from "@/lib/bunny-service";

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME || 'OPERATIONS';

export default async function handler(req: Request, res: Response) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { videos } = req.body;

    if (!Array.isArray(videos)) {
      return res.status(400).json({ message: 'Invalid videos data' });
    }

    // Validate environment variables
    if (!process.env.GOOGLE_SHEETS_CREDENTIALS_JSON) {
      throw new Error('Google Sheets credentials not configured');
    }

    if (!process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
      throw new Error('Spreadsheet ID not configured');
    }

    const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS_JSON || '{}');
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: SCOPES,
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Get existing data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:C`,
    });

    const rows = response.data.values || [];
    const notFoundVideos: string[] = [];
    let updatedCount = 0;

    // Update embed codes
    for (const video of videos) {
      const rowIndex = rows.findIndex(row => row[0] === video.name);
      if (rowIndex === -1) {
        notFoundVideos.push(video.name);
        continue;
      }

      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!C${rowIndex + 1}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[video.embed_code]]
        }
      });

      updatedCount++;
    }

    return res.status(200).json({
      message: `Successfully updated ${updatedCount} videos`,
      not_found_videos: notFoundVideos
    });

  } catch (error) {
    console.error('Error updating sheet:', error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? String(error) : undefined
    });
  }
}

export async function updateBunnyEmbeds(req, res) {
  try {
    const { libraryId, collectionId, accessToken } = req.body;

    if (!libraryId || !collectionId || !accessToken) {
      return res.status(400).json({ message: "Missing required parameters" });
    }

    const embedCodes = await bunnyService.getBunnyEmbedCodes(libraryId, accessToken, collectionId);

    const updateResult = await googleSheetsService.updateEmbedsInSheet(embedCodes);

    res.status(200).json(updateResult);
  } catch (error) {
    console.error("Error updating Bunny embeds:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
