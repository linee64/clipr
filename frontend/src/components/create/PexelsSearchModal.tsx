"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Loader2, Search, X } from "lucide-react";
import { searchPexelsVideos } from "@/lib/api";
import type { PexelsVideo } from "@/lib/types";

interface PexelsSearchModalProps {
  /** Prefilled query — the scene's "what to film" suggestion. */
  initialQuery: string;
  onClose: () => void;
  /** Import the picked video server-side; resolves once it's a render-ready clip. */
  onImport: (video: PexelsVideo) => Promise<void>;
}

function fmtSecs(s: number): string {
  if (!s) return "";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/** Thumbnail that plays the Pexels preview clip (muted, looping) on hover. */
function ResultCard({
  video,
  importing,
  disabled,
  onPick,
}: {
  video: PexelsVideo;
  importing: boolean;
  disabled: boolean;
  onPick: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hover, setHover] = useState(false);

  const onEnter = () => {
    setHover(true);
    const v = videoRef.current;
    if (v && video.preview) {
      v.currentTime = 0;
      void v.play().catch(() => {});
    }
  };
  const onLeave = () => {
    setHover(false);
    videoRef.current?.pause();
  };

  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className={`group relative aspect-[9/16] overflow-hidden rounded-lg border border-[#152226] bg-[#070B0D] transition-opacity focus:outline-none focus:ring-2 focus:ring-[#10B981]/50 disabled:cursor-not-allowed ${
        disabled && !importing ? "opacity-40" : ""
      }`}
    >
      {/* poster */}
      {video.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={video.image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
      )}
      {/* hover preview */}
      {video.preview && (
        <video
          ref={videoRef}
          src={video.preview}
          muted
          loop
          playsInline
          preload="none"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
            hover ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      {/* gradient + meta */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
        <div className="flex items-center justify-between gap-1">
          {video.duration > 0 && (
            <span className="rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-[#EFEFEF]">
              {fmtSecs(video.duration)}
            </span>
          )}
        </div>
      </div>

      {/* hover "use this" affordance */}
      {!importing && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#10B981]/0 opacity-0 transition-opacity duration-200 group-hover:bg-[#070B0D]/30 group-hover:opacity-100">
          <span className="flex items-center gap-1.5 rounded-full bg-[#10B981] px-3 py-1.5 text-xs font-semibold text-[#070B0D]">
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
            Use this
          </span>
        </div>
      )}

      {/* importing overlay */}
      {importing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#070B0D]/80">
          <Loader2 className="h-6 w-6 animate-spin text-[#10B981]" />
          <span className="text-[11px] text-[#9FB0B6]">Importing…</span>
        </div>
      )}
    </button>
  );
}

export function PexelsSearchModal({
  initialQuery,
  onClose,
  onImport,
}: PexelsSearchModalProps) {
  const [query, setQuery] = useState(initialQuery);
  const [videos, setVideos] = useState<PexelsVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<number | null>(null);
  const [searched, setSearched] = useState(false);

  const runSearch = async (q: string) => {
    const term = q.trim();
    if (!term) return;
    setLoading(true);
    setError(null);
    try {
      const res = await searchPexelsVideos(term);
      setVideos(res.videos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
      setVideos([]);
    } finally {
      setSearched(true);
      setLoading(false);
    }
  };

  // Auto-run the first search from the scene's "what to film" suggestion.
  useEffect(() => {
    if (initialQuery.trim()) void runSearch(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on Escape (unless an import is mid-flight).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && importingId == null) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [importingId, onClose]);

  const handlePick = async (video: PexelsVideo) => {
    if (importingId != null) return;
    setImportingId(video.id);
    setError(null);
    try {
      await onImport(video);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't import that clip. Try another.");
      setImportingId(null);
    }
  };

  const busy = importingId != null;

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !busy && onClose()}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Search video clips"
        className="relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-2xl border border-[#1f3338] bg-[#0B1214]/95 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:max-h-[80vh] sm:max-w-2xl sm:rounded-2xl"
        initial={{ y: 40, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 30, opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex shrink-0 items-start justify-between px-5 pb-3 pt-5">
          <div>
            <h4 className="text-base font-semibold tracking-tight text-[#EFEFEF]">
              Video clips
            </h4>
            <p className="mt-0.5 text-[11px] text-[#6B7C85]">
              Free clips — pick one to fill this scene
            </p>
          </div>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#6B7C85] transition-colors hover:bg-[#152226] hover:text-[#EFEFEF]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch(query);
          }}
          className="shrink-0 px-5 pb-3"
        >
          <div className="flex items-center gap-2 rounded-lg border border-[#152226] bg-[#0D1416] px-3 py-2 focus-within:border-[#1f3338]">
            <Search className="h-4 w-4 shrink-0 text-[#6B7C85]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clips…"
              aria-label="Search clips"
              autoFocus
              className="flex-1 bg-transparent text-sm text-[#EFEFEF] outline-none placeholder:text-[#3A4A50]"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="rounded-md bg-[#10B981] px-3 py-1 text-xs font-semibold text-[#070B0D] transition-colors hover:bg-[#12cf90] disabled:opacity-50"
            >
              Search
            </button>
          </div>
        </form>

        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 pb-5">
          {error && (
            <p className="mb-3 rounded-lg border border-[#EF8B8B]/20 bg-[#EF8B8B]/[0.06] px-3 py-2 text-xs text-[#EF8B8B]">
              {error}
            </p>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-[#6B7C85]">
              <Loader2 className="h-6 w-6 animate-spin text-[#10B981]" />
              <span className="text-sm">Searching…</span>
            </div>
          ) : videos.length > 0 ? (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {videos.map((v) => (
                <ResultCard
                  key={v.id}
                  video={v}
                  importing={importingId === v.id}
                  disabled={busy}
                  onPick={() => handlePick(v)}
                />
              ))}
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-[#6B7C85]">
              {searched
                ? "No clips found — try a different search."
                : "Type something to find a clip."}
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
