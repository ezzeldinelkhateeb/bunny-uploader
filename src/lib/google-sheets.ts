import { googleSheetsService as importedService } from './google-sheets-service';
/// <reference path="../types/gapi.d.ts" />

class GoogleSheetsService {
  async getSpreadsheet(spreadsheetId: string) {
    try {
      const response = await window.gapi.client.sheets.spreadsheets.get({
        spreadsheetId,
      });
      return response.result;
    } catch (error) {
      console.error('Error getting spreadsheet:', error);
      throw error;
    }
  }

  async updateValues(
    spreadsheetId: string,
    range: string,
    values: any[][]
  ) {
    try {
      await window.gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        resource: { values },
      });
    } catch (error) {
      console.error('Error updating values:', error);
      throw error;
    }
  }
}

export const googleSheetsService = new GoogleSheetsService();

export async function loadSheets(spreadsheetId: string) {
  try {
    const response = await window.gapi.client.sheets.spreadsheets.get({
      spreadsheetId
    });
    return response.result.sheets.map((s: any) => s.properties.title);
  } catch (error) {
    console.error('Error loading sheets:', error);
    return [];
  }
}

export async function updateCell(
  spreadsheetId: string,
  range: string,
  value: string
) {
  try {
    await window.gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      resource: {
        values: [[value]]
      }
    });
    return true;
  } catch (error) {
    console.error('Error updating cell:', error);
    return false;
  }
}

export async function listSpreadsheets() {
  try {
    const response = await window.gapi.client.drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet'",
      fields: 'files(id, name)'
    });

    return response.result.files.map((file) => ({
      id: file.id,
      name: file.name
    }));
  } catch (error) {
    console.error('Error listing spreadsheets:', error);
    return [];
  }
}