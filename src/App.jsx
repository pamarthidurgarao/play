import React, { useState, useEffect, useRef } from 'react';
import { 
  Home as HomeIcon, Search as SearchIcon, Database, 
  Heart, Music, Volume2, RotateCw, Play, 
  Trash2, RefreshCw, AlertCircle, AlertTriangle
} from 'lucide-react';
import { runScraper, getAllFromStore, initDB, writeToStore } from './utils/scraper';
import AlbumCard from './components/AlbumCard';
import PlayerBar from './components/PlayerBar';
import Visualizer from './components/Visualizer';

export default function App() {
  // DB & Scraper states
  const [albums, setAlbums] = useState([]);
  const [songs, setSongs] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ status: 'Idle', percent: 0 });
  const [lastSync, setLastSync] = useState(null);

  // App UI Navigation
  const [currentView, setCurrentView] = useState('home'); // 'home', 'album', 'search', 'favorites'
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [favorites, setFavorites] = useState([]);

  // Audio Playback states
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  
  // Audio Queue
  const [queue, setQueue] = useState([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(-1);
  
  // Visualizer & Caching states
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [cachedUrls, setCachedUrls] = useState(new Set());

  const audioRef = useRef(null);

  // Load Initial Library data directly from pre-discovered songs.json
  useEffect(() => {
    async function loadLibrary() {
      try {
        // Try relative path first, then fallbacks for different deployment scopes
        let response = await fetch('songs.json');
        if (!response.ok) {
          response = await fetch(`${import.meta.env.BASE_URL}songs.json`);
        }
        if (!response.ok) {
          response = await fetch('/play/songs.json');
        }
        
        if (response.ok) {
          const data = await response.json();
          setAlbums(data.albums || []);
          setSongs(data.songs || []);
          setLastSync(data.lastScanTime);
        }
        
        // Load Favorites
        const storedFavs = localStorage.getItem('favorites');
        if (storedFavs) {
          setFavorites(JSON.parse(storedFavs));
        }

        // Check Cached Songs
        if ('caches' in window) {
          const cache = await caches.open('wap-audio-cache');
          const requests = await cache.keys();
          const urls = new Set(requests.map(req => req.url));
          setCachedUrls(urls);
        }
      } catch (err) {
        console.error('Failed to load library database:', err);
      }
    }
    loadLibrary();
  }, []);

  // Update HTML Audio Element states
  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;

    const handleTimeUpdate = () => setProgress(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);
    const handleEnded = () => handleNext();

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [queue, currentQueueIndex, isRepeat]);

  // Audio volume sync
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Track changed metadata updates
  useEffect(() => {
    if (!currentSong) return;

    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    // Use local proxy if on localhost, otherwise fallback to CORS proxy
    const audioSrc = isLocal 
      ? currentSong.url.replace('https://mp3teluguwap.net', '/api-proxy')
      : `https://corsproxy.io/?${encodeURIComponent(currentSong.url)}`;
    
    if (audioRef.current) {
      audioRef.current.src = audioSrc;
      if (isPlaying) {
        audioRef.current.play().catch(e => console.warn("Auto-play blocked:", e));
      }
    }

    // Media Session integration
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title,
        artist: currentSong.albumTitle,
        album: currentSong.albumTitle,
        artwork: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => {
        setIsPlaying(true);
        audioRef.current?.play();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        setIsPlaying(false);
        audioRef.current?.pause();
      });
      navigator.mediaSession.setActionHandler('previoustrack', handlePrev);
      navigator.mediaSession.setActionHandler('nexttrack', handleNext);
    }
  }, [currentSong]);

  // Sync Library Scraper Action
  const handleSyncDatabase = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const data = await runScraper((progress) => {
        setSyncProgress(progress);
      });
      setAlbums(data.albums);
      setSongs(data.songs);
      setLastSync(Date.now());
      setIsSyncing(false);
      setCurrentView('home');
    } catch (err) {
      console.error(err);
      setIsSyncing(false);
    }
  };

  // Playback Control Handlers
  const handlePlayPause = () => {
    if (!currentSong && songs.length > 0) {
      // Play first song in list
      playSong(songs[0], songs);
      return;
    }
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().catch(e => console.error(e));
        setIsPlaying(true);
      }
    }
  };

  const playSong = (song, customQueue = null) => {
    setCurrentSong(song);
    setIsPlaying(true);
    
    if (customQueue) {
      setQueue(customQueue);
      const index = customQueue.findIndex(s => s.url === song.url);
      setCurrentQueueIndex(index >= 0 ? index : 0);
    } else {
      // Add single song to queue
      setQueue([song]);
      setCurrentQueueIndex(0);
    }
  };

  const handleNext = () => {
    if (queue.length === 0) return;
    
    if (isRepeat) {
      // Loop single song
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
      return;
    }

    let nextIndex = currentQueueIndex + 1;
    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else if (nextIndex >= queue.length) {
      nextIndex = 0; // Loop queue
    }

    setCurrentQueueIndex(nextIndex);
    setCurrentSong(queue[nextIndex]);
  };

  const handlePrev = () => {
    if (queue.length === 0) return;
    
    let prevIndex = currentQueueIndex - 1;
    if (isShuffle) {
      prevIndex = Math.floor(Math.random() * queue.length);
    } else if (prevIndex < 0) {
      prevIndex = queue.length - 1;
    }

    setCurrentQueueIndex(prevIndex);
    setCurrentSong(queue[prevIndex]);
  };

  const handleSeek = (time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  };

  // Search filter
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const query = searchQuery.toLowerCase();
    const filtered = songs.filter(
      song => 
        song.title.toLowerCase().includes(query) || 
        song.albumTitle.toLowerCase().includes(query)
    );
    setSearchResults(filtered);
  }, [searchQuery, songs]);

  // Favorites
  const toggleFavorite = (song) => {
    let updated;
    const isFav = favorites.some(f => f.url === song.url);
    if (isFav) {
      updated = favorites.filter(f => f.url !== song.url);
    } else {
      updated = [...favorites, song];
    }
    setFavorites(updated);
    localStorage.setItem('favorites', JSON.stringify(updated));
  };

  // Offline Caching using Cache API
  const handleCacheSong = async (song) => {
    if (!song || !('caches' in window)) return;
    
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const proxyUrl = isLocal 
      ? song.url.replace('https://mp3teluguwap.net', '/api-proxy')
      : `https://corsproxy.io/?${encodeURIComponent(song.url)}`;
    
    try {
      const cache = await caches.open('wap-audio-cache');
      
      if (cachedUrls.has(proxyUrl)) {
        // Delete from cache
        await cache.delete(proxyUrl);
        const updated = new Set(cachedUrls);
        updated.delete(proxyUrl);
        setCachedUrls(updated);
      } else {
        // Fetch and cache
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error('Failed to download audio file');
        await cache.put(proxyUrl, res);
        
        const updated = new Set(cachedUrls);
        updated.add(proxyUrl);
        setCachedUrls(updated);
      }
    } catch (err) {
      alert(`Caching failed: ${err.message}`);
    }
  };

  const playAlbum = (album) => {
    const albumSongs = songs.filter(s => s.albumPath === album.path);
    if (albumSongs.length > 0) {
      playSong(albumSongs[0], albumSongs);
    }
  };

  // Check if current song is cached
  const isCurrentSongCached = currentSong 
    ? cachedUrls.has(
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
          ? currentSong.url.replace('https://mp3teluguwap.net', '/api-proxy')
          : `https://corsproxy.io/?${encodeURIComponent(currentSong.url)}`
      )
    : false;

  return (
    <div className="app-container">
      <audio ref={audioRef} />

      {/* Sidebar */}
      <div className="sidebar">
        <div className="logo-container">
          <Music className="logo-icon" size={28} />
          <span>TeluguWAP</span>
        </div>

        <div className="nav-group">
          <button 
            className={`nav-item ${currentView === 'home' ? 'active' : ''}`}
            onClick={() => setCurrentView('home')}
          >
            <HomeIcon size={20} />
            <span>Discover</span>
          </button>
          <button 
            className={`nav-item ${currentView === 'search' ? 'active' : ''}`}
            onClick={() => setCurrentView('search')}
          >
            <SearchIcon size={20} />
            <span>Search</span>
          </button>
          <button 
            className={`nav-item ${currentView === 'favorites' ? 'active' : ''}`}
            onClick={() => setCurrentView('favorites')}
          >
            <Heart size={20} />
            <span>Favorites</span>
          </button>
        </div>

        {/* Database Control Card */}
        <div className="sync-card">
          <span className="sync-header">Music Sync</span>
          <div className="sync-status">
            <Database size={16} />
            <span>{songs.length} Songs Loaded</span>
          </div>
          {lastSync && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Last Sync: {new Date(lastSync).toLocaleDateString()}
            </span>
          )}
          <button 
            className="sync-btn" 
            onClick={handleSyncDatabase} 
            disabled={isSyncing}
          >
            <RefreshCw size={14} className={isSyncing ? 'spin-animation' : ''} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Database'}</span>
          </button>
          {isSyncing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div className="sync-progress-bar">
                <div 
                  className="sync-progress-fill" 
                  style={{ width: `${syncProgress.percent}%` }}
                ></div>
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-active)' }}>
                {syncProgress.status}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content panel */}
      <div className="main-content">
        <header className="main-header">
          <div className="search-bar">
            <SearchIcon size={18} style={{ color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="search-input" 
              placeholder="Search songs or albums..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (currentView !== 'search') setCurrentView('search');
              }}
            />
          </div>
        </header>

        {/* Initial setup prompt if DB is empty */}
        {songs.length === 0 && !isSyncing && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', 
            justifyContent: 'center', flex: 1, gap: '20px', padding: '40px', textAlign: 'center'
          }}>
            <AlertTriangle size={64} style={{ color: 'var(--accent-color)' }} />
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Welcome to TeluguWAP Music</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: '450px' }}>
              The music index is currently empty. Click the Sync button to scan the server directories and fetch available songs.
            </p>
            <button className="sync-btn" onClick={handleSyncDatabase} style={{ padding: '12px 24px', borderRadius: '30px' }}>
              <RefreshCw size={16} style={{ marginRight: '8px' }} /> Sync Library (Requires CORS proxy access)
            </button>
          </div>
        )}

        {/* Home view (Albums and Years) */}
        {currentView === 'home' && songs.length > 0 && (
          <div className="dashboard-view">
            <div>
              <h2 className="section-title">Latest & Trending Albums</h2>
              <div className="albums-grid">
                {albums.slice(0, 18).map(album => (
                  <AlbumCard 
                    key={album.path} 
                    album={album} 
                    onClick={() => {
                      setSelectedAlbum(album);
                      setCurrentView('album');
                    }}
                    onPlayClick={playAlbum}
                  />
                ))}
              </div>
            </div>

            <div>
              <h2 className="section-title">All Indexed Albums</h2>
              <div className="albums-grid">
                {albums.map(album => (
                  <AlbumCard 
                    key={album.path} 
                    album={album} 
                    onClick={() => {
                      setSelectedAlbum(album);
                      setCurrentView('album');
                    }}
                    onPlayClick={playAlbum}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Album Detail View */}
        {currentView === 'album' && selectedAlbum && (
          <div className="album-detail-view">
            <div className="album-detail-header">
              <div className="album-detail-art" style={{ overflow: 'hidden' }}>
                {selectedAlbum.artworkUrl && selectedAlbum.artworkUrl !== 'placeholder' ? (
                  <img src={selectedAlbum.artworkUrl} alt={selectedAlbum.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  selectedAlbum.name.charAt(0)
                )}
              </div>
              <div className="album-detail-info">
                <span className="album-detail-type">{selectedAlbum.year} Album</span>
                <h1 className="album-detail-title">{selectedAlbum.name}</h1>
                <span className="album-detail-stats">
                  {songs.filter(s => s.albumPath === selectedAlbum.path).length} Songs • category: {selectedAlbum.category}
                </span>
              </div>
            </div>

            <div className="songs-list-container">
              {songs
                .filter(song => song.albumPath === selectedAlbum.path)
                .map((song, index) => {
                  const isActive = currentSong?.url === song.url;
                  const isFav = favorites.some(f => f.url === song.url);
                  return (
                    <div 
                      key={song.url} 
                      className={`song-row ${isActive ? 'active' : ''}`}
                      onClick={() => playSong(song, songs.filter(s => s.albumPath === selectedAlbum.path))}
                    >
                      <span className="song-index">{index + 1}</span>
                      <div className="song-title-col">
                        <span className="song-title">{song.title}</span>
                      </div>
                      <span className="song-time">3:45</span> {/* Static time or fetch dynamically */}
                      <button 
                        className="song-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(song);
                        }}
                        style={{ color: isFav ? 'var(--accent-secondary)' : '' }}
                      >
                        <Heart size={16} fill={isFav ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Search Results View */}
        {currentView === 'search' && (
          <div className="search-results-view">
            <h2 className="section-title">
              {searchQuery ? `Search Results for "${searchQuery}"` : 'Global Search'}
            </h2>
            
            {searchResults.length > 0 ? (
              <div className="songs-list-container">
                {searchResults.map((song, index) => {
                  const isActive = currentSong?.url === song.url;
                  const isFav = favorites.some(f => f.url === song.url);
                  return (
                    <div 
                      key={song.url} 
                      className={`song-row ${isActive ? 'active' : ''}`}
                      onClick={() => playSong(song, searchResults)}
                    >
                      <span className="song-index">{index + 1}</span>
                      <div className="song-title-col">
                        <span className="song-title">{song.title}</span>
                        <span className="song-album-name">{song.albumTitle}</span>
                      </div>
                      <span className="song-time">3:45</span>
                      <button 
                        className="song-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(song);
                        }}
                        style={{ color: isFav ? 'var(--accent-secondary)' : '' }}
                      >
                        <Heart size={16} fill={isFav ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>
                {searchQuery ? 'No songs matched your query.' : 'Type something in the search bar above.'}
              </div>
            )}
          </div>
        )}

        {/* Favorites View */}
        {currentView === 'favorites' && (
          <div className="search-results-view">
            <h2 className="section-title">Your Favorite Songs</h2>

            {favorites.length > 0 ? (
              <div className="songs-list-container">
                {favorites.map((song, index) => {
                  const isActive = currentSong?.url === song.url;
                  return (
                    <div 
                      key={song.url} 
                      className={`song-row ${isActive ? 'active' : ''}`}
                      onClick={() => playSong(song, favorites)}
                    >
                      <span className="song-index">{index + 1}</span>
                      <div className="song-title-col">
                        <span className="song-title">{song.title}</span>
                        <span className="song-album-name">{song.albumTitle}</span>
                      </div>
                      <span className="song-time">3:45</span>
                      <button 
                        className="song-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(song);
                        }}
                        style={{ color: 'var(--accent-secondary)' }}
                      >
                        <Heart size={16} fill="currentColor" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>
                You haven't added any favorites yet.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Playback Controls (Sticky Footer) */}
      <PlayerBar 
        currentSong={currentSong}
        isPlaying={isPlaying}
        onPlayPauseToggle={handlePlayPause}
        onNext={handleNext}
        onPrev={handlePrev}
        progress={progress}
        duration={duration}
        onSeek={handleSeek}
        volume={volume}
        onVolumeChange={setVolume}
        isMuted={isMuted}
        onMuteToggle={() => setIsMuted(!isMuted)}
        isShuffle={isShuffle}
        onShuffleToggle={() => setIsShuffle(!isShuffle)}
        isRepeat={isRepeat}
        onRepeatToggle={() => setIsRepeat(!isRepeat)}
        onToggleVisualizer={() => setShowVisualizer(!showVisualizer)}
        isCached={isCurrentSongCached}
        onCacheSong={() => handleCacheSong(currentSong)}
        currentSongArtwork={
          currentSong 
            ? albums.find(a => a.path === currentSong.albumPath)?.artworkUrl 
            : null
        }
      />

      {/* Visualizer Fullscreen Overlay */}
      {showVisualizer && (
        <Visualizer 
          audioRef={audioRef} 
          isPlaying={isPlaying} 
          onClose={() => setShowVisualizer(false)} 
        />
      )}

      {/* Mobile Navigation Bottom Bar */}
      <div className="mobile-nav-bar">
        <button 
          className={`mobile-nav-item ${currentView === 'home' ? 'active' : ''}`}
          onClick={() => setCurrentView('home')}
        >
          <HomeIcon size={20} />
          <span>Discover</span>
        </button>
        <button 
          className={`mobile-nav-item ${currentView === 'search' ? 'active' : ''}`}
          onClick={() => setCurrentView('search')}
        >
          <SearchIcon size={20} />
          <span>Search</span>
        </button>
        <button 
          className={`mobile-nav-item ${currentView === 'favorites' ? 'active' : ''}`}
          onClick={() => setCurrentView('favorites')}
        >
          <Heart size={20} />
          <span>Favs</span>
        </button>
      </div>
    </div>
  );
}
