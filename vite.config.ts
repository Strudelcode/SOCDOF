import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import os from 'os';
import { defineConfig, Plugin } from 'vite';

// In-memory store for mobile sync sessions
const mobileSyncStore = new Map<string, { payload: any; timestamp: number }>();

function mobileSyncPlugin(): Plugin {
  return {
    name: 'mobile-sync-api',
    configureServer(server) {
      // Helper to parse JSON body
      const parseJsonBody = (req: any): Promise<any> => {
        return new Promise((resolve, reject) => {
          let body = '';
          req.on('data', (chunk: any) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              if (!body.trim()) return resolve({});
              resolve(JSON.parse(body));
            } catch (err) {
              reject(err);
            }
          });
          req.on('error', reject);
        });
      };

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        
        // Route: GET /api/mobile-sync/info (Discover local LAN IP addresses)
        if (url.pathname === '/api/mobile-sync/info' && req.method === 'GET') {
          const networkInterfaces = os.networkInterfaces();
          const localIps: string[] = [];

          for (const iface of Object.values(networkInterfaces)) {
            if (iface) {
              for (const config of iface) {
                if (config.family === 'IPv4' && !config.internal) {
                  // Exclude APIPA (169.254.x.x) autoconfig addresses
                  if (!config.address.startsWith('169.254.')) {
                    localIps.push(config.address);
                  }
                }
              }
            }
          }

          // Sort LAN IPs: 192.168.* first, then 10.*, then 172.*
          localIps.sort((a, b) => {
            const score = (ip: string) => {
              if (ip.startsWith('192.168.')) return 1;
              if (ip.startsWith('10.')) return 2;
              if (ip.startsWith('172.')) return 3;
              return 4;
            };
            return score(a) - score(b);
          });

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({
            status: 'ok',
            ips: localIps,
            port: 3000,
            primaryIp: localIps[0] || '127.0.0.1'
          }));
          return;
        }

        // Route: CORS preflight
        if (url.pathname === '/api/mobile-sync' && req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-App-Source, X-App-Version, X-Device-Id, X-Export-Timestamp');
          res.statusCode = 204;
          res.end();
          return;
        }

        // Route: POST /api/mobile-sync (Mobile App uploads data)
        if (url.pathname === '/api/mobile-sync' && req.method === 'POST') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Content-Type', 'application/json');

          try {
            const body = await parseJsonBody(req);
            
            // Extract token from query, header, or body
            const authHeader = req.headers['authorization'] || '';
            const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
            const token = url.searchParams.get('token') || bearerToken || body.token || body.session_id || 'default';

            // Store in memory
            mobileSyncStore.set(token, {
              payload: body,
              timestamp: Date.now()
            });

            // Also store under 'latest'
            mobileSyncStore.set('latest', {
              payload: body,
              timestamp: Date.now()
            });

            const sessionCount = body.sessions?.length || body.tickets?.length || 0;
            const tripCount = body.trips?.length || 0;

            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              message: `Synchronisation erfolgreich! ${sessionCount} Einsätze und ${tripCount} Fahrten an SOCDOF Desktop übertragen.`,
              receivedSessions: sessionCount,
              receivedTrips: tripCount,
              timestamp: new Date().toISOString()
            }));
          } catch (err: any) {
            res.statusCode = 400;
            res.end(JSON.stringify({
              success: false,
              error: 'Invalid JSON payload',
              message: err.message
            }));
          }
          return;
        }

        // Route: GET /api/mobile-sync (Desktop App polls for data)
        if (url.pathname === '/api/mobile-sync' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');

          const token = url.searchParams.get('token') || 'latest';
          const session = mobileSyncStore.get(token) || (token !== 'latest' ? mobileSyncStore.get('latest') : null);

          if (session && Date.now() - session.timestamp < 1000 * 60 * 15) { // 15 min freshness
            // If requested with &consume=true, remove it
            if (url.searchParams.get('consume') === 'true') {
              mobileSyncStore.delete(token);
              mobileSyncStore.delete('latest');
            }

            res.statusCode = 200;
            res.end(JSON.stringify({
              ready: true,
              timestamp: session.timestamp,
              payload: session.payload
            }));
          } else {
            res.statusCode = 200;
            res.end(JSON.stringify({
              ready: false,
              message: 'Waiting for mobile app transmission...'
            }));
          }
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), mobileSyncPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
