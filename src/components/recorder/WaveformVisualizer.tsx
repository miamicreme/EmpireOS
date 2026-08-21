import { useEffect, useRef } from 'react';

interface WaveformVisualizerProps {
  level: number; // 0-1, from audio context analysis
  isRecording: boolean;
}

export function WaveformVisualizer({ level, isRecording }: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const samplesRef = useRef<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Add new sample
    samplesRef.current.push(level * 100);
    if (samplesRef.current.length > 300) {
      samplesRef.current.shift();
    }

    const drawWaveform = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      // Clear canvas
      ctx.fillStyle = 'rgba(17, 24, 39, 1)';
      ctx.fillRect(0, 0, width, height);

      // Draw grid lines
      ctx.strokeStyle = 'rgba(75, 85, 99, 0.3)';
      ctx.lineWidth = 1;
      for (let i = 0; i < width; i += 30) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();
      }

      // Draw waveform
      ctx.strokeStyle = isRecording ? 'rgba(248, 113, 113, 0.8)' : 'rgba(96, 165, 250, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();

      samplesRef.current.forEach((sample, i) => {
        const x = (i / samplesRef.current.length) * width;
        const y = centerY - (sample / 100) * (height / 2);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();

      // Draw center line
      ctx.strokeStyle = 'rgba(107, 114, 128, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      animationRef.current = requestAnimationFrame(drawWaveform);
    };

    drawWaveform();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [level, isRecording]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={120}
      className="w-full border border-border rounded-lg bg-surface-1"
    />
  );
}
