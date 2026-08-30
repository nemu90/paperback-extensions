/* SPDX-License-Identifier: GPL-3.0-or-later */

import type { Tag } from "@paperback/types";

// ----- API constants -----

export const API_URL = "https://api.schale.network";
export const SITE_URL = "https://niyaniya.moe";
export const BOOKS_URL = `${API_URL}/books`;

// Secure-state key under which the clearance (crt) token is stored.
export const CLEARANCE_STATE_KEY = "clearance";

// Settings state keys.
export const IMAGE_QUALITY_KEY = "image_quality";
export const REMOVE_BRACKETS_KEY = "remove_brackets";
export const EXCLUDE_TAGS_KEY = "exclude_tags";

// Image resolutions the API can serve. "0" means original.
export const QUALITY_OPTIONS: Tag[] = [
  { id: "780", title: "780px" },
  { id: "980", title: "980px" },
  { id: "1280", title: "1280px" },
  { id: "1600", title: "1600px" },
  { id: "0", title: "Original" },
];
export const DEFAULT_QUALITY = "1280";

// Sort options exposed on the API `sort` query parameter.
export const SORT_OPTIONS: { id: string; label: string }[] = [
  { id: "8", label: "Most Viewed" },
  { id: "4", label: "Recently Posted" },
  { id: "9", label: "Most Favorited" },
  { id: "2", label: "Title" },
  { id: "3", label: "Pages" },
];

// Categories combine into a single bitmask on the `cat` query parameter.
export const CATEGORY_OPTIONS: { id: string; title: string; value: number }[] = [
  { id: "manga", title: "Manga", value: 2 },
  { id: "doujinshi", title: "Doujinshi", value: 4 },
  { id: "illustration", title: "Illustration", value: 8 },
];

// Language filter values map onto the `language:"^<x>$"` search term.
export const LANGUAGE_OPTIONS: Tag[] = [
  { id: "all", title: "All" },
  { id: "english", title: "English" },
  { id: "japanese", title: "Japanese" },
  { id: "chinese", title: "Chinese" },
];
export const DEFAULT_LANGUAGE = "all";

// Tag namespaces returned by the API, mapped to human readable group titles.
export const NAMESPACE_TITLES: Record<number, string> = {
  0: "Tags",
  1: "Artists",
  2: "Circles",
  3: "Parodies",
  4: "Magazines",
  5: "Characters",
  6: "Cosplayers",
  8: "Male Tags",
  9: "Female Tags",
  10: "Mixed Tags",
  12: "Other Tags",
};

// ----- Search metadata passed between the advanced search form and the source -----

export type NiyaNiyaSearchMetadata = {
  page?: number;
  sort?: string;
  language?: string;
  categories?: string[];
};

// ----- API response shapes -----

export interface ThumbnailInfo {
  path: string;
  fallback?: string;
  dimensions?: [number, number];
}

export interface BookEntry {
  id: number;
  key: string;
  title: string;
  language?: number;
  pages?: number;
  thumbnail: ThumbnailInfo;
}

export interface BooksResponse {
  entries?: BookEntry[];
  total?: number;
  limit?: number;
  page: number;
}

export interface ApiTag {
  name: string;
  namespace?: number;
}

export interface Thumbnails {
  base: string;
  fallback?: string;
  main: ThumbnailInfo;
  entries: ThumbnailInfo[];
}

export interface MangaDetailResponse {
  id: number;
  key: string;
  title: string;
  created_at?: number;
  updated_at?: number;
  thumbnails: Thumbnails;
  tags?: ApiTag[];
}

export interface DataKey {
  id?: number;
  key?: string;
  size?: number;
}

export interface MangaData {
  data: {
    "0"?: DataKey;
    "780"?: DataKey;
    "980"?: DataKey;
    "1280"?: DataKey;
    "1600"?: DataKey;
  };
  similar?: BookEntry[];
}

export interface ImagePath {
  path: string;
}

export interface ImagesInfo {
  base: string;
  entries: ImagePath[];
}

export interface FilterTag {
  id: number;
  name: string;
  namespace?: number;
}
