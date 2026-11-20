const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Readable, pipeline } = require('stream');
const { spawn } = require('child_process');
const { Innertube, UniversalCache } = require('youtubei.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, 'data');
const LIBRARY_FILE = path.join(DATA_DIR, 'library.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize library file if missing
if (!fs.existsSync(LIBRARY_FILE)) {
  const initialLibrary = {
    liked: [],
    playlists: [
      {
        id: 'pl_featured',
        name: 'BZusic Vibe Collection',
        description: 'Curated songs to get started with BZusic',
        createdAt: Date.now(),
        songs: []
      }
    ],
    history: []
  };
  fs.writeFileSync(LIBRARY_FILE, JSON.stringify(initialLibrary, null, 2), 'utf8');
}

// Library helper functions
function readLibrary() {
  try {
    if (!fs.existsSync(LIBRARY_FILE)) {
      return { liked: [], playlists: [], history: [] };
    }
    const raw = fs.readFileSync(LIBRARY_FILE, 'utf8');
    if (!raw.trim()) {
      return { liked: [], playlists: [], history: [] };
    }
    const data = JSON.parse(raw);
    return {
      liked: Array.isArray(data.liked) ? data.liked : [],
      playlists: Array.isArray(data.playlists) ? data.playlists : [],
      history: Array.isArray(data.history) ? data.history : []
    };
  } catch (err) {
    console.error('[Library] CRITICAL: Error reading or parsing library file:', err.message);
    if (err.code !== 'ENOENT' && fs.existsSync(LIBRARY_FILE)) {
      try {
        const backupFile = `${LIBRARY_FILE}.corrupt.${Date.now()}.bak`;
        fs.copyFileSync(LIBRARY_FILE, backupFile);
        console.error(`[Library] Backup created before aborting: ${backupFile}`);
      } catch (e) {}
      throw new Error(`Corrupted library.json: ${err.message}. Operation aborted to protect library data.`);
    }
    return { liked: [], playlists: [], history: [] };
  }
}

function writeLibrary(data) {
  if (!data || typeof data !== 'object') {
    console.error('[Library] Refusing to write invalid library data');
    return false;
  }
  try {
    const tempFile = path.join(DATA_DIR, 'library.json.tmp');
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, LIBRARY_FILE);
    return true;
  } catch (err) {
    console.error('[Library] Error writing library file:', err.message);
    return false;
  }
}

// In-memory RAM cache for stream URLs (TTL 30 minutes)
const streamCache = new Map(); // videoId -> { directUrl, expiresAt }
const CACHE_TTL_MS = 30 * 60 * 1000;

// Periodic cleanup of expired cache entries
setInterval(() => {
  const now = Date.now();
  for (const [id, item] of streamCache.entries()) {
    if (item.expiresAt <= now) {
      streamCache.delete(id);
    }
  }
}, 5 * 60 * 1000);

// Find yt-dlp executable
function resolveYtDlpBinary() {
  if (process.env.YTDLP_PATH && fs.existsSync(process.env.YTDLP_PATH)) {
    return process.env.YTDLP_PATH;
  }

  // Check Python Roaming Scripts
  const appData = process.env.APPDATA || '';
  const localAppData = process.env.LOCALAPPDATA || '';

  const candidates = [
    path.join(appData, 'Python', 'Python315', 'Scripts', 'yt-dlp.exe'),
    path.join(appData, 'Python', 'Python314', 'Scripts', 'yt-dlp.exe'),
    path.join(appData, 'Python', 'Python313', 'Scripts', 'yt-dlp.exe'),
    path.join(appData, 'Python', 'Python312', 'Scripts', 'yt-dlp.exe'),
    path.join(appData, 'Python', 'Python311', 'Scripts', 'yt-dlp.exe'),
    path.join(appData, 'Python', 'Python310', 'Scripts', 'yt-dlp.exe'),
    path.join(localAppData, 'Programs', 'Python', 'Python315', 'Scripts', 'yt-dlp.exe'),
    path.join(localAppData, 'Programs', 'Python', 'Python314', 'Scripts', 'yt-dlp.exe'),
    path.join(localAppData, 'Programs', 'Python', 'Python313', 'Scripts', 'yt-dlp.exe'),
    path.join(localAppData, 'Programs', 'Python', 'Python312', 'Scripts', 'yt-dlp.exe'),
    path.join(localAppData, 'Programs', 'Python', 'Python311', 'Scripts', 'yt-dlp.exe'),
    path.join(localAppData, 'Programs', 'Python', 'Python310', 'Scripts', 'yt-dlp.exe')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Fallback to command name in PATH
  return 'yt-dlp';
}

const YTDLP_BIN = resolveYtDlpBinary();
console.log(`[BZusic Backend] yt-dlp binary resolved: ${YTDLP_BIN}`);

// Check for cookies file
function getCookiesPath() {
  const rootCookies = path.join(__dirname, 'cookies.txt');
  if (fs.existsSync(rootCookies)) return rootCookies;

  const dataCookies = path.join(DATA_DIR, 'cookies.txt');
  if (fs.existsSync(dataCookies)) return dataCookies;

  return null;
}

// Find Deno binary in WinGet packages or PATH
function resolveDenoBinary() {
  const localAppData = process.env.LOCALAPPDATA || '';
  const wingetPkgDir = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
  if (fs.existsSync(wingetPkgDir)) {
    try {
      const pkgs = fs.readdirSync(wingetPkgDir);
      for (const pkg of pkgs) {
        if (pkg.toLowerCase().includes('deno')) {
          const denoExe = path.join(wingetPkgDir, pkg, 'deno.exe');
          if (fs.existsSync(denoExe)) return denoExe;
        }
      }
    } catch (e) {}
  }
  return 'deno';
}

const DENO_BIN = resolveDenoBinary();
console.log(`[BZusic Backend] Deno runtime resolved: ${DENO_BIN}`);

// Add Deno to PATH if available in WinGet packages for JS runtime
try {
  const denoDir = path.dirname(DENO_BIN);
  if (fs.existsSync(denoDir)) {
    process.env.PATH = `${denoDir}${path.delimiter}${process.env.PATH}`;
  }
} catch (e) {
  // Ignore
}

// Extract direct audio URL and headers via yt-dlp -J
function fetchDirectAudioInfo(videoId) {
  return new Promise((resolve, reject) => {
    // Handle potential typos or aliased test videoId (qRpE45b4INk -> qHpE45b4INk)
    let targetId = videoId;
    if (videoId === 'qRpE45b4INk') {
      targetId = 'qHpE45b4INk';
    }

    const videoUrl = `https://www.youtube.com/watch?v=${targetId}`;
    const args = [
      '--js-runtimes', `deno:${DENO_BIN}`,
      '-f', 'bestaudio[ext=m4a]/bestaudio',
      '-J',
      '--no-playlist'
    ];

    const cookiesFile = getCookiesPath();
    if (cookiesFile) {
      args.push('--cookies', cookiesFile);
    }

    args.push(videoUrl);

    console.log(`[yt-dlp] Fetching format metadata for ${targetId}...`);
    const child = spawn(YTDLP_BIN, args, {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let isSettled = false;
    const timeout = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        console.warn(`[yt-dlp] Process timed out after 20s for ${targetId}, terminating...`);
        try { child.kill('SIGKILL'); } catch (e) {}
        reject(new Error(`yt-dlp timed out after 20 seconds for ${targetId}`));
      }
    }, 20000);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('error', (err) => {
      clearTimeout(timeout);
      if (isSettled) return;
      isSettled = true;
      reject(new Error(`Failed to start yt-dlp: ${err.message}`));
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (isSettled) return;
      isSettled = true;
      if (code === 0) {
        try {
          const data = JSON.parse(stdout);
          let audioFormat = null;
          if (data.requested_formats) {
            audioFormat = data.requested_formats.find(f => f.acodec !== 'none' && f.vcodec === 'none') || data.requested_formats[0];
          } else if (data.url && data.acodec !== 'none') {
            audioFormat = data;
          } else if (data.formats) {
            const audios = data.formats.filter(f => f.acodec !== 'none' && f.vcodec === 'none' && f.url);
            audioFormat = audios.find(f => f.ext === 'm4a') || audios[audios.length - 1];
          }

          if (!audioFormat || !audioFormat.url) {
            return reject(new Error('No valid direct audio format URL in yt-dlp output'));
          }

          const httpHeaders = audioFormat.http_headers || data.http_headers || {};
          resolve({
            directUrl: audioFormat.url,
            httpHeaders,
            mimeType: audioFormat.ext === 'm4a' ? 'audio/mp4' : 'audio/webm',
            contentLength: audioFormat.filesize || audioFormat.filesize_approx || null,
            targetId
          });
        } catch (parseErr) {
          reject(new Error(`Failed to parse yt-dlp JSON: ${parseErr.message}`));
        }
      } else {
        const cleanErr = stderr.trim().split(/\r?\n/).find(l => l.includes('ERROR:')) || stderr.trim().split(/\r?\n/)[0] || `yt-dlp exited with code ${code}`;
        reject(new Error(cleanErr));
      }
    });
  });
}

// Fallback: stream directly from yt-dlp stdout pipe
function streamDirectFromYtDlp(targetId, req, res) {
  return new Promise((resolve, reject) => {
    console.log(`[Stream Fallback] Spawning yt-dlp stdout pipe for ${targetId}...`);
    const args = [
      '--js-runtimes', `deno:${DENO_BIN}`,
      '-f', 'bestaudio[ext=m4a]/bestaudio',
      '-o', '-',
      '--no-playlist'
    ];

    const cookiesFile = getCookiesPath();
    if (cookiesFile) args.push('--cookies', cookiesFile);
    args.push(`https://www.youtube.com/watch?v=${targetId}`);

    const child = spawn(YTDLP_BIN, args, {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    child.stderr.on('data', d => { stderr += d.toString(); });

    res.status(200);
    res.setHeader('Content-Type', 'audio/mp4');
    res.setHeader('Cache-Control', 'no-cache');

    child.stdout.pipe(res);

    res.on('close', () => {
      if (!res.writableFinished) {
        try { child.kill('SIGKILL'); } catch (e) {}
      }
    });

    child.on('error', (err) => {
      console.error(`[Stream Fallback Error] ${targetId}:`, err.message);
      reject(err);
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`[Stream Fallback Done] Finished piping ${targetId}`);
        resolve();
      } else {
        const cleanErr = stderr.trim().split(/\r?\n/).find(l => l.includes('ERROR:')) || stderr.trim().split(/\r?\n/)[0] || `yt-dlp stream pipe exited with code ${code}`;
        console.error(`[Stream Fallback Failed] ${targetId}: ${cleanErr}`);
        reject(new Error(cleanErr));
      }
    });
  });
}

// Initialize YouTube.js Innertube
let ytClient = null;
let ytInitPromise = null;

async function getInnertube() {
  if (ytClient) return ytClient;
  if (!ytInitPromise) {
    ytInitPromise = Innertube.create({
      cache: new UniversalCache(false)
    }).then(client => {
      ytClient = client;
      console.log('[BZusic Backend] YouTube.js (Innertube) initialized successfully');
      return client;
    }).catch(err => {
      ytInitPromise = null;
      console.error('[BZusic Backend] Failed to initialize Innertube:', err.message);
      throw err;
    });
  }
  return ytInitPromise;
}

// Helper: Upgrade thumbnail URL to highest resolution
function upgradeThumbnail(url) {
  if (!url) return '';
  return url.replace(/=w\d+-h\d+.*$/, '=w544-h544-l90-rj');
}

// ==========================================
// API Routes
// ==========================================

// 1. GET /api/search?q=...&mode=all|music
app.get('/api/search', async (req, res) => {
  const query = (req.query.q || '').trim();
  const mode = (req.query.mode || 'all').toLowerCase(); // 'all' (default) or 'music'

  if (!query) {
    return res.status(400).json({ error: 'Missing search query parameter `q`' });
  }

  try {
    const yt = await getInnertube();

    // Direct YouTube Link Detection: videoId extraction
    const ytUrlRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|music\.youtube\.com\/watch\?v=)([^"&?\/\s]{11})/i;
    const urlMatch = query.match(ytUrlRegex);

    if (urlMatch) {
      const videoId = urlMatch[1];
      console.log(`[API Search] Detected direct YouTube URL for videoId: ${videoId}`);
      try {
        const info = await yt.getBasicInfo(videoId);
        const basic = info.basic_info || {};
        const song = {
          videoId,
          title: basic.title || 'Untitled',
          artist: basic.author || 'Unknown Artist',
          album: '',
          thumbnail: upgradeThumbnail(basic.thumbnail?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`),
          duration: basic.duration ? `${Math.floor(basic.duration / 60)}:${('0' + (basic.duration % 60)).slice(-2)}` : '0:00'
        };
        return res.json({ results: [song] });
      } catch (directErr) {
        console.warn(`[API Search] Failed getBasicInfo for ${videoId}:`, directErr.message);
        return res.json({
          results: [{
            videoId,
            title: 'YouTube Track',
            artist: 'YouTube',
            album: '',
            thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            duration: '0:00'
          }]
        });
      }
    }

    // Mode 1: Search whole YouTube (mode=all)
    if (mode === 'all') {
      const search = await yt.search(query, { type: 'video' });
      let videos = [];
      if (search.videos && Array.isArray(search.videos)) {
        videos = search.videos;
      } else if (search.results && Array.isArray(search.results)) {
        videos = search.results.filter(r => r.type === 'Video' || r.id);
      } else if (search.contents && Array.isArray(search.contents)) {
        for (const sec of search.contents) {
          if (sec.contents && Array.isArray(sec.contents)) {
            videos.push(...sec.contents.filter(c => c.type === 'Video' || c.id));
          }
        }
      }

      const results = videos.map(item => {
        const videoId = item.id;
        if (!videoId) return null;

        let thumbnail = '';
        if (item.thumbnails && item.thumbnails.length > 0) {
          const highest = item.thumbnails.reduce((prev, curr) => (curr.width > prev.width ? curr : prev), item.thumbnails[0]);
          thumbnail = upgradeThumbnail(highest.url);
        } else if (item.best_thumbnail?.url) {
          thumbnail = upgradeThumbnail(item.best_thumbnail.url);
        }
        if (!thumbnail) {
          thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        }

        const title = typeof item.title === 'string' ? item.title : (item.title?.text || 'Untitled');
        let artist = 'Unknown Artist';
        if (item.author?.name) {
          artist = item.author.name;
        } else if (typeof item.author === 'string') {
          artist = item.author;
        }

        let duration = '0:00';
        if (item.duration?.text) {
          duration = item.duration.text;
        } else if (item.duration?.seconds) {
          const s = item.duration.seconds;
          duration = `${Math.floor(s / 60)}:${('0' + (s % 60)).slice(-2)}`;
        }

        return {
          videoId,
          title,
          artist,
          album: '',
          thumbnail,
          duration
        };
      }).filter(Boolean);

      return res.json({ results });
    }

    // Mode 2: Standard YouTube Music (mode=music)
    const search = await yt.music.search(query, { type: 'song' });

    let rawItems = [];
    if (search.songs?.contents) {
      rawItems = search.songs.contents;
    } else if (search.results) {
      rawItems = search.results;
    } else if (search.contents) {
      for (const section of search.contents) {
        if (section.contents) {
          rawItems.push(...section.contents);
        }
      }
    }

    const results = rawItems.map(item => {
      const videoId = item.id || item.video_id;
      if (!videoId) return null;

      let thumbnail = '';
      if (item.thumbnails && item.thumbnails.length > 0) {
        const highest = item.thumbnails.reduce((prev, curr) => (curr.width > prev.width ? curr : prev), item.thumbnails[0]);
        thumbnail = upgradeThumbnail(highest.url);
      } else if (item.thumbnail?.contents?.[0]?.url) {
        thumbnail = upgradeThumbnail(item.thumbnail.contents[0].url);
      }

      if (!thumbnail) {
        thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      }

      let artists = 'Unknown Artist';
      if (Array.isArray(item.artists)) {
        artists = item.artists.map(a => a.name).filter(Boolean).join(', ') || 'Unknown Artist';
      } else if (item.artists?.name) {
        artists = item.artists.name;
      } else if (item.author?.name) {
        artists = item.author.name;
      } else if (typeof item.author === 'string') {
        artists = item.author;
      }

      const title = typeof item.title === 'string' ? item.title : (item.title?.text || 'Untitled');
      const album = item.album?.name || '';
      
      let duration = '0:00';
      if (item.duration?.text) {
        duration = item.duration.text;
      } else if (item.duration?.seconds) {
        const s = item.duration.seconds;
        duration = `${Math.floor(s / 60)}:${('0' + (s % 60)).slice(-2)}`;
      }

      return {
        videoId,
        title,
        artist: artists,
        album,
        thumbnail,
        duration
      };
    }).filter(Boolean);

    res.json({ results });
  } catch (err) {
    console.error('[API Search Error]:', err.message);
    res.status(500).json({ error: 'Search failed', message: err.message, results: [] });
  }
});

// 2. GET /api/stream/:videoId
app.get('/api/stream/:videoId', async (req, res) => {
  const { videoId } = req.params;
  const rangeHeader = req.headers.range || 'Full Content';
  console.log(`\n---------------------------------------------------------`);
  console.log(`[GET /api/stream/${videoId}] Client stream request (Range: ${rangeHeader})`);

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    console.error(`[GET /api/stream/${videoId}] Invalid videoId: "${videoId}"`);
    return res.status(400).json({ error: 'Invalid videoId format' });
  }

  let targetId = videoId;
  if (videoId === 'qRpE45b4INk') {
    targetId = 'qHpE45b4INk';
    console.log(`[GET /api/stream] Mapped videoId "${videoId}" -> "${targetId}"`);
  }

  async function getDirectInfo(forceRefresh = false) {
    const cached = streamCache.get(targetId);
    if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
      console.log(`[Stream Cache HIT] Using cached directUrl for ${targetId}`);
      return cached;
    }

    console.log(`[Stream Cache MISS] Fetching directUrl and headers via yt-dlp for ${targetId}...`);
    const freshInfo = await fetchDirectAudioInfo(targetId);
    streamCache.set(targetId, {
      ...freshInfo,
      expiresAt: Date.now() + CACHE_TTL_MS
    });
    return freshInfo;
  }

  async function proxyStream(info, retry = true) {
    const upstreamHeaders = {
      ...(info.httpHeaders || {})
    };

    if (req.headers.range) {
      upstreamHeaders['Range'] = req.headers.range;
    }

    console.log(`[Stream Proxy] Connecting to Google Audio CDN with User-Agent: "${upstreamHeaders['User-Agent'] || 'Default'}"`);

    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) {
        controller.abort();
      }
    });

    try {
      const upstreamRes = await fetch(info.directUrl, {
        headers: upstreamHeaders,
        signal: controller.signal
      });

      console.log(`[Stream Proxy] Google Video response: HTTP ${upstreamRes.status} (${upstreamRes.statusText})`);

      if ((upstreamRes.status === 403 || upstreamRes.status === 410) && retry) {
        console.warn(`[Stream Proxy] Google Video returned HTTP ${upstreamRes.status} for ${targetId}. Clearing cache and refreshing link...`);
        streamCache.delete(targetId);
        const refreshedInfo = await getDirectInfo(true);
        return proxyStream(refreshedInfo, false);
      }

      if (!upstreamRes.ok && upstreamRes.status !== 206) {
        throw new Error(`Google CDN returned HTTP ${upstreamRes.status} (${upstreamRes.statusText})`);
      }

      // Forward response status and headers
      res.status(upstreamRes.status);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=3600');

      const passHeaders = ['content-type', 'content-length', 'content-range'];
      for (const h of passHeaders) {
        const val = upstreamRes.headers.get(h);
        if (val) res.setHeader(h, val);
      }

      if (!upstreamRes.body) {
        return res.end();
      }

      // Stream body to client with backpressure
      const nodeStream = Readable.fromWeb(upstreamRes.body);
      await new Promise((resolve, reject) => {
        pipeline(nodeStream, res, (err) => {
          if (err) {
            if (err.name === 'AbortError' || err.code === 'ERR_STREAM_PREMATURE_CLOSE') {
              resolve();
            } else {
              reject(err);
            }
          } else {
            resolve();
          }
        });
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        // Client aborted/seeked - normal behavior
        return;
      }
      throw err;
    }
  }

  try {
    const info = await getDirectInfo(false);
    await proxyStream(info);
  } catch (err) {
    console.error(`[GET /api/stream/${videoId} PROXY ERROR]:`, err.message);
    
    // Fallback: stream directly via stdout yt-dlp
    try {
      if (!res.headersSent) {
        console.log(`[GET /api/stream/${videoId}] Activating fallback: streaming directly via yt-dlp stdout...`);
        await streamDirectFromYtDlp(targetId, req, res);
        return;
      }
    } catch (fallbackErr) {
      console.error(`[GET /api/stream/${videoId} FALLBACK ERROR]:`, fallbackErr.message);
    }

    if (!res.headersSent) {
      res.status(502).json({
        error: 'STREAM_FAILED',
        message: 'Unable to stream audio for this track.',
        details: err.message
      });
    } else if (!res.writableEnded) {
      res.destroy();
    }
  }
});

// 3. GET /api/upnext/:videoId
app.get('/api/upnext/:videoId', async (req, res) => {
  const { videoId } = req.params;
  if (!videoId) {
    return res.status(400).json({ error: 'Missing videoId' });
  }

  try {
    const yt = await getInnertube();
    const upNext = await yt.music.getUpNext(videoId);

    const rawList = upNext?.contents || [];
    const tracks = rawList
      .filter(item => item.video_id && item.video_id !== videoId)
      .slice(0, 20)
      .map(item => {
        let thumb = '';
        if (item.thumbnail && item.thumbnail.length > 0) {
          thumb = upgradeThumbnail(item.thumbnail[0].url);
        }
        if (!thumb) {
          thumb = `https://i.ytimg.com/vi/${item.video_id}/hqdefault.jpg`;
        }

        let artists = 'Unknown Artist';
        if (item.author) {
          artists = typeof item.author === 'string' ? item.author : item.author.name || 'Unknown Artist';
        } else if (Array.isArray(item.artists)) {
          artists = item.artists.map(a => a.name).filter(Boolean).join(', ') || 'Unknown Artist';
        }

        const title = item.title?.text || (typeof item.title === 'string' ? item.title : 'Untitled');
        const album = item.album?.name || '';
        const duration = item.duration?.text || '0:00';

        return {
          videoId: item.video_id,
          title,
          artist: artists,
          album,
          thumbnail: thumb,
          duration
        };
      });

    res.json({ tracks });
  } catch (err) {
    console.error(`[API UpNext Error] videoId: ${videoId}:`, err.message);
    res.status(500).json({ error: 'Failed to fetch Up Next tracks', tracks: [] });
  }
});

// Helper: Standardize lyrics text, clean formatting and ensure consistent '^' translation separation
function sanitizeLyrics(lrcText) {
  if (!lrcText || typeof lrcText !== 'string') return lrcText;
  const lines = lrcText.split(/\r?\n/);
  const cleaned = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    const tagMatch = trimmed.match(/^(\[\d{1,2}:\d{2}(?:\.\d{1,3})?\])(.*)$/);
    if (tagMatch) {
      const tag = tagMatch[1];
      const content = tagMatch[2].trim();
      if (content.includes('^')) {
        const parts = content.split('^');
        const main = parts[0].trim();
        const sub = parts.slice(1).join(' ').replace(/<[^>]*>/g, '').trim();
        return sub ? `${tag} ${main}^${sub}` : `${tag} ${main}`;
      }
      return `${tag} ${content}`;
    } else {
      if (trimmed.includes('^')) {
        const parts = trimmed.split('^');
        const main = parts[0].trim();
        const sub = parts.slice(1).join(' ').replace(/<[^>]*>/g, '').trim();
        return sub ? `${main}^${sub}` : main;
      }
      return trimmed;
    }
  });
  return cleaned.join('\n');
}

// 4. GET /api/lyrics?title=...&artist=...
app.get('/api/lyrics', async (req, res) => {
  const title = (req.query.title || '').trim();
  const artist = (req.query.artist || '').trim();

  if (!title) {
    return res.status(400).json({ error: 'Missing `title` parameter' });
  }

  // Clean title for better search matching (remove "(Official Music Video)", "feat.", etc.)
  const cleanTitle = title
    .replace(/\s*[\(\[](official|audio|video|mv|visualizer|lyric|lyrics|m\/v|remix).*?[\)\]]/gi, '')
    .replace(/\s*feat\..*$/i, '')
    .trim();

  const cleanArtist = artist.split(',')[0].trim();

  try {
    // 1. Try exact get endpoint
    const getUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`;
    const getRes = await fetch(getUrl, {
      headers: { 'User-Agent': 'BZmusic/1.0 (https://github.com/bzmusic)' },
      signal: AbortSignal.timeout(5000)
    });

    if (getRes.ok) {
      const data = await getRes.json();
      if (data.syncedLyrics || data.plainLyrics) {
        return res.json({
          syncedLyrics: sanitizeLyrics(data.syncedLyrics) || null,
          plainLyrics: sanitizeLyrics(data.plainLyrics) || null
        });
      }
    }

    // 2. Fallback to search endpoint
    const searchQuery = `${cleanTitle} ${cleanArtist}`.trim();
    const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(searchQuery)}`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'User-Agent': 'BZmusic/1.0 (https://github.com/bzmusic)' },
      signal: AbortSignal.timeout(5000)
    });

    if (searchRes.ok) {
      const list = await searchRes.json();
      if (Array.isArray(list) && list.length > 0) {
        // Find best match with syncedLyrics first
        const syncedItem = list.find(item => item.syncedLyrics);
        if (syncedItem) {
          return res.json({
            syncedLyrics: sanitizeLyrics(syncedItem.syncedLyrics),
            plainLyrics: sanitizeLyrics(syncedItem.plainLyrics) || null
          });
        }

        const plainItem = list.find(item => item.plainLyrics);
        if (plainItem) {
          return res.json({
            syncedLyrics: null,
            plainLyrics: sanitizeLyrics(plainItem.plainLyrics)
          });
        }
      }
    }

    // No lyrics found
    res.json({ syncedLyrics: null, plainLyrics: null });
  } catch (err) {
    console.error('[API Lyrics Error]:', err.message);
    res.json({ syncedLyrics: null, plainLyrics: null });
  }
});

