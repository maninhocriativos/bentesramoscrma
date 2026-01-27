import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Download, ExternalLink, Volume2 } from 'lucide-react';
import { ChatMessage } from '@/hooks/useChatMessages';
import { cn } from '@/lib/utils';

interface AudioPlayerProps {
  message: ChatMessage;
  isSent: boolean;
}

// Extrair URL de áudio de diferentes fontes
function extractAudioUrl(message: ChatMessage): string | null {
  const metadata = message.metadata as any;
  
  // 1. Tentar extrair de metadata.original (Z-API payload)
  if (metadata?.original?.audio?.audioUrl) {
    return metadata.original.audio.audioUrl;
  }
  if (metadata?.original?.audio?.link) {
    return metadata.original.audio.link;
  }
  
  // 2. Tentar media_url diretamente no metadata
  if (metadata?.media_url) {
    return metadata.media_url;
  }
  
  // 3. Se conteúdo é uma URL de áudio
  const content = message.conteudo || '';
  const cleanUrl = content.replace(/^\[|\]$/g, '').trim();
  if (cleanUrl.match(/^https?:\/\/.+\.(ogg|mp3|wav|m4a|opus|aac|webm)/i) ||
      cleanUrl.includes('whatsapp') || 
      cleanUrl.includes('z-api') ||
      cleanUrl.includes('filesusr') ||
      cleanUrl.includes('mmg.whatsapp') ||
      cleanUrl.includes('backblazeb2')) {
    return cleanUrl;
  }
  
  return null;
}

// Detectar se o navegador suporta OGG/Opus
function canPlayOgg(): boolean {
  if (typeof window === 'undefined') return false;
  
  const audio = document.createElement('audio');
  // Safari e iOS não suportam OGG/Opus nativamente
  const canPlay = audio.canPlayType('audio/ogg; codecs=opus');
  return canPlay === 'probably' || canPlay === 'maybe';
}

// Detectar iOS/Safari
function isIOSOrSafari(): boolean {
  if (typeof window === 'undefined') return false;
  
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  return isIOS || isSafari;
}

export function AudioPlayer({ message, isSent }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const audioUrl = extractAudioUrl(message);
  const supportsOgg = canPlayOgg();
  const iosOrSafari = isIOSOrSafari();
  
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };
    
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    
    const handleError = () => {
      console.warn('Audio playback error for URL:', audioUrl);
      setError(true);
      setIsLoading(false);
    };
    
    const handleCanPlay = () => {
      setIsLoading(false);
    };
    
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
        await audio.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('Play error:', err);
      setError(true);
    }
  };
  
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };
  
  const formatTime = (time: number): string => {
    if (!time || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  const openInNewTab = () => {
    if (audioUrl) {
      window.open(audioUrl, '_blank');
    }
  };
  
  // Se não há URL de áudio
  if (!audioUrl) {
    return (
      <div className="flex items-center gap-2 text-sm opacity-70">
        <Volume2 className="h-4 w-4" />
        <span>Áudio não disponível</span>
      </div>
    );
  }
  
  // Se é iOS/Safari e não suporta OGG - mostrar fallback amigável
  if (iosOrSafari && !supportsOgg && audioUrl.includes('.ogg')) {
    return (
      <div className="flex flex-col gap-2 min-w-[200px]">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-black/10">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20">
            <Volume2 className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-xs opacity-70">Áudio de voz</p>
            <p className="text-[10px] opacity-50">Formato não suportado neste navegador</p>
          </div>
        </div>
        <button
          onClick={openInNewTab}
          className={cn(
            "flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
            isSent 
              ? "bg-white/20 hover:bg-white/30 text-white" 
              : "bg-black/10 hover:bg-black/20"
          )}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Abrir em outro app
        </button>
      </div>
    );
  }
  
  // Se houve erro, mostrar fallback
  if (error) {
    return (
      <div className="flex flex-col gap-2 min-w-[200px]">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-black/10">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20">
            <Volume2 className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-xs opacity-70">Áudio de voz</p>
            <p className="text-[10px] opacity-50">Não foi possível reproduzir</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openInNewTab}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
              isSent 
                ? "bg-white/20 hover:bg-white/30 text-white" 
                : "bg-black/10 hover:bg-black/20"
            )}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir
          </button>
          <a
            href={audioUrl}
            download
            className={cn(
              "flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
              isSent 
                ? "bg-white/20 hover:bg-white/30 text-white" 
                : "bg-black/10 hover:bg-black/20"
            )}
          >
            <Download className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    );
  }
  
  // Player normal com controles customizados
  return (
    <div className="flex items-center gap-3 min-w-[200px] max-w-[280px]">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        preload="metadata"
        crossOrigin="anonymous"
      >
        {/* Tentar múltiplos formatos para compatibilidade */}
        <source src={audioUrl} type="audio/ogg; codecs=opus" />
        <source src={audioUrl} type="audio/ogg" />
        <source src={audioUrl} type="audio/mpeg" />
        <source src={audioUrl} type="audio/mp4" />
        <source src={audioUrl} type="audio/webm" />
        <source src={audioUrl} type="audio/wav" />
      </audio>
      
      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        disabled={isLoading}
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-full transition-all flex-shrink-0",
          isSent 
            ? "bg-white/20 hover:bg-white/30 text-white" 
            : "bg-black/10 hover:bg-black/20",
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
      
      {/* Progress and time */}
      <div className="flex-1 flex flex-col gap-1">
        {/* Waveform-style progress bar */}
        <div className="relative h-6 flex items-center">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 bg-black/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-current"
            style={{
              background: `linear-gradient(to right, currentColor ${(currentTime / (duration || 1)) * 100}%, rgba(0,0,0,0.2) ${(currentTime / (duration || 1)) * 100}%)`
            }}
          />
        </div>
        
        {/* Time display */}
        <div className="flex justify-between text-[10px] opacity-70">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
      
      {/* Download button for fallback */}
      <button
        onClick={openInNewTab}
        className="p-1.5 rounded-full hover:bg-black/10 transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
        title="Abrir em nova aba"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
