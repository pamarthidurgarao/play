import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://mp3teluguwap.net/mp3/';

async function fetchHTML(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

function parseDirectory(html, url) {
  const hrefRegex = /href="([^"]+)"/g;
  let match;
  const directories = [];
  const songs = [];

  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1];
    
    // Ignore navigation links
    if (href.startsWith('?') || href.startsWith('/') || href === '../') {
      continue;
    }

    const decodedHref = decodeURIComponent(href);
    const name = decodedHref.replace(/\/$/, '');

    if (decodedHref.endsWith('/')) {
      directories.push({ name, path: decodedHref });
    } else if (decodedHref.endsWith('.mp3')) {
      songs.push({
        name: name.replace(/\.mp3$/, ''),
        url: url + href
      });
    }
  }

  return { directories, songs };
}

async function run() {
  console.log('Starting pre-discovery scrape of TeluguWAP...');
  
  try {
    const rootHtml = await fetchHTML(BASE_URL);
    const rootData = parseDirectory(rootHtml, BASE_URL);
    const categories = rootData.directories.filter(d => d.name !== 'old');
    
    let totalAlbums = [];
    let totalSongs = [];
    
    console.log(`Found ${categories.length} categories/years.`);

    for (const cat of categories) {
      const catUrl = BASE_URL + cat.path;
      console.log(`Scanning category: ${cat.name}...`);
      
      try {
        const catHtml = await fetchHTML(catUrl);
        const catData = parseDirectory(catHtml, catUrl);

        if (catData.songs.length > 0) {
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
        console.error(`Failed to scan category ${cat.name}:`, err.message);
      }
    }

    console.log(`Scanned categories. Found ${totalAlbums.length} albums. Scraping song lists...`);

    // Scan each album (concurrency limit + rate limit delay)
    const batchSize = 3;
    for (let i = 0; i < totalAlbums.length; i += batchSize) {
      const batch = totalAlbums.slice(i, i + batchSize);
      console.log(`Progress: Scanned ${i}/${totalAlbums.length} albums...`);
      
      await Promise.all(batch.map(async (album) => {
        const albumUrl = BASE_URL + album.path;
        try {
          const albumHtml = await fetchHTML(albumUrl);
          const albumData = parseDirectory(albumHtml, albumUrl);
          
          albumData.songs.forEach(song => {
            totalSongs.push({
              title: song.name,
              url: song.url,
              albumPath: album.path,
              albumTitle: album.name,
              year: album.year
            });
          });

          // iTunes Artwork lookup
          try {
            const query = `${album.name} Telugu`;
            const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=album&limit=1`);
            if (itunesRes.ok) {
              const data = await itunesRes.json();
              if (data.results && data.results.length > 0) {
                album.artworkUrl = data.results[0].artworkUrl100.replace('100x100bb', '300x300bb');
              } else {
                album.artworkUrl = 'placeholder';
              }
            } else {
              album.artworkUrl = 'placeholder';
            }
          } catch (e) {
            album.artworkUrl = 'placeholder';
          }
        } catch (err) {
          console.error(`Failed to scrape songs for album ${album.name}:`, err.message);
        }
      }));

      // Delay 150ms between batches to play nice with iTunes rate limiting
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    const outputData = {
      lastScanTime: Date.now(),
      albums: totalAlbums,
      songs: totalSongs
    };

    const outDir = './public';
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir);
    }
    
    fs.writeFileSync(
      path.join(outDir, 'songs.json'), 
      JSON.stringify(outputData, null, 2), 
      'utf-8'
    );
    
    console.log(`Pre-discovery complete! Saved ${totalSongs.length} songs and ${totalAlbums.length} albums to public/songs.json`);
  } catch (err) {
    console.error('Fatal scrape error:', err);
  }
}

run();
