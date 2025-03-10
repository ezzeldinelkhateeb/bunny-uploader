interface VideoData {
  name: string;
  embed_code: string;
}

interface UpdateResponse {
  message: string;
  not_found_videos?: string[];
  details?: string;
  stats?: {
    total: number;
    updated: number;
    notFound: number;
    skipped: number;
  };
}

interface BatchUpdateResult {
  rowIndex?: number;
  videoName: string;
  status: 'updated' | 'notFound' | 'skipped';
}

interface ApiResponse {
  success: boolean;
  message: string;
  results?: BatchUpdateResult[];
  notFoundVideos?: string[];
  stats?: {
    updated: number;
    notFound: number;
    skipped: number;
  };
}

interface BandwidthData {
  Date: string;
  'Bandwidth (GB)': string;
  'Cost ($)': string;
}

class GoogleSheetsService {
  private baseUrl = '/api/sheets';
  private lastNotFoundVideos: string[] = [];
  private lastSkippedVideos: string[] = [];

  async updateEmbedsInSheet(videos: VideoData[]): Promise<UpdateResponse> {
    try {
      if (!Array.isArray(videos) || videos.length === 0) {
        throw new Error('No videos selected for update');
      }

      const response = await fetch(`${this.baseUrl}/update-bunny-embeds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videos })
      });

      const data = await response.json() as ApiResponse;

      // Store the videos for message generation
      this.lastNotFoundVideos = data.notFoundVideos || [];
      this.lastSkippedVideos = data.results
        ?.filter(r => r.status === 'skipped')
        .map(r => r.videoName) || [];

      // Remove success check that was blocking updates
      const stats = {
        total: videos.length,
        updated: data.stats?.updated || 0,
        notFound: data.stats?.notFound || 0,
        skipped: data.stats?.skipped || 0
      };

      return {
        message: this.generateSummaryMessage(stats),
        not_found_videos: data.notFoundVideos || [],
        stats
      };

    } catch (error) {
      console.error('Error updating Google Sheets:', error);
      throw error;
    }
  }

  async updateBandwidthStats(data: BandwidthData[]): Promise<void> {
    try {
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('No bandwidth data to update');
      }

      const response = await fetch(`${this.baseUrl}/update-bandwidth-stats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update bandwidth statistics');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Update failed');
      }

    } catch (error) {
      console.error('Error updating bandwidth stats:', error);
      throw error;
    }
  }

  private generateSummaryMessage(stats: { total: number; updated: number; notFound: number; skipped: number }): string {
    const summary = [];

    // Always show total attempted
    summary.push(`Total videos processed: ${stats.total}`);

    // Add update status
    if (stats.updated > 0) {
      summary.push(`✅ Updated: ${stats.updated} videos`);
    }

    // Add not found details
    if (this.lastNotFoundVideos.length > 0) {
      summary.push('\n❌ Not Found Videos:');
      summary.push(this.lastNotFoundVideos.map(name => `• ${name}`).join('\n'));
    }

    // Add skipped details
    if (this.lastSkippedVideos.length > 0) {
      summary.push('\n⚠️ Already Had Links:');
      summary.push(this.lastSkippedVideos.map(name => `• ${name}`).join('\n'));
    }

    return summary.join('\n');
  }
}

export const googleSheetsService = new GoogleSheetsService();
