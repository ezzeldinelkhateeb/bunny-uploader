import { NextApiRequest, NextApiResponse } from 'next';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const configPath = join(process.cwd(), 'src', 'config');
    const files = readdirSync(configPath);
    
    // Get the most recent config file
    const latestFile = files
      .filter(f => f.startsWith('library_data_'))
      .sort()
      .reverse()[0];

    if (!latestFile) {
      return res.status(404).json({ message: 'No configuration found' });
    }

    const filePath = join(configPath, latestFile);
    const data = JSON.parse(readFileSync(filePath, 'utf8'));

    res.status(200).json(data);
  } catch (error) {
    console.error('Error loading configuration:', error);
    res.status(500).json({ message: 'Error loading configuration' });
  }
}