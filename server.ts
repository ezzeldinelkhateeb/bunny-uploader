import { createServer } from 'http';
import { parse } from 'url';
import { validateEnvConfig } from './src/lib/env-config';

const port = parseInt(process.env.PORT || '5173', 10);

// Validate environment variables on startup
try {
  console.log('Current working directory:', process.cwd());
  console.log('Validating environment configuration...');
  
  if (!validateEnvConfig()) {
    throw new Error('Environment validation failed');
  }
  console.log('Environment configuration validated successfully');
} catch (error) {
  console.error('Environment configuration error:', error);
  console.error('Process environment:', {
    NODE_ENV: process.env.NODE_ENV,
    PWD: process.env.PWD,
    // Add any other relevant non-sensitive env vars
  });
  process.exit(1);
}

const server = createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = parse(req.url!, true);
  
  // Add test-connection endpoint
  if (parsedUrl.pathname === '/api/sheets/test-connection') {
    try {
      const { default: handler } = await import('./api/sheets/test-connection');
      await handler(req as any, res as any);
    } catch (error) {
      console.error('Error handling test connection:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Failed to connect to Google Sheets',
        error: error instanceof Error ? error.message : String(error)
      }));
    }
    return;
  }

  if (parsedUrl.pathname === '/api/sheets/update-bunny-embeds') {
    let body = '';
    req.on('data', chunk => body += chunk);
    
    req.on('end', async () => {
      try {
        // Import the handler dynamically to ensure environment is loaded
        const { default: handler } = await import('./api/sheets/update-bunny-embeds');
        
        const mockReq = {
          method: req.method,
          headers: req.headers,
          body: JSON.parse(body),
        };

        // Create a mock response object that matches Vercel's Response
        const mockRes = {
          setHeader: res.setHeader.bind(res),
          status: (code: number) => {
            res.statusCode = code;
            return mockRes;
          },
          json: (data: any) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
            return mockRes;
          },
          end: () => {
            res.end();
            return mockRes;
          }
        };

        await handler(mockReq as any, mockRes as any);
      } catch (error) {
        console.error('Error handling request:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          message: 'Internal server error',
          error: process.env.NODE_ENV === 'development' ? String(error) : undefined
        }));
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(port, () => {
  console.log(`> Ready on http://localhost:${port}`);
});
