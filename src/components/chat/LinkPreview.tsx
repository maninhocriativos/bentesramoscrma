import { useState, useEffect } from 'react';
import { ExternalLink, Globe, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LinkPreviewProps {
  url: string;
  className?: string;
}

interface PreviewData {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
}

// Extract domain from URL
function getDomain(url: string): string {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    return domain;
  } catch {
    return url;
  }
}

// Get favicon URL for domain
function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).origin;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return '';
  }
}

// Detect if URL is from known platforms
function getPlatformInfo(url: string): { name: string; color: string; icon?: string } | null {
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
    return { name: 'YouTube', color: 'bg-red-500' };
  }
  if (lowerUrl.includes('instagram.com')) {
    return { name: 'Instagram', color: 'bg-gradient-to-br from-purple-500 to-pink-500' };
  }
  if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.com')) {
    return { name: 'Facebook', color: 'bg-blue-600' };
  }
  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) {
    return { name: 'X', color: 'bg-black' };
  }
  if (lowerUrl.includes('linkedin.com')) {
    return { name: 'LinkedIn', color: 'bg-blue-700' };
  }
  if (lowerUrl.includes('tiktok.com')) {
    return { name: 'TikTok', color: 'bg-black' };
  }
  if (lowerUrl.includes('whatsapp.com') || lowerUrl.includes('wa.me')) {
    return { name: 'WhatsApp', color: 'bg-green-500' };
  }
  if (lowerUrl.includes('spotify.com')) {
    return { name: 'Spotify', color: 'bg-green-600' };
  }
  if (lowerUrl.includes('github.com')) {
    return { name: 'GitHub', color: 'bg-gray-800' };
  }
  if (lowerUrl.includes('drive.google.com') || lowerUrl.includes('docs.google.com')) {
    return { name: 'Google Drive', color: 'bg-yellow-500' };
  }
  
  return null;
}

export function LinkPreview({ url, className }: LinkPreviewProps) {
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  const domain = getDomain(url);
  const faviconUrl = getFaviconUrl(url);
  const platformInfo = getPlatformInfo(url);

  useEffect(() => {
    // For now, just show basic info without fetching metadata
    // Full implementation would require a backend proxy to fetch OG metadata
    setLoading(false);
    setPreview({
      siteName: platformInfo?.name || domain,
      favicon: faviconUrl,
    });
  }, [url, domain, faviconUrl, platformInfo]);

  if (error) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "block rounded-lg overflow-hidden transition-all hover:opacity-90",
        "bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10",
        "max-w-[280px] group",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Preview image placeholder */}
      {preview?.image ? (
        <div className="w-full h-32 bg-muted overflow-hidden">
          <img 
            src={preview.image} 
            alt="" 
            className="w-full h-full object-cover"
            onError={() => setPreview(p => p ? { ...p, image: undefined } : null)}
          />
        </div>
      ) : (
        <div className={cn(
          "w-full h-16 flex items-center justify-center",
          platformInfo?.color || "bg-gradient-to-br from-primary/10 to-primary/5"
        )}>
          {platformInfo ? (
            <span className="text-white font-semibold text-sm">
              {platformInfo.name}
            </span>
          ) : (
            <Globe className="h-6 w-6 text-muted-foreground/50" />
          )}
        </div>
      )}
      
      {/* Content */}
      <div className="p-3 space-y-1">
        {/* Site info */}
        <div className="flex items-center gap-2">
          {faviconUrl && (
            <img 
              src={faviconUrl} 
              alt="" 
              className="h-4 w-4 rounded-sm"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          )}
          <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide truncate">
            {preview?.siteName || domain}
          </span>
          <ExternalLink className="h-3 w-3 text-muted-foreground/50 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        
        {/* Title */}
        {preview?.title && (
          <p className="text-sm font-medium text-foreground line-clamp-2">
            {preview.title}
          </p>
        )}
        
        {/* Description */}
        {preview?.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {preview.description}
          </p>
        )}
        
        {/* URL */}
        <p className="text-[11px] text-muted-foreground truncate">
          {url}
        </p>
      </div>
    </a>
  );
}

// Utility to detect URLs in text
export function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;
  const matches = text.match(urlRegex) || [];
  return [...new Set(matches)]; // Remove duplicates
}

// Check if text contains only a URL (for full preview)
export function isOnlyUrl(text: string): boolean {
  const trimmed = text.trim();
  const urlRegex = /^https?:\/\/[^\s<>"{}|\\^`[\]]+$/i;
  return urlRegex.test(trimmed);
}
