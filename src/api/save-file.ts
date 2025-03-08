import { Request, Response } from 'express';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { file, path } = req.body;
    const fullPath = join(process.cwd(), path);
    
    // Create directory if it doesn't exist
    mkdirSync(fullPath, { recursive: true });
    
    // Save file
    const filePath = join(fullPath, file.name);
    writeFileSync(filePath, Buffer.from(await file.arrayBuffer()));

    res.status(200).json({ message: 'File saved successfully' });
  } catch (error) {
    console.error('Error saving file:', error);
    res.status(500).json({ message: 'Error saving file' });
  }
}