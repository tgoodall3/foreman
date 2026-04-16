"use client";

import { useState } from "react";
import Image from "next/image";
import PhotoLightbox from "@/components/ui/PhotoLightbox";

interface Photo {
  id: string;
  url: string;
  caption?: string | null;
  type?: string;
  profiles?: { full_name?: string } | null;
}

export default function JobPhotoGrid({ photos }: { photos: Photo[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!photos.length) return <p className="text-sm text-mist">No photos yet</p>;

  return (
    <>
      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos.map((p) => ({ url: p.url, caption: p.caption, type: p.type }))}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onChange={setLightboxIndex}
        />
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {photos.map((photo, i) => (
          <div key={photo.id} className="group relative">
            <button
              type="button"
              onClick={() => setLightboxIndex(i)}
              className="w-full focus:outline-none focus:ring-2 focus:ring-amber rounded-lg"
              aria-label={`View photo: ${photo.caption || photo.type}`}
            >
              <Image
                src={photo.url}
                alt={photo.caption || `${photo.type} photo`}
                width={480}
                height={280}
                className="w-full h-28 object-cover rounded-lg border border-gray-200 group-hover:opacity-90 transition-opacity"
              />
            </button>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xs text-mist capitalize">{photo.type}</span>
              <span className="text-xs text-mist">{photo.profiles?.full_name}</span>
            </div>
            {photo.caption && <p className="text-xs text-steel mt-0.5">{photo.caption}</p>}
          </div>
        ))}
      </div>
    </>
  );
}
