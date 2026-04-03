"use client";

import { useState } from "react";
import Image from "next/image";

interface AsyncImageProps {
    src: string | null;
    fallback: React.ReactNode;
    alt: string;
    className?: string;
    fill?: boolean;
    width?: number;
    height?: number;
    priority?: boolean;
}

/** shimmer SVG를 base64로 인코딩한 placeholder */
function shimmerDataUrl(w: number, h: number): string {
    const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:#1a1a24;stop-opacity:1">
          <animate attributeName="offset" values="-2;1" dur="1.5s" repeatCount="indefinite"/>
        </stop>
        <stop offset="50%" style="stop-color:#2a2a38;stop-opacity:1">
          <animate attributeName="offset" values="-1;2" dur="1.5s" repeatCount="indefinite"/>
        </stop>
        <stop offset="100%" style="stop-color:#1a1a24;stop-opacity:1">
          <animate attributeName="offset" values="0;3" dur="1.5s" repeatCount="indefinite"/>
        </stop>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/>
  </svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * 비동기 이미지 컴포넌트
 * - src가 null이면 fallback 렌더
 * - src가 있으면 next/image + shimmer placeholder + 페이드인
 */
export function AsyncImage({
    src,
    fallback,
    alt,
    className = "",
    fill = false,
    width,
    height,
    priority = false,
}: AsyncImageProps) {
    const [loaded, setLoaded] = useState(false);

    if (!src) {
        return <>{fallback}</>;
    }

    return (
        <div className={`relative overflow-hidden ${className}`}>
            {/* shimmer 배경 — 이미지 로드 전 표시 */}
            {!loaded && (
                <div className="absolute inset-0 animate-pulse bg-[#1a1a24]" />
            )}
            <Image
                src={src}
                alt={alt}
                fill={fill}
                width={fill ? undefined : width}
                height={fill ? undefined : height}
                className={`object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
                placeholder="blur"
                blurDataURL={shimmerDataUrl(width ?? 400, height ?? 200)}
                onLoad={() => setLoaded(true)}
                priority={priority}
            />
        </div>
    );
}
