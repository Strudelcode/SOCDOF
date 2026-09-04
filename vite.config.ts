import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { defineConfig, Plugin } from 'vite';

// In-memory store for mobile sync sessions
const mobileSyncStore = new Map<string, { payload: any; timestamp: number }>();
const recentSyncQueue: Array<{ token: string; payload: any; timestamp: number }> = [];

function mobileSyncPlugin(): Plugin {
  return {
    name: 'mobile-sync-api',
    configureServer(server) {
      // Helper to parse body (JSON, urlencoded, text, or query params)
      const parseRequestBody = (req: any): Promise<any> => {
        return new Promise((resolve) => {
          let body = '';
          req.on('data', (chunk: any) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              if (!body.trim()) return resolve({});
              
              // 1. Try standard JSON
              try {
                return resolve(JSON.parse(body));
              } catch {}

              // 2. Try URL-encoded payload (data=... or payload=...)
              if (body.includes('=')) {
                try {
                  const params = new URLSearchParams(body);
                  const payloadStr = params.get('payload') || params.get('data') || params.get('json');
                  if (payloadStr) {
                    return resolve(JSON.parse(payloadStr));
                  }
                } catch {}
              }

              // 3. Try base64 decoded JSON
              try {
                const decoded = Buffer.from(body.trim(), 'base64').toString('utf-8');
                return resolve(JSON.parse(decoded));
              } catch {}

              // Fallback raw text wrapper
              resolve({ raw_text: body });
            } catch (err) {
              resolve({ error: String(err), raw_body: body });
            }
          });
          req.on('error', () => resolve({}));
        });
      };

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
        const cleanPath = url.pathname.replace(/\/+$/, '') || '/';
        
        // Universal CORS & Private Network Access Headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS, HEAD, DELETE');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Access-Control-Allow-Private-Network', 'true');

        // Route: CORS preflight for any mobile-sync route
        if (cleanPath.startsWith('/api/mobile-sync') && req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        // Route: GET /api/mobile-sync/info (Discover local LAN IP addresses)
        if (cleanPath === '/api/mobile-sync/info' && req.method === 'GET') {
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
          res.end(JSON.stringify({
            status: 'ok',
            ips: localIps,
            port: 3000,
            primaryIp: localIps[0] || '127.0.0.1',
            serverTime: new Date().toISOString()
          }));
          return;
        }

        // Route: GET /api/mobile-sync/ping or /api/mobile-sync/test (Diagnostics)
        if ((cleanPath === '/api/mobile-sync/ping' || cleanPath === '/api/mobile-sync/test') && (req.method === 'GET' || req.method === 'POST')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            status: 'online',
            service: 'SOCDOF Mobile Companion Sync Gateway',
            version: '21.7.0',
            activeSessionsCount: mobileSyncStore.size,
            recentQueueCount: recentSyncQueue.length,
            serverTimestamp: new Date().toISOString(),
            message: 'SOCDOF Sync Gateway is active, ready and reachable!'
          }));
          return;
        }

        // Route: POST / PUT /api/mobile-sync or /api/mobile-sync/upload (Mobile App uploads data)
        if ((cleanPath === '/api/mobile-sync' || cleanPath === '/api/mobile-sync/upload' || cleanPath === '/api/mobile-sync/submit') && (req.method === 'POST' || req.method === 'PUT')) {
          res.setHeader('Content-Type', 'application/json');

          try {
            const body = await parseRequestBody(req);
            
            // Check query param data if body was empty
            const queryData = url.searchParams.get('data') || url.searchParams.get('payload') || url.searchParams.get('json');
            let effectivePayload = body;
            if (queryData && Object.keys(body).length === 0) {
              try {
                effectivePayload = JSON.parse(queryData);
              } catch {
                effectivePayload = { raw_query: queryData };
              }
            }

            // Extract token from query, header, or body
            const authHeader = (req.headers['authorization'] || '') as string;
            const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
            const token = url.searchParams.get('token') || bearerToken || effectivePayload.token || effectivePayload.session_id || effectivePayload.sessionId || 'default';
            const normalizedToken = token.trim();

            const syncItem = {
              payload: effectivePayload,
              timestamp: Date.now()
            };

            // Store in memory across identifiers
            mobileSyncStore.set(normalizedToken, syncItem);
            mobileSyncStore.set(normalizedToken.toUpperCase(), syncItem);
            mobileSyncStore.set(normalizedToken.toLowerCase(), syncItem);
            mobileSyncStore.set('latest', syncItem);

            if (effectivePayload.deviceId) {
              mobileSyncStore.set(`device_${effectivePayload.deviceId}`, syncItem);
            }

            recentSyncQueue.unshift({ token: normalizedToken, ...syncItem });
            if (recentSyncQueue.length > 20) recentSyncQueue.pop();

            const sessionCount = effectivePayload.sessions?.length || effectivePayload.tickets?.length || effectivePayload.records?.length || 0;
            const tripCount = effectivePayload.trips?.length || effectivePayload.fahrten?.length || 0;

            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              message: `Synchronisation erfolgreich! ${sessionCount} Einsätze und ${tripCount} Fahrten an SOCDOF übertragen.`,
              receivedSessions: sessionCount,
              receivedTrips: tripCount,
              pairedToken: normalizedToken,
              timestamp: new Date().toISOString()
            }));
          } catch (err: any) {
            res.statusCode = 200; // Return 200 with soft error so mobile apps don't crash
            res.end(JSON.stringify({
              success: false,
              error: 'Processing payload issue',
              message: err?.message || 'Unknown error'
            }));
          }
          return;
        }

        // Route: GET /api/mobile-sync (Desktop App polls for data or browser test)
        if (cleanPath === '/api/mobile-sync' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');

          const token = (url.searchParams.get('token') || 'latest').trim();
          let session = mobileSyncStore.get(token) || 
                        mobileSyncStore.get(token.toUpperCase()) || 
                        mobileSyncStore.get(token.toLowerCase()) || 
                        (token !== 'latest' ? mobileSyncStore.get('latest') : null);

          // If no specific session found, check unread recent queue
          if (!session && recentSyncQueue.length > 0) {
            const recent = recentSyncQueue[0];
            if (Date.now() - recent.timestamp < 1000 * 60 * 15) {
              session = recent;
            }
          }

          if (session && Date.now() - session.timestamp < 1000 * 60 * 20) { // 20 min freshness
            // If requested with &consume=true, remove it
            if (url.searchParams.get('consume') === 'true') {
              mobileSyncStore.delete(token);
              mobileSyncStore.delete(token.toUpperCase());
              mobileSyncStore.delete(token.toLowerCase());
              mobileSyncStore.delete('latest');
              const idx = recentSyncQueue.findIndex(q => q.token === token);
              if (idx >= 0) recentSyncQueue.splice(idx, 1);
            }

            res.statusCode = 200;
            res.end(JSON.stringify({
              ready: true,
              timestamp: session.timestamp,
              payload: session.payload,
              token: token
            }));
          } else {
            res.statusCode = 200;
            res.end(JSON.stringify({
              ready: false,
              status: 'listening',
              message: 'Waiting for mobile companion transmission...',
              serverTime: new Date().toISOString()
            }));
          }
          return;
        }

        next();
      });
    }
  };
}

