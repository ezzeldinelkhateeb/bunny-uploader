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
    };
    google: typeof google;
  }
}

export {};