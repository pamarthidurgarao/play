import React, { useEffect, useRef, useState } from 'react';
import { X, Sliders, Activity, Disc } from 'lucide-react';

export default function Visualizer({ audioRef, isPlaying, onClose }) {
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationRef = useRef(null);
  const [visualMode, setVisualMode] = useState('bars'); // 'bars', 'wave', 'circle'

  useEffect(() => {
    if (!audioRef.current) return;

    const audio = audioRef.current;
    
    // Connect Web Audio API elements safely
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        
        // Connect the audio element to context
        sourceRef.current = audioContextRef.current.createMediaElementSource(audio);
        sourceRef.current.connect(analyserRef.current);
        analyserRef.current.connect(audioContextRef.current.destination);
      }

      // Resume context if suspended (browser security)
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
    } catch (e) {
      console.warn("AudioContext connection warning (likely already connected):", e);
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    if (!analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const resizeCanvas = () => {
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Draw Loop
    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      
      const width = canvas.width;
      const height = canvas.height;
      
      // Clear canvas with transparent fade for trail effect
      ctx.fillStyle = 'rgba(9, 13, 22, 0.15)';
      ctx.fillRect(0, 0, width, height);

      if (visualMode === 'bars') {
        analyser.getByteFrequencyData(dataArray);
        const barWidth = (width / bufferLength) * 1.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          barHeight = dataArray[i];

          // Create a glowing gradient
          const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight * 1.8);
          gradient.addColorStop(0, '#8b5cf6'); // Violet
          gradient.addColorStop(0.5, '#ec4899'); // Pink
          gradient.addColorStop(1, '#60a5fa'); // Light blue

          ctx.fillStyle = gradient;
          
          // Draw symmetric double-sided bars
          ctx.fillRect(x, height - barHeight * 1.5, barWidth - 4, barHeight * 1.5);
          ctx.fillRect(x, 0, barWidth - 4, barHeight * 0.4); // subtle mirror top

          x += barWidth;
        }
      } else if (visualMode === 'wave') {
        analyser.getByteTimeDomainData(dataArray);
        ctx.lineWidth = 3;
        
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, '#8b5cf6');
        gradient.addColorStop(0.5, '#ec4899');
        gradient.addColorStop(1, '#3b82f6');
        ctx.strokeStyle = gradient;
        
        ctx.beginPath();
        
        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();
      } else if (visualMode === 'circle') {
        analyser.getByteFrequencyData(dataArray);
        const centerX = width / 2;
        const centerY = height / 2;
        const baseRadius = Math.min(width, height) * 0.2;

        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw frequency lines radiating outwards
        for (let i = 0; i < bufferLength; i++) {
          const angle = (i / bufferLength) * Math.PI * 2;
          const value = dataArray[i];
          const radiusLength = baseRadius + (value * 0.7);

          const x1 = centerX + Math.cos(angle) * baseRadius;
          const y1 = centerY + Math.sin(angle) * baseRadius;
          const x2 = centerX + Math.cos(angle) * radiusLength;
          const y2 = centerY + Math.sin(angle) * radiusLength;

          // Color gradient mapping
          const hue = (i / bufferLength) * 360;
          ctx.strokeStyle = `hsla(${hue}, 80%, 65%, ${value / 255})`;
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [visualMode, audioRef]);

  return (
    <div className="visualizer-overlay">
      <button className="visualizer-close" onClick={onClose}>
        <X size={24} />
      </button>

      <div style={{ position: 'absolute', top: '40px', left: '40px', display: 'flex', gap: '12px' }}>
        <button 
          className={`nav-item ${visualMode === 'bars' ? 'active' : ''}`} 
          onClick={() => setVisualMode('bars')}
          style={{ padding: '8px 16px' }}
        >
          <Sliders size={18} /> Bars
        </button>
        <button 
          className={`nav-item ${visualMode === 'wave' ? 'active' : ''}`} 
          onClick={() => setVisualMode('wave')}
          style={{ padding: '8px 16px' }}
        >
          <Activity size={18} /> Wave
        </button>
        <button 
          className={`nav-item ${visualMode === 'circle' ? 'active' : ''}`} 
          onClick={() => setVisualMode('circle')}
          style={{ padding: '8px 16px' }}
        >
          <Disc size={18} /> Circular
        </button>
      </div>

      <canvas ref={canvasRef} className="visualizer-canvas" />
    </div>
  );
}
