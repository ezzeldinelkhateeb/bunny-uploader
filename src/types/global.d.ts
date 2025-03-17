/// <reference types="gapi" />
/// <reference types="gapi.auth2" />
/// <reference types="google.accounts" />

import type { GoogleAuth } from 'gapi.auth2';
import type { ClientConfig } from 'gapi.auth2';

declare global {
  interface Window {
    gapi: typeof gapi & {
      auth2: {
        getAuthInstance: () => GoogleAuth;
        init(params: ClientConfig): Promise<GoogleAuth>;
      };
      client: {
        drive: {
          files: {
            list: (params: {
              q: string;
              fields: string;
            }) => Promise<{
              result: {
                files: Array<{ id: string; name: string }>;
              };
            }>;
          };
        };
        sheets: {
          spreadsheets: {
            get: (params: any) => Promise<any>;
            values: {
              update: (params: any) => Promise<any>;
            };
          };
        };
      };
    };
    google: typeof google;
  }
}

export {};