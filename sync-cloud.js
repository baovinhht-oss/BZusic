/**
 * BZusic Cloud Sync Engine
 * Synchronizes local library, audio files, and lyrics to Supabase Storage
 * Generates static GitHub Pages deployment in docs/
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'Music';

// 1. Validation
if (!SUPABASE_URL) {
  console.error('❌ Error: SUPABASE_URL is missing in .env');
  process.exit(1);
}

if (!SUPABASE_SERVICE_KEY || SUPABASE_SERVICE_KEY.trim() === '') {
  console.error('❌ Error: SUPABASE_SERVICE_KEY is missing or empty in .env');
  console.error('👉 Please add your Supabase service_role key to .env before syncing.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

const DATA_DIR = path.join(__dirname, 'data');
const LIBRARY_FILE = path.join(DATA_DIR, 'library.json');
const TEMP_DIR = path.join(__dirname, 'temp_downloads');
const PUBLIC_DIR = path.join(__dirname, 'public');
const DOCS_DIR = path.join(__dirname, 'docs');

// Resolve binaries (same detection logic as server.js)
function resolveYtDlpBinary() {
  if (process.env.YTDLP_PATH && fs.existsSync(process.env.YTDLP_PATH)) {
    return process.env.YTDLP_PATH;
  }
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
    if (fs.existsSync(candidate)) return candidate;
  }
  return 'yt-dlp';
}

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

function getCookiesPath() {
  const rootCookies = path.join(__dirname, 'cookies.txt');
  if (fs.existsSync(rootCookies)) return rootCookies;
  const dataCookies = path.join(DATA_DIR, 'cookies.txt');
  if (fs.existsSync(dataCookies)) return dataCookies;
  return null;
}

const YTDLP_BIN = resolveYtDlpBinary();
const DENO_BIN = resolveDenoBinary();
const COOKIES_FILE = getCookiesPath();

// Add Deno to PATH if available
try {
  const denoDir = path.dirname(DENO_BIN);
  if (fs.existsSync(denoDir)) {
    process.env.PATH = `${denoDir}${path.delimiter}${process.env.PATH}`;
  }
} catch (e) {}

// Helper: List all files in bucket folder with pagination
async function listAllBucketFiles(folder) {
  const fileSet = new Set();
  let offset = 0;
  const limit = 100;
  while (true) {
    const { data, error } = await supabase.storage.from(SUPABASE_BUCKET).list(folder, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' }
    });
    if (error) {
      console.warn(`[Supabase Storage] Could not list "${folder}": ${error.message}`);
      break;
    }
    if (!data || data.length === 0) break;
    for (const item of data) {
      if (item.name) fileSet.add(item.name);
    }
    if (data.length < limit) break;
    offset += limit;
  }
  return fileSet;
}

// Helper: Download audio via yt-dlp with timeout (90s)
function downloadAudioYtDlp(videoId, outputPath) {
  return new Promise((resolve, reject) => {
    let targetId = videoId;
    if (videoId === 'qRpE45b4INk') targetId = 'qHpE45b4INk';

    const args = [
      '--js-runtimes', `deno:${DENO_BIN}`,
      '-f', 'ba[ext=m4a]/bestaudio',
      '--extract-audio',
      '--audio-format', 'm4a',
      '--audio-quality', '0',
      '--remux-video', 'm4a',
      '-o', outputPath,
      '--no-playlist'
    ];
    if (COOKIES_FILE) args.push('--cookies', COOKIES_FILE);
    args.push(`https://www.youtube.com/watch?v=${targetId}`);

    const child = spawn(YTDLP_BIN, args, {
      env: process.env,
      stdio: ['ignore', 'ignore', 'pipe']
    });

    let stderr = '';
    child.stderr.on('data', d => { stderr += d.toString(); });

    let isSettled = false;
    const timeout = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        try { child.kill('SIGKILL'); } catch (e) {}
        reject(new Error(`yt-dlp download timed out after 90s for ${videoId}`));
      }
    }, 90000);

    child.on('error', err => {
      clearTimeout(timeout);
      if (!isSettled) {
        isSettled = true;
        reject(err);
      }
    });

    child.on('close', code => {
      clearTimeout(timeout);
      if (!isSettled) {
        isSettled = true;
        if (code === 0 && fs.existsSync(outputPath)) {
          resolve();
        } else {
          const errLine = stderr.trim().split(/\r?\n/).find(l => l.includes('ERROR:')) || `Exited with code ${code}`;
          reject(new Error(errLine));
        }
      }
    });
  });
}

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

// Helper: Fetch lyrics from LRCLIB
async function fetchLyricsLrcLib(title, artist) {
  try {
    const cleanTitle = (title || '')
      .replace(/\s*[\(\[](official|audio|video|mv|visualizer|lyric|lyrics|m\/v|remix).*?[\)\]]/gi, '')
      .replace(/\s*feat\..*$/i, '')
      .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
      .trim();
    const cleanArtist = (artist || '').split(/[,&xX]/)[0].trim();

    // 1. Try exact get
    const url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'BZmusic/1.0 (https://github.com)' }
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (data.syncedLyrics && data.syncedLyrics.trim()) {
        return sanitizeLyrics(data.syncedLyrics.trim());
      }
      if (data.plainLyrics && data.plainLyrics.trim()) {
        return sanitizeLyrics(data.plainLyrics.trim());
      }
    }

    // 2. Fallback: Search endpoint
    const searchQuery = `${cleanTitle} ${cleanArtist}`.trim();
    const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(searchQuery)}`;
    const sController = new AbortController();
    const sTimer = setTimeout(() => sController.abort(), 10000);
    const searchRes = await fetch(searchUrl, {
      signal: sController.signal,
      headers: { 'User-Agent': 'BZmusic/1.0 (https://github.com)' }
    });
    clearTimeout(sTimer);

    if (searchRes.ok) {
      const list = await searchRes.json();
      if (Array.isArray(list) && list.length > 0) {
        const match = list.find(item => item.syncedLyrics || item.plainLyrics);
        if (match) {
          const raw = (match.syncedLyrics && match.syncedLyrics.trim()) || (match.plainLyrics && match.plainLyrics.trim()) || null;
          return sanitizeLyrics(raw);
        }
      }
    }
  } catch (e) {
    // Fail silently on lyrics fetch
  }
  return null;
}

// Recursive directory copy
function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Main Sync Procedure
async function main() {
  console.log('====================================================');
  console.log('🚀 BZusic Cloud Sync: Supabase Storage + GitHub Pages');
  console.log('====================================================');
  console.log(`📁 Target Bucket: ${SUPABASE_BUCKET}`);
  console.log(`🔗 Supabase URL:  ${SUPABASE_URL}`);

  // 1. Read library.json
  if (!fs.existsSync(LIBRARY_FILE)) {
    console.error(`❌ Library file not found: ${LIBRARY_FILE}`);
    process.exit(1);
  }

  const rawLib = fs.readFileSync(LIBRARY_FILE, 'utf8');
  const library = JSON.parse(rawLib);

  // 2. Collect unique songs
  const songsMap = new Map();
  const collect = (list) => {
    (list || []).forEach(s => {
      if (s && s.videoId && !songsMap.has(s.videoId)) {
        songsMap.set(s.videoId, s);
      }
    });
  };

  (library.playlists || []).forEach(pl => collect(pl.songs));
  collect(library.liked);
  collect(library.history);

  const uniqueSongs = Array.from(songsMap.values());
  const total = uniqueSongs.length;
  console.log(`🎵 Found ${total} unique songs in local library.`);

  // 3. Prepare temp directory
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  // 4. Retrieve existing files on Supabase Storage
  console.log('\n🔍 Checking existing files in Supabase Storage...');
  const existingAudio = await listAllBucketFiles('audio');
  const existingLyrics = await listAllBucketFiles('lyrics');
  console.log(`   - Existing audio tracks: ${existingAudio.size}`);
  console.log(`   - Existing lyrics files: ${existingLyrics.size}\n`);

  // 5. Process each song
  let uploadedAudioCount = 0;
  let uploadedLyricsCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < total; i++) {
    const song = uniqueSongs[i];
    const prefix = `[${i + 1}/${total}]`;
    const audioFileName = `${song.videoId}.m4a`;
    const lyricsFileName = `${song.videoId}.lrc`;

    const hasAudio = existingAudio.has(audioFileName);
    const hasLyrics = existingLyrics.has(lyricsFileName);

    if (hasAudio && hasLyrics) {
      console.log(`${prefix} ⏩ Skipped (already synced): ${song.title} - ${song.artist}`);
      skippedCount++;
      continue;
    }

    console.log(`${prefix} 🔄 Syncing: ${song.title} - ${song.artist}...`);

    // Audio sync
    if (!hasAudio) {
      const tempAudioPath = path.join(TEMP_DIR, audioFileName);
      try {
        process.stdout.write(`       ⬇️  Downloading audio via yt-dlp... `);
        await downloadAudioYtDlp(song.videoId, tempAudioPath);
        process.stdout.write(`done. ⬆️  Uploading... `);

        const fileBuffer = fs.readFileSync(tempAudioPath);
        const { error: uploadErr } = await supabase.storage
          .from(SUPABASE_BUCKET)
          .upload(`audio/${audioFileName}`, fileBuffer, {
            contentType: 'audio/mp4',
            upsert: true
          });

        if (uploadErr) {
          throw uploadErr;
        }

        existingAudio.add(audioFileName);
        uploadedAudioCount++;
        process.stdout.write(`uploaded! ✅\n`);
      } catch (err) {
        failedCount++;
        console.log(`failed: ${err.message} ⚠️`);
      } finally {
        if (fs.existsSync(tempAudioPath)) {
          try { fs.unlinkSync(tempAudioPath); } catch (e) {}
        }
      }
    }

    // Lyrics sync
    if (!hasLyrics) {
      try {
        const lrc = await fetchLyricsLrcLib(song.title, song.artist);
        if (lrc) {
          const cleanLrc = sanitizeLyrics(lrc);
          const { error: lrcErr } = await supabase.storage
            .from(SUPABASE_BUCKET)
            .upload(`lyrics/${lyricsFileName}`, Buffer.from(cleanLrc, 'utf-8'), {
              contentType: 'text/plain; charset=utf-8',
              upsert: true
            });
          if (!lrcErr) {
            existingLyrics.add(lyricsFileName);
            uploadedLyricsCount++;
            console.log(`       📝 Synced lyrics: ${lyricsFileName} ✅`);
          }
        }
      } catch (e) {
        // Silently skip lyrics failure
      }
    }
  }

  console.log('\n📊 Sync Summary:');
  console.log(`   - Audio uploaded:  ${uploadedAudioCount}`);
  console.log(`   - Lyrics uploaded: ${uploadedLyricsCount}`);
  console.log(`   - Skipped tracks:  ${skippedCount}`);
  console.log(`   - Failed audio:    ${failedCount}`);

  // 6. Build and upload Cloud library.json
  console.log('\n☁️  Generating Cloud library.json with direct Storage URLs...');
  const cloudBase = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}`;

  const attachCloudUrls = (s) => {
    if (!s) return s;
    return {
      ...s,
      audioUrl: `${cloudBase}/audio/${s.videoId}.m4a`,
      lyricsUrl: `${cloudBase}/lyrics/${s.videoId}.lrc`
    };
  };

  const cloudLibrary = {
    liked: (library.liked || []).map(attachCloudUrls),
    playlists: (library.playlists || []).map(pl => ({
      ...pl,
      songs: (pl.songs || []).map(attachCloudUrls)
    })),
    history: (library.history || []).map(attachCloudUrls)
  };

  // Upload Base64 playlist covers to Supabase Storage covers/ folder
  console.log('\n🖼️  Checking and uploading playlist covers to Supabase Storage...');
  for (const pl of cloudLibrary.playlists) {
    if (pl.coverUrl && typeof pl.coverUrl === 'string' && pl.coverUrl.startsWith('data:image/')) {
      const match = pl.coverUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
      if (match) {
        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        const buffer = Buffer.from(match[2], 'base64');
        const fileName = `${pl.id}.${ext}`;
        try {
          const { error: coverErr } = await supabase.storage
            .from(SUPABASE_BUCKET)
            .upload(`covers/${fileName}`, buffer, {
              contentType: `image/${match[1]}`,
              upsert: true
            });
          if (!coverErr) {
            pl.coverUrl = `${cloudBase}/covers/${fileName}`;
            console.log(`   ✅ Uploaded playlist cover: covers/${fileName}`);
          } else {
            console.warn(`   ⚠️ Could not upload cover for playlist ${pl.id}:`, coverErr.message);
          }
        } catch (e) {
          console.warn(`   ⚠️ Error uploading cover for playlist ${pl.id}:`, e.message);
        }
      }
    }
  }

  const { error: libUploadErr } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload('library.json', Buffer.from(JSON.stringify(cloudLibrary, null, 2)), {
      contentType: 'application/json',
      cacheControl: '0',
      upsert: true
    });

  if (libUploadErr) {
    console.error('❌ Failed to upload library.json to Supabase:', libUploadErr.message);
  } else {
    console.log('✅ Cloud library.json uploaded successfully!');
  }

  // 7. Write public/cloud-config.js
  const cloudConfigPath = path.join(PUBLIC_DIR, 'cloud-config.js');
  const cloudConfigCode = `// Auto-generated by sync-cloud.js
window.BZUSIC_CLOUD_BASE_URL = "${cloudBase}";
`;
  fs.writeFileSync(cloudConfigPath, cloudConfigCode, 'utf8');
  console.log(`✅ Generated ${cloudConfigPath}`);

  // 8. Copy public/ to docs/ (GitHub Pages build)
  console.log('\n📦 Preparing docs/ for GitHub Pages...');
  if (fs.existsSync(DOCS_DIR)) {
    fs.rmSync(DOCS_DIR, { recursive: true, force: true });
  }
  copyDirSync(PUBLIC_DIR, DOCS_DIR);

  // Clean temp downloads
  if (fs.existsSync(TEMP_DIR)) {
    try { fs.rmSync(TEMP_DIR, { recursive: true, force: true }); } catch (e) {}
  }

  console.log('✅ Successfully copied public/ -> docs/ with relative paths.');
  console.log('\n🎉 ALL DONE! Your BZusic library is synced with Supabase Storage.');
  console.log('   You can push to GitHub and set Pages source to the /docs folder.');
  console.log('====================================================\n');
}

main().catch(err => {
  console.error('❌ Unexpected Fatal Error in sync-cloud.js:', err);
  process.exit(1);
});