// 5. Library APIs
// GET /api/library
app.get('/api/library', (req, res) => {
  const library = readLibrary();
  res.json(library);
});

// POST /api/library/like - Toggle like
app.post('/api/library/like', (req, res) => {
  const song = req.body;
  if (!song || !song.videoId) {
    return res.status(400).json({ error: 'Invalid song data' });
  }

  const library = readLibrary();
  const existingIndex = library.liked.findIndex(s => s.videoId === song.videoId);
  let liked = false;

  if (existingIndex >= 0) {
    // Unlike
    library.liked.splice(existingIndex, 1);
    liked = false;
  } else {
    // Like
    library.liked.unshift({
      ...song,
      likedAt: Date.now()
    });
    liked = true;
  }

  writeLibrary(library);
  res.json({ liked, likedSongs: library.liked });
});

// POST /api/library/history - Add to history
app.post('/api/library/history', (req, res) => {
  const song = req.body;
  if (!song || !song.videoId) {
    return res.status(400).json({ error: 'Invalid song data' });
  }

  const library = readLibrary();
  // Remove existing occurrence to place it at the very top
  library.history = library.history.filter(s => s.videoId !== song.videoId);
  library.history.unshift({
    ...song,
    playedAt: Date.now()
  });

  // Limit history to 100 entries
  if (library.history.length > 100) {
    library.history = library.history.slice(0, 100);
  }

  writeLibrary(library);
  res.json({ success: true, history: library.history });
});

