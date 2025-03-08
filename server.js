import express from 'express';
import cors from 'cors';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration based on environment
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['your-production-domain.com'] 
    : ['http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
};

app.use(cors(corsOptions));
app.use(express.json());

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Sheets update endpoint
app.post('/api/sheets/update-bunny-embeds', async (req, res) => {
  try {
    const { videos } = req.body;
    
    if (!Array.isArray(videos)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid videos data' 
      });
    }

    let credentials;
    try {
      credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS_JSON);
    } catch (error) {
      console.error('Error parsing credentials:', error);
      return res.status(500).json({
        success: false,
        message: 'Invalid Google Sheets credentials configuration'
      });
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const sheetName = process.env.GOOGLE_SHEET_NAME || 'OPERATIONS';
    
    const notFoundVideos = [];
    let updatedCount = 0;

    for (const video of videos) {
      try {
        // Get the N column data
        const result = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!N:N`,
        });

        const rows = result.data.values || [];
        let rowIndex = -1;

        // Find matching row
        for (let i = 1; i < rows.length; i++) {
          const cellName = (rows[i]?.[0] || '').trim();
          if (cellName === video.name.split('.')[0].trim()) {
            rowIndex = i + 1;
            break;
          }
        }

        if (rowIndex === -1) {
          notFoundVideos.push(video.name);
          continue;
        }

        // Update the W column with embed code
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!W${rowIndex}`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [[video.embed_code]]
          }
        });

        updatedCount++;
      } catch (error) {
        console.error(`Error processing video ${video.name}:`, error);
        notFoundVideos.push(video.name);
      }
    }

    return res.json({
      success: true,
      message: `تم تحديث ${updatedCount} فيديو بنجاح`,
      details: notFoundVideos.length > 0 
        ? `لم يتم العثور على ${notFoundVideos.length} فيديو في الشيت`
        : undefined,
      not_found_videos: notFoundVideos
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      success: false,
      message: `خطأ في تحديث الشيت: ${error.message}`,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Test endpoint for Google Sheets connection
app.get('/api/test-sheets-connection', async (req, res) => {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS_JSON);
    
    if (!credentials || !process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
      throw new Error('Missing required configuration');
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
      range: `${process.env.GOOGLE_SHEET_NAME || 'OPERATIONS'}!A1:A1`
    });

    res.json({
      success: true,
      message: 'Successfully connected to Google Sheets',
      data: {
        sheetName: process.env.GOOGLE_SHEET_NAME || 'OPERATIONS',
        hasValues: !!response.data.values?.length
      }
    });

  } catch (error) {
    console.error('Google Sheets Test Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to connect to Google Sheets',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Serve index.html for all other routes (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});

// Global error handler
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});
