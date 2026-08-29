import React from 'react';
import { Play } from 'lucide-react';

export default function AlbumCard({ album, onClick, onPlayClick }) {
  // Generates a nice background pattern letter based on the title
  const initial = album.name.charAt(0).toUpperCase();

  const handlePlayClick = (e) => {
    e.stopPropagation();
    onPlayClick(album);
  };

  return (
    <div className="album-card" onClick={onClick}>
      <div className="album-art-container" style={{ overflow: 'hidden' }}>
        {album.artworkUrl && album.artworkUrl !== 'placeholder' ? (
          <img 
            src={album.artworkUrl} 
            alt={album.name} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy"
          />
        ) : (
          <span className="album-art-text">{initial}</span>
        )}
        <button className="play-hover-btn" onClick={handlePlayClick} title="Play Album">
          <Play size={20} fill="currentColor" />
        </button>
      </div>
      
      <div className="album-info">
        <span className="album-title" title={album.name}>
          {album.name}
        </span>
        <span className="album-meta">
          {album.year} • {album.category}
        </span>
      </div>
    </div>
  );
}
