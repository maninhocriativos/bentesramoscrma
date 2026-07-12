import { useState, useRef, useEffect, useMemo } from 'react';
import { Play, Pause, Download, ExternalLink, Volume2 } from 'lucide-react';
import { ChatMessage } from '@/hooks/useChatMessages';
import { cn } from '@/lib/utils';

interface WhatsAppAudioPlayerProps {
  message: ChatMessage;
  isSent: boolean;
}

// Extrair URL de áudio de diferentes fontes
function extractAudioUrl(message: ChatMessage): string | null {
  const metadata = message.metadata as any;
  
  if (metadata?.original?.audio?.audioUrl) return metadata.original.audio.audioUrl;
  if (metadata?.original?.audio?.link) return metadata.original.audio.link;
  if (metadata?.media_url) return metadata.media_url;
  
  const content = message.conteudo || '';
  const cleanUrl = content.replace(/^\[|\]$/g, '').trim();
  if (cleanUrl.match(/^https?:\/\/.+\.(ogg|mp3|wav|m4a|opus|aac|webm)/i) ||
      cleanUrl.includes('whatsapp') || 
      cleanUrl.includes('z-api') ||
      cleanUrl.includes('mmg.whatsapp') ||
      cleanUrl.includes('backblazeb2')) {
    return cleanUrl;
  }
  
  return null;
}

function canPlayOgg(): boolean {
  if (typeof window === 'undefined') return false;
  const audio = document.createElement('audio');
  const canPlay = audio.canPlayType('audio/ogg; codecs=opus');
  return canPlay === 'probably' || canPlay === 'maybe';
}

function isIOSOrSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || /^((?!chrome|android).)*safari/i.test(ua);
}

// Generate fake waveform data for visualization
function generateWaveform(length: number = 40): number[] {
  const waveform: number[] = [];
  for (let i = 0; i < length; i++) {
    // Create somewhat natural looking audio waveform
    const baseHeight = Math.random() * 0.6 + 0.2;
    const variation = Math.sin(i / 3) * 0.2;
    waveform.push(Math.min(1, Math.max(0.1, baseHeight + variation)));
  }
  return waveform;
}

export function WhatsAppAudioPlayer({ message, isSent }: WhatsAppAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);
  // Começa false: com preload="none" o áudio só é baixado ao clicar em play,
  // então o balão aparece na hora (sem requisição de rede ao renderizar).
  const [isLoading, setIsLoading] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  
  const audioUrl = extractAudioUrl(message);
  const supportsOgg = canPlayOgg();
  const iosOrSafari = isIOSOrSafari();
  
  // Memoize waveform to keep it consistent
  const waveform = useMemo(() => generateWaveform(35), [message.id]);
  
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };
    
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const handleError = () => {
      setError(true);
      setIsLoading(false);
    };
    const handleCanPlay = () => setIsLoading(false);
    
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);
    
    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [audioUrl]);
  
  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    try {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        // 1ª reprodução: o áudio ainda não foi baixado (preload="none").
        if (audio.readyState < 2) setIsLoading(true);
        await audio.play();
        setIsPlaying(true);
        setIsLoading(false);
      }
    } catch (err) {
      setError(true);
      setIsLoading(false);
    }
  };
  
  const cyclePlaybackRate = () => {
    const rates = [1, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };
  
  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };
  
  const formatTime = (time: number): string => {
    if (!time || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  const openInNewTab = () => audioUrl && window.open(audioUrl, '_blank');
  
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const playedBars = Math.floor((progress / 100) * waveform.length);
  
  // Fallback states
  if (!audioUrl) {
    return (
      <div className="flex items-center gap-2 text-sm opacity-70">
        <Volume2 className="h-4 w-4" />
        <span>Áudio não disponível</span>
      </div>
    );
  }
  
  if ((iosOrSafari && !supportsOgg && audioUrl.includes('.ogg')) || error) {
    return (
      <div className="flex items-center gap-3 min-w-[200px] p-2 rounded-lg bg-black/5">
        <Volume2 className="h-5 w-5 opacity-60" />
        <span className="text-xs flex-1">Áudio de voz</span>
        <button
          onClick={openInNewTab}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-black/10 hover:bg-black/20"
        >
          <ExternalLink className="h-3 w-3" />
          Abrir
        </button>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-2 min-w-[220px] max-w-[280px]">
      <audio ref={audioRef} preload="none">
        <source src={audioUrl} type="audio/ogg; codecs=opus" />
        <source src={audioUrl} type="audio/ogg" />
        <source src={audioUrl} type="audio/mpeg" />
        <source src={audioUrl} type="audio/mp4" />
      </audio>
      
      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        disabled={isLoading}
        className={cn(
          "flex items-center justify-center w-9 h-9 rounded-full transition-all flex-shrink-0",
          isSent ? "bg-white/25 hover:bg-white/35" : "bg-[#00A884]/20 hover:bg-[#00A884]/30",
          isLoading && "opacity-50"
        )}
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : isPlaying ? (
          <Pause className="h-4 w-4" fill="currentColor" />
        ) : (
          <Play className="h-4 w-4 ml-0.5" fill="currentColor" />
        )}
      </button>
      
      {/* Waveform */}
      <div className="flex-1 flex flex-col gap-1">
        <div 
          className="h-7 flex items-center gap-[2px] cursor-pointer"
          onClick={handleWaveformClick}
        >
          {waveform.map((height, i) => (
            <div
              key={i}
              className={cn(
                "w-[3px] rounded-full transition-colors",
                i < playedBars
                  ? isSent ? "bg-white/80" : "bg-[#00A884]"
                  : isSent ? "bg-white/30" : "bg-black/20"
              )}
              style={{ height: `${height * 100}%` }}
            />
          ))}
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-[10px] opacity-70">
            {formatTime(isPlaying ? currentTime : duration)}
          </span>
          
          {/* Playback speed button */}
          <button
            onClick={cyclePlaybackRate}
            className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
              isSent ? "bg-white/20 hover:bg-white/30" : "bg-black/10 hover:bg-black/15"
            )}
          >
            {playbackRate}×
          </button>
        </div>
      </div>
    </div>
  );
}