function languageSyncPlugin(): Plugin {
  return {
    name: 'language-sync-api',
    configureServer(server) {
      const langDir = path.join(process.cwd(), 'public', 'languages');
      const flagsDir = path.join(langDir, 'flags');

      if (!fs.existsSync(langDir)) fs.mkdirSync(langDir, { recursive: true });
      if (!fs.existsSync(flagsDir)) fs.mkdirSync(flagsDir, { recursive: true });

      const sseClients = new Set<(payload: any) => void>();

      const broadcastChange = (data: any) => {
        for (const send of sseClients) {
          try {
            send(data);
          } catch {}
        }
      };

      // Set up watchers with debouncing
      let debounceTimer: any = null;
      const notifyDebounced = (eventType: string, filename: string) => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          broadcastChange({
            type: 'change',
            eventType,
            filename: String(filename || ''),
            timestamp: Date.now()
          });
        }, 200);
      };

      try {
        fs.watch(langDir, (eventType, filename) => {
          notifyDebounced(eventType, String(filename || ''));
        });
      } catch (err) {
        console.warn('Could not watch public/languages:', err);
      }

      try {
        fs.watch(flagsDir, (eventType, filename) => {
          notifyDebounced(eventType, String(filename || ''));
        });
      } catch (err) {
        console.warn('Could not watch public/languages/flags:', err);
      }

      const getFlagMime = (filePath: string) => {
        const ext = path.extname(filePath).toLowerCase();
        switch (ext) {
          case '.png': return 'image/png';
          case '.jpg':
          case '.jpeg': return 'image/jpeg';
          case '.svg': return 'image/svg+xml';
          case '.webp': return 'image/webp';
          case '.gif': return 'image/gif';
          default: return 'application/octet-stream';
        }
      };

      const readAllFlags = () => {
        const flagMap: Record<string, string> = {};
        if (!fs.existsSync(flagsDir)) return flagMap;
        try {
          const files = fs.readdirSync(flagsDir);
          for (const file of files) {
            const ext = path.extname(file).toLowerCase();
            if (!['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif'].includes(ext)) continue;
            const code = path.basename(file, ext).toLowerCase();
            const fullPath = path.join(flagsDir, file);
            try {
              const fileData = fs.readFileSync(fullPath);
              const mime = getFlagMime(fullPath);
              flagMap[code] = `data:${mime};base64,${fileData.toString('base64')}`;
            } catch {}
          }
        } catch {}
        return flagMap;
      };

      const readAllLanguages = () => {
        const results: any[] = [];
        const flagsMap = readAllFlags();
        if (!fs.existsSync(langDir)) return { files: results, flags: flagsMap };

        try {
          const files = fs.readdirSync(langDir);
          for (const file of files) {
            if (!file.toLowerCase().endsWith('.json')) continue;
            if (file.toLowerCase().startsWith('template')) continue;
            const fullPath = path.join(langDir, file);
            try {
              const stats = fs.statSync(fullPath);
              if (!stats.isFile()) continue;
              const content = fs.readFileSync(fullPath, 'utf8');
              const parsed = JSON.parse(content);

              let dict: Record<string, string> = {};
              if (parsed.translations && typeof parsed.translations === 'object') {
                dict = parsed.translations;
              } else if (typeof parsed === 'object') {
                dict = parsed;
              }

              const metadata = parsed._metadata || {};
              const cleanTranslations: Record<string, string> = {};
              for (const [k, v] of Object.entries(dict)) {
                if (!k.startsWith('_') && typeof v === 'string') {
                  cleanTranslations[k] = v;
                }
              }

              const baseId = file.replace(/\.json$/i, '');
              const flagKey = (metadata.language_code || baseId).toLowerCase();
              const flagImg = flagsMap[flagKey] || flagsMap[baseId.toLowerCase()] || null;

              results.push({
                filename: file,
                id: baseId,
                title: metadata.title || metadata.language_name || baseId,
                language_name: metadata.language_name || baseId,
                language_code: metadata.language_code || baseId,
                emoji: metadata.emoji || metadata.flag || null,
                flagImage: flagImg,
                count: Object.keys(cleanTranslations).length,
                lastModified: stats.mtimeMs,
                translations: cleanTranslations,
                isBuiltInOverride: ['en', 'de', 'fr', 'es'].includes(baseId.toLowerCase())
              });
            } catch (err) {
              console.warn(`Error reading language file ${file}:`, err);
            }
          }
        } catch (err) {
          console.warn('Error reading languages directory:', err);
        }

        return { files: results, flags: flagsMap };
      };

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
        const cleanPath = url.pathname.replace(/\/+$/, '') || '/';

        if (cleanPath === '/api/languages/events' && req.method === 'GET') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
          });
          res.write(': connected\n\n');

          const clientSender = (payload: any) => {
            try {
              res.write(`event: change\ndata: ${JSON.stringify(payload)}\n\n`);
            } catch {}
          };
          sseClients.add(clientSender);

          req.on('close', () => {
            sseClients.delete(clientSender);
          });
          return;
        }

        if (cleanPath === '/api/languages' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          const data = readAllLanguages();
          res.end(JSON.stringify({
            success: true,
            files: data.files,
            flags: data.flags,
            timestamp: Date.now()
          }));
          return;
        }

        if (cleanPath === '/api/languages/flags' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          const flags = readAllFlags();
          res.end(JSON.stringify({
            success: true,
            flags,
            timestamp: Date.now()
          }));
          return;
        }

        if (cleanPath === '/api/languages/save' && req.method === 'POST') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          try {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const parsed = JSON.parse(body);
                const filename = (parsed.filename || '').replace(/[^a-zA-Z0-9_\-\.]/g, '');
                if (!filename.toLowerCase().endsWith('.json')) {
                  res.statusCode = 400;
                  return res.end(JSON.stringify({ success: false, error: 'Filename must end with .json' }));
                }
                const targetPath = path.join(langDir, filename);
                const content = typeof parsed.content === 'string' ? parsed.content : JSON.stringify(parsed.content, null, 2);
                fs.writeFileSync(targetPath, content, 'utf8');
                broadcastChange({ type: 'change', filename, timestamp: Date.now() });
                res.end(JSON.stringify({ success: true, filename, path: targetPath }));
              } catch (err: any) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: err.message }));
              }
            });
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
          return;
        }

        if (cleanPath === '/api/languages/upload-flag' && req.method === 'POST') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          try {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const parsed = JSON.parse(body);
                const code = (parsed.code || 'custom').toLowerCase().replace(/[^a-z0-9_\-]/g, '');
                const dataUrl = parsed.dataUrl || parsed.base64 || '';
                
                let ext = '.png';
                if (dataUrl.includes('image/jpeg') || dataUrl.includes('image/jpg')) ext = '.jpg';
                else if (dataUrl.includes('image/svg')) ext = '.svg';
                else if (dataUrl.includes('image/webp')) ext = '.webp';
                
                const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');
                const targetPath = path.join(flagsDir, `${code}${ext}`);
                fs.writeFileSync(targetPath, buffer);
                broadcastChange({ type: 'flag-change', code, timestamp: Date.now() });
                res.end(JSON.stringify({ success: true, code, ext, path: targetPath }));
              } catch (err: any) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: err.message }));
              }
            });
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: err.message }));
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
    plugins: [react(), tailwindcss(), mobileSyncPlugin(), languageSyncPlugin()],
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
