import { google } from 'googleapis';
import { envConfig } from './env-config';

export async function getGoogleAuthClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS_JSON || '{}');
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return auth.getClient();
}
