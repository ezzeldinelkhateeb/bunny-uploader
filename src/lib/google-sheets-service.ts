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

class GoogleSheetsService {
  private baseUrl = '/api/sheets';
  private readonly BATCH_SIZE = 50;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second

  private cleanVideoName(name: string): string {
    return name.split('.')[0].trim().toLowerCase();
  }

  private createBatchUpdateBody(updates: { rowIndex: number; embedCode: string }[]) {
    return {
      data: updates.map(update => ({
        range: `W${update.rowIndex}`,
        values: [[update.embedCode]]
      })),
      valueInputOption: 'RAW'
    };
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    retryCount = 0
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (retryCount < this.MAX_RETRIES) {
        console.warn(`Retrying operation (attempt ${retryCount + 1}/${this.MAX_RETRIES})...`);
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        return this.retryOperation(operation, retryCount + 1);
      }
      throw error;
    }
  }

  async updateEmbedsInSheet(videos: VideoData[]): Promise<UpdateResponse> {
    try {
      if (!Array.isArray(videos) || videos.length === 0) {
        throw new Error('No videos provided for update');
      }

      const stats = {
        total: videos.length,
        updated: 0,
        notFound: 0,
        skipped: 0
      };

      // Process videos in batches
      const batches = [];
      for (let i = 0; i < videos.length; i += this.BATCH_SIZE) {
        batches.push(videos.slice(i, i + this.BATCH_SIZE));
      }

      const results: BatchUpdateResult[] = [];
      const notFoundVideos: string[] = [];
      let batchNumber = 1;
      const totalBatches = batches.length;

      for (const batch of batches) {
        try {
          await this.retryOperation(async () => {
            const response = await fetch(`${this.baseUrl}/update-bunny-embeds`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                videos: batch,
                batchIndex: batchNumber - 1,
                totalBatches
              }),
              credentials: 'same-origin'
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Batch ${batchNumber}/${totalBatches} failed (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            
            if (!data.success) {
              throw new Error(data.message || `Batch ${batchNumber}/${totalBatches} failed`);
            }

            // Safely update stats and collect results
            if (data.result) {
              if (Array.isArray(data.result.updated)) {
                stats.updated += data.result.updated.length;
                results.push(...data.result.updated.map((item: any) => ({
                  rowIndex: item.row,
                  videoName: item.name,
                  status: 'updated'
                })));
              }

              if (Array.isArray(data.result.notFound)) {
                stats.notFound += data.result.notFound.length;
                notFoundVideos.push(...data.result.notFound);
                results.push(...data.result.notFound.map((name: string) => ({
                  videoName: name,
                  status: 'notFound'
                })));
              }

              if (Array.isArray(data.result.existingEmbeds)) {
                stats.skipped += data.result.existingEmbeds.length;
                results.push(...data.result.existingEmbeds.map((item: any) => ({
                  rowIndex: item.row,
                  videoName: item.name,
                  status: 'skipped'
                })));
              }
            }
          });

          batchNumber++;

        } catch (error) {
          console.error(`Fatal error in batch ${batchNumber}/${totalBatches}:`, error);
          throw error;
        }
      }

      return {
        message: this.generateSummaryMessage(stats),
        not_found_videos: notFoundVideos,
        details: this.generateUpdateDetails(results),
        stats
      };

    } catch (error) {
      console.error('Error updating Google Sheets:', error);
      throw new Error(`Sheet update failed: ${error.message}`);
    }
  }

  private generateSummaryMessage(stats: UpdateResponse['stats']): string {
    const total = stats.total;
    const completed = stats.updated + stats.notFound + stats.skipped;
    const progress = Math.round((completed / total) * 100);
    
    const parts = [];
    if (stats.updated > 0) parts.push(`✅ ${stats.updated} updated`);
    if (stats.notFound > 0) parts.push(`⚠️ ${stats.notFound} not found`);
    if (stats.skipped > 0) parts.push(`ℹ️ ${stats.skipped} skipped`);
    
    return `Update complete (${progress}%): ${parts.join(' | ')}`;
  }

  private generateUpdateDetails(results: BatchUpdateResult[]): string {
    if (!Array.isArray(results)) return 'No detailed results available';

    const updated = results
      .filter(r => r.status === 'updated')
      .map(r => `✅ Row ${r.rowIndex}: ${r.videoName}`);
    
    const notFound = results
      .filter(r => r.status === 'notFound')
      .map(r => `⚠️ Not found: ${r.videoName}`);
    
    const skipped = results
      .filter(r => r.status === 'skipped')
      .map(r => `ℹ️ Skipped row ${r.rowIndex}: ${r.videoName}`);

    return [...updated, ...notFound, ...skipped].join('\n');
  }
}

export const googleSheetsService = new GoogleSheetsService();
