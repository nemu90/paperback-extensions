/* SPDX-License-Identifier: GPL-3.0-or-later */

import type { Tag } from "@paperback/types";

export const SITE_URL = "https://hentainexus.com";
export const POPULAR_PATH = "/explore/hot";

export const IMAGE_FORMAT_KEY = "image_format";
export const DEFAULT_IMAGE_FORMAT = "webp";

// Maps the user-facing format to the field on each reader image entry.
export const IMAGE_FORMAT_OPTIONS: Tag[] = [
  { id: "webp", title: "WebP" },
  { id: "avif", title: "AVIF" },
  { id: "source", title: "Original (requires account)" },
];

export function imageFieldFor(format: string): "image_source" | "image_avif" | "image_fallback" {
  switch (format) {
    case "source":
      return "image_source";
    case "avif":
      return "image_avif";
    default:
      return "image_fallback";
  }
}

// Advanced-search text filters -> query token keys.
export const SEARCH_FILTERS: { id: string; title: string; key: string }[] = [
  { id: "tag", title: "Tags", key: "tag" },
  { id: "artist", title: "Artists", key: "artist" },
  { id: "author", title: "Authors", key: "author" },
  { id: "circle", title: "Circles", key: "circle" },
  { id: "event", title: "Events", key: "event" },
  { id: "parody", title: "Parodies", key: "parody" },
  { id: "magazine", title: "Magazines", key: "magazine" },
  { id: "publisher", title: "Publishers", key: "publisher" },
];

export const SORT_OPTIONS: { id: string; title: string; token: string }[] = [
  { id: "default", title: "Default", token: "" },
  { id: "popular", title: "Popular", token: "sort:popular" },
];

export type HentaiNexusSearchMetadata = {
  page?: number;
  sort?: string;
  filters?: Record<string, string>;
};

// A single reader page entry from the decrypted payload.
export interface ReaderImage {
  type?: string;
  image_source?: string;
  image_avif?: string;
  image_fallback?: string;
}
