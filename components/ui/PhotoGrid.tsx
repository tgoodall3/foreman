"use client";

import { useState } from "react";
import Image from "next/image";
import PhotoLightbox from "@/components/ui/PhotoLightbox";

interface Photo {
  url: string;
  caption?: string | null;
}

interface Props {
  photos: Photo[];
  imgClassName?: string;
  imgWidth?: number;
  imgHeight?: number;
}

export default function PhotoGrid({
  photos,
  imgClassName = "h-32 w-full object-cover",
  imgWidth = 512,
  imgHeight = 256,
}: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!photos.length) return null;

  return (
    <>
      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onChange={setLightboxIndex}
        />
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((photo, i) => (
          <button
            key={`${photo.url}-${i}`}
            type="button"
            onClick={() => setLightboxIndex(i)}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white text-left focus:outline-none focus:ring-2 focus:ring-amber"
          >
            <Image
              src={photo.url}
              alt={photo.caption || "Photo"}
              width={imgWidth}
              height={imgHeight}
              sizes="(max-width: 640px) 50vw, 33vw"
              className={imgClassName}
            />
            {photo.caption && (
              <p className="px-3 py-2 text-xs text-mist line-clamp-1">{photo.caption}</p>
            )}
          </button>
        ))}
      </div>
    </>
  );
}
