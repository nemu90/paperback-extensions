/* SPDX-License-Identifier: GPL-3.0-or-later */

export const SITE_URL = "https://hentalk.pw";
export const API_URL = `${SITE_URL}/api`;

// Sort options map onto Faccina's `sort` + `order` query parameters.
export const SORT_OPTIONS: { id: string; title: string; sort: string; order: string }[] = [
  { id: "newest", title: "Newest", sort: "created_at", order: "desc" },
  { id: "oldest", title: "Oldest", sort: "created_at", order: "asc" },
  { id: "released", title: "Recently Released", sort: "released_at", order: "desc" },
  { id: "title", title: "Title (A-Z)", sort: "title", order: "asc" },
  { id: "pages", title: "Most Pages", sort: "pages", order: "desc" },
  { id: "random", title: "Random", sort: "random", order: "desc" },
];

export type HentalkSearchMetadata = {
  page?: number;
  sort?: string;
};

export interface ArchiveTag {
  id?: number;
  namespace?: string;
  name: string;
}

export interface Archive {
  id: number;
  hash: string;
  title: string;
  description?: string | null;
  pages: number;
  thumbnail: number;
  language?: string | null;
  size?: number;
  createdAt?: string;
  releasedAt?: string;
  tags?: ArchiveTag[];
}

export interface LibraryResponse {
  archives?: Archive[];
  page: number;
  limit?: number;
  total?: number;
}
