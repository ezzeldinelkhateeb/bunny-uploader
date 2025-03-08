import { writeFile } from 'fs/promises';
import { join } from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // تحديد مسار الملف في مجلد التكوين
    const configPath = join(process.cwd(), 'src', 'config', 'bunny-config.enc.json');
    
    // حفظ الملف بتنسيق جميل
    await writeFile(configPath, JSON.stringify(req.body, null, 2), 'utf8');
    
    res.status(200).json({ 
      message: 'Configuration saved successfully',
      path: configPath
    });
  } catch (error) {
    console.error('Error saving configuration:', error);
    res.status(500).json({ message: 'Error saving configuration' });
  }
}