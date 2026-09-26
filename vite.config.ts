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

function discordFeedbackPlugin(): Plugin {
  // In-memory cache for channel available tags
  const forumTagsCache = new Map<string, { tags: any[]; timestamp: number }>();

  const fetchChannelTags = async (channelId: string, botToken: string): Promise<any[]> => {
    const cached = forumTagsCache.get(channelId);
    if (cached && Date.now() - cached.timestamp < 1000 * 60 * 5) {
      return cached.tags;
    }
    try {
      const resp = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
        headers: {
          'Authorization': `Bot ${botToken}`,
          'Content-Type': 'application/json'
        }
      });
      if (resp.ok) {
        const data = await resp.json();
        const availableTags = data.available_tags || [];
        forumTagsCache.set(channelId, { tags: availableTags, timestamp: Date.now() });
        return availableTags;
      }
    } catch (err) {
      console.warn(`Failed to fetch Discord channel tags for ${channelId}:`, err);
    }
    return cached?.tags || [];
  };

  return {
    name: 'discord-feedback-api',
    configureServer(server) {
      const parseRequestBody = (req: any): Promise<any> => {
        return new Promise((resolve) => {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', () => {
            try {
              resolve(body ? JSON.parse(body) : {});
            } catch {
              resolve({});
            }
          });
          req.on('error', () => resolve({}));
        });
      };

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
        const cleanPath = url.pathname.replace(/\/+$/, '') || '/';

        // Endpoint: POST /api/discord/thread (Create forum post)
        if (cleanPath === '/api/discord/thread' && req.method === 'POST') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');

          try {
            const body = await parseRequestBody(req);
            const channelId = body.channelId || '1535709136363462757';
            const threadData = body.threadData;
            const botToken = body.botToken || 'MTQ5ODc2NDAzMzUxODczNTQ0MQ.Gy2MgH.ByHf3S1es7Zg48_ppLuM_ggNrVqXGMc7VJtczE';

            if (!threadData) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: 'threadData is required' }));
              return;
            }

            const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/threads`, {
              method: 'POST',
              headers: {
                'Authorization': `Bot ${botToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(threadData)
            });

            const respText = await response.text();
            let parsedData: any = {};
            try {
              parsedData = JSON.parse(respText);
            } catch {
              parsedData = { raw: respText };
            }

            if (response.ok) {
              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                threadId: parsedData.id,
                channelId: parsedData.parent_id,
                data: parsedData
              }));
            } else {
              res.statusCode = response.status;
              res.end(JSON.stringify({
                success: false,
                status: response.status,
                error: parsedData
              }));
            }
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({
              success: false,
              error: err?.message || String(err)
            }));
          }
          return;
        }

        // Endpoint: POST /api/discord/sync-threads (Batch sync thread status & tags from Discord)
        if ((cleanPath === '/api/discord/sync-threads' || cleanPath === '/api/discord/threads-status') && req.method === 'POST') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');

          try {
            const body = await parseRequestBody(req);
            const threadIds: string[] = Array.isArray(body.threadIds) ? body.threadIds : [];
            const botToken = body.botToken || 'MTQ5ODc2NDAzMzUxODczNTQ0MQ.Gy2MgH.ByHf3S1es7Zg48_ppLuM_ggNrVqXGMc7VJtczE';

            if (!threadIds || threadIds.length === 0) {
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, threads: {}, lastSyncedAt: new Date().toISOString() }));
              return;
            }

            // Pre-fetch tags for known forum channels
            const bugTags = await fetchChannelTags('1535709136363462757', botToken);
            const ideaTags = await fetchChannelTags('1524133720876126408', botToken);
            const allKnownTags = new Map<string, any>();
            [...bugTags, ...ideaTags].forEach(t => allKnownTags.set(t.id, t));

            const threadResults: Record<string, any> = {};

            // Fetch thread info concurrently with limit
            const fetchPromises = threadIds.slice(0, 50).map(async (threadId) => {
              try {
                const resp = await fetch(`https://discord.com/api/v10/channels/${threadId}`, {
                  headers: {
                    'Authorization': `Bot ${botToken}`,
                    'Content-Type': 'application/json'
                  }
                });

                if (resp.ok) {
                  const data = await resp.json();
                  const appliedTagIds: string[] = data.applied_tags || [];
                  const parentId = data.parent_id;

                  // If parent channel tags not cached yet, fetch them
                  if (parentId && !forumTagsCache.has(parentId)) {
                    const parentTags = await fetchChannelTags(parentId, botToken);
                    parentTags.forEach(t => allKnownTags.set(t.id, t));
                  }

                  const appliedTagObjects = appliedTagIds.map(tagId => {
                    const tagObj = allKnownTags.get(tagId);
                    if (tagObj) {
                      return {
                        id: tagObj.id,
                        name: tagObj.name,
                        emojiName: tagObj.emoji_name || undefined,
                        emojiId: tagObj.emoji_id || undefined
                      };
                    }
                    // Fallback to known tag constants if available
                    if (tagId === '1535711015902384269') return { id: tagId, name: 'Neue Einreichung', emojiName: '⏳' };
                    if (tagId === '1535711141517336636') return { id: tagId, name: 'Wird überprüft', emojiName: '🔍' };
                    if (tagId === '1535710238995648512') return { id: tagId, name: 'Abgelehnt', emojiName: '❌' };
                    if (tagId === '1535711300058091520') return { id: tagId, name: 'Behoben', emojiName: '✅' };
                    if (tagId === '1535714553453740143') return { id: tagId, name: 'Problem-Fix in Bearbeitung', emojiName: '🔨' };
                    if (tagId === '1535714372427583578') return { id: tagId, name: 'Bestätigt & weitergeleitet', emojiName: '↗️' };
                    if (tagId === '1553317496159731722') return { id: tagId, name: 'SOCDOF', emojiName: '🌐' };

                    return {
                      id: tagId,
                      name: tagId
                    };
                  });

                  // Compute normalized status based strictly on Discord tag IDs & names
                  const isArchived = !!data.thread_metadata?.archived;
                  const isLocked = !!data.thread_metadata?.locked;

                  let computedStatus: 'pending' | 'reviewing' | 'rejected' | 'resolved' | 'in_progress' | 'forwarded' = 'pending';

                  if (appliedTagIds.includes('1535710238995648512')) {
                    computedStatus = 'rejected';
                  } else if (appliedTagIds.includes('1535711300058091520')) {
                    computedStatus = 'resolved';
                  } else if (appliedTagIds.includes('1535714553453740143')) {
                    computedStatus = 'in_progress';
                  } else if (appliedTagIds.includes('1535714372427583578')) {
                    computedStatus = 'forwarded';
                  } else if (appliedTagIds.includes('1535711141517336636')) {
                    computedStatus = 'reviewing';
                  } else if (appliedTagIds.includes('1535711015902384269')) {
                    computedStatus = 'pending';
                  } else {
                    // Fuzzy text check
                    const tagNamesCombined = appliedTagObjects.map(t => t.name.toLowerCase()).join(' ');
                    if (tagNamesCombined.includes('abgelehnt') || tagNamesCombined.includes('rejected') || tagNamesCombined.includes('verworfen')) {
                      computedStatus = 'rejected';
                    } else if (
                      isArchived ||
                      isLocked ||
                      tagNamesCombined.includes('behoben') ||
                      tagNamesCombined.includes('erledigt') ||
                      tagNamesCombined.includes('resolved') ||
                      tagNamesCombined.includes('fixed') ||
                      tagNamesCombined.includes('fertig') ||
                      tagNamesCombined.includes('umgesetzt')
                    ) {
                      computedStatus = 'resolved';
                    } else if (
                      tagNamesCombined.includes('problem-fix') ||
                      tagNamesCombined.includes('bearbeitung') ||
                      tagNamesCombined.includes('in progress') ||
                      tagNamesCombined.includes('in arbeit')
                    ) {
                      computedStatus = 'in_progress';
                    } else if (
                      tagNamesCombined.includes('weitergeleitet') ||
                      tagNamesCombined.includes('bestätigt') ||
                      tagNamesCombined.includes('forwarded')
                    ) {
                      computedStatus = 'forwarded';
                    } else if (
                      tagNamesCombined.includes('überprüf') ||
                      tagNamesCombined.includes('review') ||
                      tagNamesCombined.includes('untersuch')
                    ) {
                      computedStatus = 'reviewing';
                    }
                  }

                  threadResults[threadId] = {
                    id: threadId,
                    name: data.name,
                    channelId: parentId,
                    appliedTags: appliedTagObjects,
                    status: computedStatus,
                    isArchived,
                    isLocked,
                    messageCount: data.total_message_sent ?? data.message_count ?? 1,
                    lastMessageId: data.last_message_id,
                    lastSyncedAt: new Date().toISOString()
                  };
                } else {
                  threadResults[threadId] = {
                    id: threadId,
                    notFound: resp.status === 404,
                    httpStatus: resp.status,
                    lastSyncedAt: new Date().toISOString()
                  };
                }
              } catch (err: any) {
                threadResults[threadId] = {
                  id: threadId,
                  error: err?.message || String(err),
                  lastSyncedAt: new Date().toISOString()
                };
              }
            });

            await Promise.all(fetchPromises);

            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              threads: threadResults,
              lastSyncedAt: new Date().toISOString()
            }));
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({
              success: false,
              error: err?.message || String(err)
            }));
          }
          return;
        }

        // Endpoint: POST /api/discord/thread-messages (Fetch all messages from a thread for inspection)
        if (cleanPath === '/api/discord/thread-messages' && req.method === 'POST') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');

          try {
            const body = await parseRequestBody(req);
            const threadId = body.threadId;
            const botToken = body.botToken || 'MTQ5ODc2NDAzMzUxODczNTQ0MQ.Gy2MgH.ByHf3S1es7Zg48_ppLuM_ggNrVqXGMc7VJtczE';

            if (!threadId) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: 'threadId is required' }));
              return;
            }

            const response = await fetch(`https://discord.com/api/v10/channels/${threadId}/messages?limit=50`, {
              headers: {
                'Authorization': `Bot ${botToken}`,
                'Content-Type': 'application/json'
              }
            });

            if (response.ok) {
              const rawMsgs = await response.json();
              const messages = Array.isArray(rawMsgs) ? [...rawMsgs].reverse().map((msg: any) => {
                const avatarUrl = msg.author?.avatar
                  ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png?size=80`
                  : `https://cdn.discordapp.com/embed/avatars/${(parseInt(msg.author?.id || '0', 10) || 0) % 5}.png`;

                return {
                  id: msg.id,
                  content: msg.content || '',
                  author: {
                    id: msg.author?.id || '',
                    username: msg.author?.username || 'Discord User',
                    globalName: msg.author?.global_name,
                    avatar: msg.author?.avatar,
                    avatarUrl,
                    bot: !!msg.author?.bot
                  },
                  timestamp: msg.timestamp,
                  embeds: msg.embeds,
                  attachments: msg.attachments
                };
              }) : [];

              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, threadId, messages }));
            } else {
              const errText = await response.text();
              res.statusCode = response.status;
              res.end(JSON.stringify({ success: false, status: response.status, error: errText }));
            }
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: err?.message || String(err) }));
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
    plugins: [react(), tailwindcss(), mobileSyncPlugin(), languageSyncPlugin(), discordFeedbackPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
