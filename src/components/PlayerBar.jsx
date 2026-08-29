import React, { useState } from 'react';
import { 
  Play, Pause, SkipForward, SkipBack, 
  Shuffle, RotateCw, Volume2, VolumeX, 
  Maximize2, Download, CheckCircle, Flame,
  ChevronDown
} from 'lucide-react';

export default function PlayerBar({ 
  currentSong, 
  isPlaying, 
  onPlayPauseToggle, 
  onNext, 
  onPrev, 
  progress, 
  duration, 
  onSeek, 
  volume, 
  onVolumeChange, 
  isMuted, 
  onMuteToggle,
  isShuffle, 
  onShuffleToggle, 
  isRepeat, 
  onRepeatToggle, 
  onToggleVisualizer,
  isCached,
  onCacheSong,
  currentSongArtwork
}) {
  const [isExpandedMobile, setIsExpandedMobile] = useState(false);

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handleMobileBarClick = (e) => {
    // Only open if clicked on details or empty space
    if (window.innerWidth <= 768 && !e.target.closest('button') && !e.target.closest('input')) {
      setIsExpandedMobile(true);
    }
  };

  return (
    <>
      {/* Expanded Fullscreen Mobile Player */}
      {isExpandedMobile && currentSong && (
        <div className="mobile-expanded-player">
          <header className="expanded-header">
            <button className="player-btn" onClick={() => setIsExpandedMobile(false)}>
              <ChevronDown size={28} />
            </button>
            <span>Now Playing</span>
            <button className="player-btn" onClick={onToggleVisualizer}>
              <Maximize2 size={20} />
            </button>
          </header>

          <div className="expanded-art-container">
            <div className="expanded-art">
              {currentSongArtwork && currentSongArtwork !== 'placeholder' ? (
                <img src={currentSongArtwork} alt="Cover" />
              ) : (
                <Flame size={72} />
              )}
            </div>
          </div>

          <div className="expanded-track-details">
            <h2 className="expanded-title">{currentSong.title}</h2>
            <p className="expanded-subtitle">{currentSong.albumTitle} ({currentSong.year})</p>
          </div>

          <div className="expanded-progress-section">
            <div className="player-progress-container">
              <input 
                type="range" 
                min="0" 
                max={duration || 100} 
                value={progress} 
                onChange={(e) => onSeek(parseFloat(e.target.value))}
                style={{
                  background: `linear-gradient(to right, var(--accent-color) 0%, var(--accent-color) ${
                    duration ? (progress / duration) * 100 : 0
                  }%, rgba(255, 255, 255, 0.1) ${
                    duration ? (progress / duration) * 100 : 0
                  }%, rgba(255, 255, 255, 0.1) 100%)`
                }}
              />
            </div>
            <div className="expanded-time-labels">
              <span>{formatTime(progress)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="expanded-controls">
            <button 
              className={`player-btn ${isShuffle ? 'active' : ''}`}
              onClick={onShuffleToggle}
            >
              <Shuffle size={22} />
            </button>
            <button className="player-btn" onClick={onPrev}>
              <SkipBack size={28} />
            </button>
            <button className="player-btn player-btn-main" onClick={onPlayPauseToggle} style={{ width: '72px', height: '72px' }}>
              {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" />}
            </button>
            <button className="player-btn" onClick={onNext}>
              <SkipForward size={28} />
            </button>
            <button 
              className={`player-btn ${isRepeat ? 'active' : ''}`}
              onClick={onRepeatToggle}
            >
              <RotateCw size={22} />
            </button>
          </div>

          <div className="expanded-footer-controls">
            <button 
              className="player-btn" 
              onClick={onCacheSong}
              style={{ color: isCached ? '#10b981' : '' }}
            >
              {isCached ? <CheckCircle size={22} /> : <Download size={22} />}
            </button>
            <div className="volume-bar" style={{ flex: 1, maxWidth: '200px' }}>
              <button className="player-btn" onClick={onMuteToggle}>
                {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05"
                value={isMuted ? 0 : volume} 
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                style={{
                  background: `linear-gradient(to right, var(--accent-color) 0%, var(--accent-color) ${
                    (isMuted ? 0 : volume) * 100
                  }%, rgba(255, 255, 255, 0.1) ${(isMuted ? 0 : volume) * 100}%, rgba(255, 255, 255, 0.1) 100%)`
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Standard Desktop / Mobile Mini Player Bar */}
      <div className="player-bar" onClick={handleMobileBarClick}>
        {/* Left Details */}
        <div className="player-track-info">
          <div className="player-album-art" style={{ overflow: 'hidden' }}>
            {currentSongArtwork && currentSongArtwork !== 'placeholder' ? (
              <img src={currentSongArtwork} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : currentSong ? (
              currentSong.albumTitle.charAt(0)
            ) : (
              <Flame />
            )}
          </div>
          {currentSong ? (
            <div className="player-track-details">
              <span className="player-track-title" title={currentSong.title}>
                {currentSong.title}
              </span>
              <span className="player-track-album" title={currentSong.albumTitle}>
                {currentSong.albumTitle} ({currentSong.year})
              </span>
            </div>
          ) : (
            <div className="player-track-details">
              <span className="player-track-title">No song playing</span>
              <span className="player-track-album">Select a song to start</span>
            </div>
          )}
        </div>

        {/* Middle Playback Controls */}
        <div className="player-controls">
          <div className="player-buttons">
            <button 
              className={`player-btn ${isShuffle ? 'active' : ''}`}
              onClick={onShuffleToggle}
              title="Shuffle"
            >
              <Shuffle size={18} />
            </button>
            
            <button className="player-btn" onClick={onPrev} title="Previous">
              <SkipBack size={20} />
            </button>
            
            <button 
              className="player-btn player-btn-main" 
              onClick={onPlayPauseToggle}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
            </button>
            
            <button className="player-btn" onClick={onNext} title="Next">
              <SkipForward size={20} />
            </button>
            
            <button 
              className={`player-btn ${isRepeat ? 'active' : ''}`}
              onClick={onRepeatToggle}
              title="Repeat"
            >
              <RotateCw size={18} />
            </button>
          </div>

          <div className="player-progress-container">
            <span>{formatTime(progress)}</span>
            <input 
              type="range" 
              min="0" 
              max={duration || 100} 
              value={progress} 
              onChange={(e) => onSeek(parseFloat(e.target.value))}
              style={{
                background: `linear-gradient(to right, var(--accent-color) 0%, var(--accent-color) ${
                  duration ? (progress / duration) * 100 : 0
                }%, rgba(255, 255, 255, 0.1) ${
                  duration ? (progress / duration) * 100 : 0
                }%, rgba(255, 255, 255, 0.1) 100%)`
              }}
            />
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="player-right-controls">
          {currentSong && (
            <button 
              className="player-btn" 
              onClick={onCacheSong}
              title={isCached ? "Available Offline" : "Download song for offline use"}
              style={{ color: isCached ? '#10b981' : '' }}
            >
              {isCached ? <CheckCircle size={20} /> : <Download size={20} />}
            </button>
          )}

          <button className="player-btn" onClick={onToggleVisualizer} title="Fullscreen Visualizer">
            <Maximize2 size={20} />
          </button>

          <div className="volume-bar">
            <button className="player-btn" onClick={onMuteToggle}>
              {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.05"
              value={isMuted ? 0 : volume} 
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              style={{
                background: `linear-gradient(to right, var(--accent-color) 0%, var(--accent-color) ${
                  (isMuted ? 0 : volume) * 100
                }%, rgba(255, 255, 255, 0.1) ${(isMuted ? 0 : volume) * 100}%, rgba(255, 255, 255, 0.1) 100%)`
              }}
            />
          </div>
        </div>

        {/* Mobile controls override inside grid for mini player */}
        <div className="mobile-mini-controls">
          <button className="player-btn player-btn-main" onClick={onPlayPauseToggle} style={{ width: '40px', height: '40px' }}>
            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
          </button>
          <button className="player-btn" onClick={onNext}>
            <SkipForward size={20} />
          </button>
        </div>
      </div>
    </>
  );
}