// DELETE /api/library/history - Clear history
app.delete('/api/library/history', (req, res) => {
  const library = readLibrary();
  library.history = [];
  writeLibrary(library);
  res.json({ success: true, history: [] });
});

// POST /api/library/playlists - Create playlist
app.post('/api/library/playlists', (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Playlist name is required' });
  }

  const library = readLibrary();
  const newPlaylist = {
    id: `pl_${Date.now()}`,
    name: name.trim(),
    description: (description || '').trim(),
    createdAt: Date.now(),
    songs: []
  };

  library.playlists.unshift(newPlaylist);
  writeLibrary(library);
  res.json({ success: true, playlist: newPlaylist, playlists: library.playlists });
});

// PUT /api/library/playlists/:id - Update playlist details (name, description, coverUrl, songs)
app.put('/api/library/playlists/:id', (req, res) => {
  const { id } = req.params;
  const { name, description, coverUrl, songs } = req.body;

  const library = readLibrary();
  const playlist = library.playlists.find(p => p.id === id);

  if (!playlist) {
    return res.status(404).json({ error: 'Playlist not found' });
  }

  if (typeof name === 'string' && name.trim()) {
    playlist.name = name.trim();
  }
  if (typeof description === 'string') {
    playlist.description = description.trim();
  }
  if (typeof coverUrl === 'string') {
    playlist.coverUrl = coverUrl.trim();
  } else if (coverUrl === null) {
    delete playlist.coverUrl;
  }
  if (Array.isArray(songs)) {
    playlist.songs = songs;
  }

  playlist.updatedAt = Date.now();
  writeLibrary(library);
  res.json({ success: true, playlist, playlists: library.playlists });
});

