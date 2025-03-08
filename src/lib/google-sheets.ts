import { googleSheetsService } from './google-sheets-service';

declare global {
  interface Window {
    gapi: {
      client: {
        sheets: {
          spreadsheets: {
            get: (params: any) => Promise<any>;
            values: {
              update: (params: any) => Promise<any>;
            };
          };
        };
        drive: {
          files: {
            list: (params: any) => Promise<any>;
          };
        };
      };
    };
  }
}

export class GoogleSheetsService {
  async listFiles() {
    try {
      const response = await window.gapi.client.drive.files.list({
        pageSize: 10,
        fields: 'nextPageToken, files(id, name)',
      });
      return response.result.files;
    } catch (error) {
      console.error('Error listing files:', error);
      return [];
    }
  }

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

export async function listSpreadsheets() {
  try {
    const response = await window.gapi.client.drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet'",
      fields: 'files(id, name)'
    });
    return response.result.files;
  } catch (error) {
    console.error('Error listing spreadsheets:', error);
    return [];
  }
}

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