import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

function validateEnv() {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS_JSON);
    console.log('✅ Credentials JSON is valid');
    return true;
  } catch (error) {
    console.error('❌ Invalid credentials JSON:', error);
    return false;
  }
}

validateEnv();