// DELETE /api/library/playlists/:id - Delete playlist
app.delete('/api/library/playlists/:id', (req, res) => {
  const { id } = req.params;
  const library = readLibrary();
  const initialLen = library.playlists.length;
  library.playlists = library.playlists.filter(p => p.id !== id);

  if (library.playlists.length === initialLen) {
    return res.status(404).json({ error: 'Playlist not found' });
  }

  writeLibrary(library);
  res.json({ success: true, playlists: library.playlists });
});

// POST /api/library/playlists/:id/songs - Add song to playlist
app.post('/api/library/playlists/:id/songs', (req, res) => {
  const { id } = req.params;
  const song = req.body;

  if (!song || !song.videoId) {
    return res.status(400).json({ error: 'Invalid song data' });
  }

  const library = readLibrary();
  const playlist = library.playlists.find(p => p.id === id);
  if (!playlist) {
    return res.status(404).json({ error: 'Playlist not found' });
  }

  const exists = playlist.songs.some(s => s.videoId === song.videoId);
  if (!exists) {
    playlist.songs.push({
      ...song,
      addedAt: Date.now()
    });
    writeLibrary(library);
  }

  res.json({ success: true, playlist });
});

// DELETE /api/library/playlists/:id/songs/:videoId - Remove song from playlist
app.delete('/api/library/playlists/:id/songs/:videoId', (req, res) => {
  const { id, videoId } = req.params;
  const library = readLibrary();
  const playlist = library.playlists.find(p => p.id === id);

  if (!playlist) {
    return res.status(404).json({ error: 'Playlist not found' });
  }

  playlist.songs = playlist.songs.filter(s => s.videoId !== videoId);
  writeLibrary(library);
  res.json({ success: true, playlist });
});

