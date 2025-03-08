import { google } from 'googleapis';
import type { Request, Response } from 'express';
import { envConfig } from '../../src/lib/env-config';

export default async function handler(req: Request, res: Response) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { credentials, spreadsheetId, sheetName } = envConfig.googleSheets;

    if (!credentials || !spreadsheetId) {
      throw new Error('Missing required configuration');
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Try to read a small range to test connection
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:A1`
    });

    return res.status(200).json({
      success: true,
      message: 'Successfully connected to Google Sheets',
      data: {
        sheetName,
        hasValues: !!response.data.values?.length
      }
    });

  } catch (error) {
    console.error('Connection test error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to connect to Google Sheets',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
