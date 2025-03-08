declare global {
  interface Window {
    gapi: typeof gapi & {
      auth2: {
        getAuthInstance: () => gapi.auth2.GoogleAuth;
        init(params: gapi.auth2.ClientConfig): Promise<gapi.auth2.GoogleAuth>;
      };
      client: {
        init: (config: any) => Promise<void>;
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
    google: typeof google;
  }
}

export {};