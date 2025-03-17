declare namespace gapi.client {
  interface Drive {
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
  }

  const drive: Drive;
}
