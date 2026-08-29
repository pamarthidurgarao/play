// IndexedDB setup
const DB_NAME = 'WAPPlayerDB';
const DB_VERSION = 1;

export function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('albums')) {
        db.createObjectStore('albums', { keyPath: 'path' });
      }
      if (!db.objectStoreNames.contains('songs')) {
        const songStore = db.createObjectStore('songs', { keyPath: 'url' });
        songStore.createIndex('albumPath', 'albumPath', { unique: false });
        songStore.createIndex('title', 'title', { unique: false });
      }
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'key' });
      }
    };
  });
}

// Write helper
export async function writeToStore(storeName, data) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    
    if (Array.isArray(data)) {
      data.forEach(item => store.put(item));
    } else {
      store.put(data);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Read helpers
export async function getAllFromStore(storeName) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function clearStore(storeName) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Scraper logic using CORS proxy or local proxy
const CORS_PROXIES = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`
];

async function fetchHTML(url, proxyIndex = 0) {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  // If running locally, route requests transparently through the local dev proxy
  if (isLocal && url.startsWith('https://mp3teluguwap.net')) {
    const localUrl = url.replace('https://mp3teluguwap.net', '/api-proxy');
    try {
      const res = await fetch(localUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      console.warn(`Local proxy fetch failed for ${localUrl}, falling back to public CORS proxy:`, err);
    }
  }

  if (proxyIndex >= CORS_PROXIES.length) {
    throw new Error('All CORS proxies failed to fetch URL');
  }
  try {
    const proxyUrl = CORS_PROXIES[proxyIndex](url);
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const htmlText = await res.text();
    return htmlText;
  } catch (err) {
    console.warn(`Proxy ${proxyIndex} failed for ${url}:`, err);
    return fetchHTML(url, proxyIndex + 1);
  }
}

// Scrapes a single directory listing URL
async function scrapeDirectory(url) {
  const html = await fetchHTML(url);
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const links = Array.from(doc.querySelectorAll('a'));

  const directories = [];
  const songs = [];

  links.forEach(link => {
    const href = link.getAttribute('href');
    const name = link.textContent.trim();

    // Ignore navigation/sort links
    if (!href || href.startsWith('?') || href.startsWith('/') || href === '../' || name === 'Parent Directory') {
      return;
    }

    const decodedHref = decodeURIComponent(href);

    if (decodedHref.endsWith('/')) {
      directories.push({
        name: name.replace(/\/$/, ''),
        path: decodedHref
      });
    } else if (decodedHref.endsWith('.mp3')) {
      songs.push({
        name: name.replace(/\.mp3$/, ''),
        url: url + href
      });
    }
  });

  return { directories, songs };
}

// Recursive scraper that runs on demand in the background
export async function runScraper(onProgress) {
  const baseUrl = 'https://mp3teluguwap.net/mp3/';
  const db = await initDB();
  
  onProgress({ status: 'Starting scan...', percent: 5 });

  try {
    // 1. Get root categories (years and main folders)
    const rootData = await scrapeDirectory(baseUrl);
    const categories = rootData.directories.filter(d => d.name !== 'old'); // ignore 'old' to keep DB cleaner, or scan it later
    
    let totalAlbums = [];
    let totalSongs = [];
    
    let currentStep = 0;
    const totalSteps = categories.length;

    // 2. Loop through categories (like 2026, 2025, Ismart, etc.)
    for (const cat of categories) {
      currentStep++;
      const catUrl = baseUrl + cat.path;
      onProgress({ 
        status: `Scanning category: ${cat.name}...`, 
        percent: Math.min(10 + Math.floor((currentStep / totalSteps) * 40), 50) 
      });

      try {
        const catData = await scrapeDirectory(catUrl);
        
        // Some categories have albums directly, others might have songs directly (e.g. Folk/Tones)
        if (catData.songs.length > 0) {
          // It's a directory of songs directly (like Folk Songs)
          const albumPath = cat.path;
          totalAlbums.push({
            name: cat.name,
            path: albumPath,
            category: cat.name,
            year: cat.name.match(/\d{4}/) ? cat.name : 'Folk/Other'
          });
          
          catData.songs.forEach(song => {
            totalSongs.push({
              title: song.name,
              url: song.url,
              albumPath: albumPath,
              albumTitle: cat.name,
              year: cat.name.match(/\d{4}/) ? cat.name : 'Folk/Other'
            });
          });
        }

        // Process subdirectories (which are the actual movies/albums)
        for (const subDir of catData.directories) {
          const albumPath = cat.path + subDir.path;
          totalAlbums.push({
            name: subDir.name,
            path: albumPath,
            category: cat.name,
            year: cat.name.match(/\d{4}/) ? cat.name : 'Movie'
          });
        }
      } catch (err) {
        console.error(`Failed to scan category ${cat.name}`, err);
      }
    }

    onProgress({ status: 'Discovered albums. Fetching tracks...', percent: 55 });

    // 3. Scan each album to get its songs
    let albumCount = 0;
    const albumTotal = totalAlbums.length;
    
    // Scan in batches to avoid overwhelming public CORS proxies
    const batchSize = 3;
    for (let i = 0; i < totalAlbums.length; i += batchSize) {
      const batch = totalAlbums.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (album) => {
        const albumUrl = baseUrl + album.path;
        try {
          const albumData = await scrapeDirectory(albumUrl);
          albumData.songs.forEach(song => {
            totalSongs.push({
              title: song.name,
              url: song.url,
              albumPath: album.path,
              albumTitle: album.name,
              year: album.year
            });
          });
        } catch (err) {
          console.error(`Failed to scrape songs for album: ${album.name}`, err);
        }
        albumCount++;
      }));

      onProgress({ 
        status: `Scanned ${albumCount}/${albumTotal} albums...`, 
        percent: Math.min(55 + Math.floor((albumCount / albumTotal) * 40), 95) 
      });
    }

    // 4. Save to IndexedDB
    onProgress({ status: 'Saving to Database...', percent: 97 });
    await clearStore('albums');
    await clearStore('songs');
    await writeToStore('albums', totalAlbums);
    await writeToStore('songs', totalSongs);
    await writeToStore('metadata', { key: 'lastScanTime', value: Date.now() });

    onProgress({ status: 'Sync Completed!', percent: 100 });
    return { albums: totalAlbums, songs: totalSongs };
  } catch (error) {
    onProgress({ status: `Sync failed: ${error.message}`, percent: 0, error: true });
    throw error;
  }
}
