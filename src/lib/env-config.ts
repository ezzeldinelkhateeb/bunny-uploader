import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import fs from 'fs';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try multiple possible .env file locations
const possiblePaths = [
  resolve(__dirname, '../../../.env'),
  resolve(__dirname, '../../.env'),
  resolve(process.cwd(), '.env')
];

let envPath = '';
for (const path of possiblePaths) {
  if (fs.existsSync(path)) {
    envPath = path;
    break;
  }
}

if (!envPath) {
  console.warn('No .env file found in any of these locations:', possiblePaths);
} else {
  console.log('Loading .env from:', envPath);
  config({ path: envPath });
}

// Debug: Log environment variables (without sensitive data)
console.log('Environment variables loaded:', {
  GOOGLE_SHEETS_SPREADSHEET_ID: process.env.GOOGLE_SHEETS_SPREADSHEET_ID ? '[SET]' : '[NOT SET]',
  GOOGLE_SHEETS_CREDENTIALS_JSON: process.env.GOOGLE_SHEETS_CREDENTIALS_JSON ? '[SET]' : '[NOT SET]',
  GOOGLE_SHEET_NAME: process.env.GOOGLE_SHEET_NAME || 'OPERATIONS'
});

export const envConfig = {
  googleSheets: {
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    sheetName: process.env.GOOGLE_SHEET_NAME || 'OPERATIONS',
    credentials: process.env.GOOGLE_SHEETS_CREDENTIALS_JSON
      ? JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS_JSON)
      : null
  },
  bunny: {
    apiKey: import.meta.env.VITE_BUNNY_API_KEY,
  }
};

// Validate required environment variables
export function validateEnvConfig() {
  const { spreadsheetId, credentials } = envConfig.googleSheets;

  if (!spreadsheetId || !credentials) {
    console.error('Required environment configuration missing:', {
      hasSpreadsheetId: !!spreadsheetId,
      hasCredentials: !!credentials,
      credentialsType: credentials ? typeof credentials : 'null',
    });
    
    const missingVars = [
      !spreadsheetId && 'GOOGLE_SHEETS_SPREADSHEET_ID',
      !credentials && 'GOOGLE_SHEETS_CREDENTIALS_JSON',
    ].filter(Boolean);

    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}\nPlease check your .env file and ensure all required variables are set.`);
  }

  // Validate credentials structure
  const requiredFields = [
    'private_key',
    'client_email',
    'project_id'
  ];

  const missingFields = requiredFields.filter(field => !credentials[field]);
  
  if (missingFields.length > 0) {
    throw new Error(
      `Invalid Google Sheets credentials: missing ${missingFields.join(', ')}\n` +
      'Please ensure your credentials JSON contains all required fields.'
    );
  }

  // Additional optional validations
  if (!credentials.private_key.includes('-----BEGIN PRIVATE KEY-----')) {
    console.warn('Warning: private_key format may be invalid');
  }

  if (!credentials.client_email.includes('@') || !credentials.client_email.includes('.iam.gserviceaccount.com')) {
    console.warn('Warning: client_email format may be invalid');
  }

  if (!envConfig.bunny.apiKey) {
    console.error('Missing required environment variable: VITE_BUNNY_API_KEY');
    return false;
  }

  return true;
}

// Add more specific environment getters
export const getRequiredEnvVar = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
};

export const getOptionalEnvVar = (name: string, defaultValue: string): string => {
  return process.env[name] || defaultValue;
};