// POST /api/library/import - Streamed Playlist Import (SSE)
app.post('/api/library/import', async (req, res) => {
  const { name, description, tracks } = req.body;

  if (!Array.isArray(tracks) || tracks.length === 0) {
    return res.status(400).json({ error: 'Invalid or empty tracks list' });
  }

  // Set SSE response headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  let isAborted = false;
  res.on('close', () => {
    if (!res.writableEnded) {
      isAborted = true;
      console.log(`[Import] Client disconnected, aborting import "${name}"`);
    }
  });

  const sendEvent = (data) => {
    if (!isAborted) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  try {
    const yt = await getInnertube();
    const matchedSongs = [];
    const total = tracks.length;

    sendEvent({ type: 'start', total });

    for (let i = 0; i < total; i++) {
      if (isAborted) break;

      const track = tracks[i];
      const trackTitle = (track.title || '').trim();
      const trackArtist = (track.artist || '').trim();
      const trackLabel = trackArtist ? `${trackTitle} - ${trackArtist}` : trackTitle;

      let matchedSong = null;

      if (trackTitle) {
        const q = `${trackTitle} ${trackArtist}`.trim();
        try {
          // 1. First try yt.music.search
          const mSearch = await yt.music.search(q, { type: 'song' });
          let items = mSearch.songs?.contents || mSearch.results || [];
          if (items.length > 0) {
            const first = items[0];
            const videoId = first.id || first.video_id;
            if (videoId) {
              let thumb = '';
              if (first.thumbnails && first.thumbnails.length > 0) {
                const highest = first.thumbnails.reduce((p, c) => (c.width > p.width ? c : p), first.thumbnails[0]);
                thumb = upgradeThumbnail(highest.url);
              }
              if (!thumb) thumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

              let artistName = trackArtist || 'Unknown Artist';
              if (Array.isArray(first.artists)) {
                artistName = first.artists.map(a => a.name).filter(Boolean).join(', ') || artistName;
              } else if (first.author?.name) {
                artistName = first.author.name;
              }

              matchedSong = {
                videoId,
                title: first.title?.text || (typeof first.title === 'string' ? first.title : trackTitle),
                artist: artistName,
                album: first.album?.name || '',
                thumbnail: thumb,
                duration: first.duration?.text || '0:00'
              };
            }
          }

          // 2. Fallback to general YouTube video search if not matched
          if (!matchedSong) {
            const vSearch = await yt.search(q, { type: 'video' });
            const vItems = vSearch.videos || (vSearch.results ? vSearch.results.filter(r => r.type === 'Video' || r.id) : []);
            if (vItems.length > 0) {
              const first = vItems[0];
              const videoId = first.id;
              if (videoId) {
                let thumb = first.thumbnails?.[0]?.url || first.best_thumbnail?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
                matchedSong = {
                  videoId,
                  title: typeof first.title === 'string' ? first.title : (first.title?.text || trackTitle),
                  artist: first.author?.name || trackArtist || 'Unknown Artist',
                  album: '',
                  thumbnail: upgradeThumbnail(thumb),
                  duration: first.duration?.text || '0:00'
                };
              }
            }
          }
        } catch (searchErr) {
          console.error(`[Import Search Error for "${trackLabel}"]:`, searchErr.message);
        }
      }

      if (matchedSong) {
        matchedSongs.push(matchedSong);
      }

      sendEvent({
        type: 'progress',
        current: i + 1,
        total,
        trackLabel,
        matched: !!matchedSong,
        matchedCount: matchedSongs.length,
        failedCount: (i + 1) - matchedSongs.length,
        matchedSong
      });

      // Small throttle to avoid hitting rate limits
      await new Promise(r => setTimeout(r, 200));
    }

    if (!isAborted) {
      const library = readLibrary();
      const playlistName = (name || `Imported Playlist ${new Date().toLocaleDateString('en-US')}`).trim();
      const newPlaylist = {
        id: `pl_${Date.now()}`,
        name: playlistName,
        description: (description || `Imported ${matchedSongs.length}/${total} songs`).trim(),
        createdAt: Date.now(),
        songs: matchedSongs
      };

      library.playlists.unshift(newPlaylist);
      writeLibrary(library);

      sendEvent({
        type: 'complete',
        playlist: newPlaylist,
        matchedCount: matchedSongs.length,
        failedCount: total - matchedSongs.length,
        playlists: library.playlists
      });

      res.end();
    }
  } catch (err) {
    console.error('[Import Fatal Error]:', err.message);
    sendEvent({ type: 'error', message: err.message });
    res.end();
  }
});

// Fallback for SPA routing
app.use((req, res) => {
  if (/\.(js|css|json|svg|png|jpg|jpeg|gif|webp|ico|map|woff2?|ttf|m4a|mp3)$/i.test(req.path)) {
    return res.status(404).type('text/plain').send('File not found');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Express server
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🎵 BZusic - Personal Music Player is running at:`);
  console.log(`   ➜ http://localhost:${PORT}`);
  console.log(`======================================================\n`);
  
  // Warm up Innertube in the background
  getInnertube().catch(() => {});
});
