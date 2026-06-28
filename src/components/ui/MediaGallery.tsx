import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, Play, ImageIcon } from 'lucide-react';

export interface MediaItem {
  url: string;
  thumbnailUrl?: string;
  mediaType: 'image' | 'video';
  mimeType?: string;
  width?: number;
  height?: number;
  originalFilename?: string;
  isEvidence?: boolean;
}

interface MediaGalleryProps {
  mediaItems: MediaItem[];
  className?: string;
  /** Show a compact strip (3 cols) vs. full grid */
  compact?: boolean;
  title?: string;
}

/**
 * Append ImageKit transformation params to a URL.
 * Example: ?tr=w-400,h-300,c-maintain_ratio
 */
const withTransform = (url: string, transform: string): string => {
  if (!url || !url.includes('ik.imagekit.io')) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}tr=${transform}`;
};

export default function MediaGallery({ mediaItems, className = '', compact = false, title }: MediaGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());

  // Log on initialization / update of media items
  useEffect(() => {
    console.log('MediaGallery: Loaded with mediaItems:', mediaItems, { title, compact });
  }, [mediaItems, title, compact]);

  const isOpen = lightboxIndex !== null;

  const openLightbox = (index: number) => {
    console.log('MediaGallery: Opening lightbox at index:', index, 'Item:', mediaItems[index]);
    setLightboxIndex(index);
  };
  const closeLightbox = () => {
    console.log('MediaGallery: Closing lightbox');
    setLightboxIndex(null);
  };

  const prevImage = useCallback(() => {
    if (lightboxIndex === null) return;
    const newIdx = (lightboxIndex - 1 + mediaItems.length) % mediaItems.length;
    console.log('MediaGallery: Navigate prev to index:', newIdx);
    setLightboxIndex(newIdx);
  }, [lightboxIndex, mediaItems.length]);

  const nextImage = useCallback(() => {
    if (lightboxIndex === null) return;
    const newIdx = (lightboxIndex + 1) % mediaItems.length;
    console.log('MediaGallery: Navigate next to index:', newIdx);
    setLightboxIndex(newIdx);
  }, [lightboxIndex, mediaItems.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') prevImage();
      if (e.key === 'ArrowRight') nextImage();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, prevImage, nextImage]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!mediaItems || mediaItems.length === 0) {
    console.log('MediaGallery: No media items to render.');
    return (
      <div className="flex flex-col items-center justify-center py-8 text-slate-500 gap-2">
        <ImageIcon className="w-8 h-8 opacity-40" />
        <p className="text-xs font-medium">No media attached</p>
      </div>
    );
  }

  const gridCols = compact
    ? 'grid-cols-3'
    : mediaItems.length === 1
    ? 'grid-cols-1'
    : mediaItems.length === 2
    ? 'grid-cols-2'
    : 'grid-cols-3';

  const currentItem = lightboxIndex !== null ? mediaItems[lightboxIndex] : null;

  return (
    <div className={`media-gallery ${className}`}>
      {title && (
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{title}</p>
      )}

      {/* Thumbnail Grid */}
      <div className={`grid ${gridCols} gap-2`}>
        {mediaItems.map((item, idx) => {
          const thumbUrl = item.thumbnailUrl
            ? withTransform(item.thumbnailUrl, 'w-200,h-160,c-maintain_ratio,q-80')
            : withTransform(item.url, 'w-200,h-160,c-maintain_ratio,q-80');
          const hasError = imageErrors.has(idx);

          // Log each image url being rendered
          console.log(`MediaGallery: Rendering item ${idx}:`, {
            url: item.url,
            thumbnailUrl: item.thumbnailUrl,
            computedThumbUrl: thumbUrl,
            hasError
          });

          return (
            <div
              key={idx}
              className="relative group cursor-pointer overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/60"
              style={{ paddingBottom: compact ? '75%' : '66.67%' }}
              onClick={() => openLightbox(idx)}
            >
              {item.mediaType === 'video' ? (
                /* Video thumbnail */
                <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                  {!hasError ? (
                    <video
                      src={item.url}
                      className="absolute inset-0 w-full h-full object-cover"
                      preload="metadata"
                      muted
                      onError={() => {
                        console.error(`MediaGallery: Video load failed at index ${idx} for URL: ${item.url}`);
                        setImageErrors(prev => new Set([...prev, idx]));
                      }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                      <Play className="w-8 h-8 text-slate-400" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center">
                      <Play className="w-5 h-5 text-white ml-0.5" />
                    </div>
                  </div>
                </div>
              ) : hasError ? (
                /* Fallback for broken images */
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800 gap-1">
                  <ImageIcon className="w-6 h-6 text-slate-500" />
                  <p className="text-[9px] text-slate-500 font-medium">Image unavailable</p>
                </div>
              ) : (
                /* Image thumbnail with lazy loading */
                <img
                  src={thumbUrl}
                  alt={item.originalFilename || `Evidence ${idx + 1}`}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={() => {
                    console.error(`MediaGallery: Image load failed at index ${idx} for URL: ${thumbUrl}`);
                    setImageErrors(prev => new Set([...prev, idx]));
                  }}
                />
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center">
                <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-lg" />
              </div>

              {/* Evidence badge */}
              {item.isEvidence && (
                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-amber-500/80 text-white text-[8px] font-bold rounded-md uppercase tracking-wide">
                  Evidence
                </div>
              )}

              {/* Index badge for multi-image */}
              {mediaItems.length > 1 && (
                <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/60 text-white text-[9px] font-bold rounded-md">
                  {idx + 1}/{mediaItems.length}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      {isOpen && currentItem && (
        <div
          className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Counter */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-sm font-semibold bg-black/40 px-3 py-1 rounded-full z-10">
            {(lightboxIndex || 0) + 1} / {mediaItems.length}
          </div>

          {/* Filename */}
          {currentItem.originalFilename && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-slate-400 text-xs font-medium bg-black/40 px-3 py-1 rounded-full z-10 max-w-[80%] truncate">
              {currentItem.originalFilename}
            </div>
          )}

          {/* Prev button */}
          {mediaItems.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); prevImage(); }}
              className="absolute left-4 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white z-10"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Media display */}
          <div
            className="max-w-[90vw] max-h-[85vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {currentItem.mediaType === 'video' ? (
              <video
                src={currentItem.url}
                controls
                autoPlay
                className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl"
              />
            ) : (
              <img
                src={withTransform(currentItem.url, 'q-90')}
                alt={currentItem.originalFilename || 'Evidence'}
                className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
              />
            )}
          </div>

          {/* Next button */}
          {mediaItems.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); nextImage(); }}
              className="absolute right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white z-10"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
