export class BunnyService {
  private baseUrl = "/bunny-api"; // Updated to use proxy

  private async fetchWithError(
    url: string,
    options: RequestInit = {}
  ): Promise<any> {
    try {
      const response = await fetch(url.replace('https://video.bunnycdn.com', '/bunny-api'), {
        ...options,
        headers: {
          ...options.headers,
          'Accept': 'application/json',
          'Content-Type': options.method === 'PUT' ? 'application/octet-stream' : 'application/json',
        },
        credentials: 'same-origin'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching ${url}:`, error);
      throw error;
    }
  }

  // Rest of your service implementation remains the same
}