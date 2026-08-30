/* SPDX-License-Identifier: GPL-3.0-or-later */

import {
  BasicRateLimiter,
  ContentRating,
  type Chapter,
  type ChapterDetails,
  type DiscoverSection,
  type DiscoverSectionItem,
  DiscoverSectionType,
  type ExtensionImpl,
  type PagedResults,
  type SearchQuery,
  type SearchResultItem,
  type SourceManga,
  type Tag,
  type TagSection,
} from "@paperback/types";

import { HentalkAdvancedSearchForm } from "./forms";
import {
  API_URL,
  type Archive,
  type HentalkSearchMetadata,
  type LibraryResponse,
  SITE_URL,
  SORT_OPTIONS,
} from "./models";
import { MainInterceptor } from "./network";
import type HentalkConfig from "./pbconfig";

export class HentalkExtension implements ExtensionImpl<typeof HentalkConfig> {
  mainRateLimiter = new BasicRateLimiter("main", {
    numberOfRequests: 4,
    bufferInterval: 1,
    ignoreImages: true,
  });

  mainInterceptor = new MainInterceptor("main");

  async initialise(): Promise<void> {
    this.mainRateLimiter.registerInterceptor();
    this.mainInterceptor.registerInterceptor();
  }

  // ----- Discover -----

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      { id: "newest", title: "Newest", type: DiscoverSectionType.featured },
      { id: "released", title: "Recently Released", type: DiscoverSectionType.simpleCarousel },
      { id: "random", title: "Random", type: DiscoverSectionType.simpleCarousel },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata?: HentalkSearchMetadata,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;
    const option = SORT_OPTIONS.find((o) => o.id === section.id) ?? SORT_OPTIONS[0]!;

    const data = await this.fetchLibrary({ page, sort: option.sort, order: option.order });
    const featured = section.type === DiscoverSectionType.featured;

    const items: DiscoverSectionItem[] = (data.archives ?? []).map((archive) =>
      featured
        ? {
            type: "featuredCarouselItem",
            mangaId: String(archive.id),
            title: archive.title,
            imageUrl: this.coverUrl(archive),
            contentRating: ContentRating.ADULT,
          }
        : {
            type: "simpleCarouselItem",
            mangaId: String(archive.id),
            title: archive.title,
            imageUrl: this.coverUrl(archive),
            contentRating: ContentRating.ADULT,
          },
    );

    // Random has no meaningful pagination.
    const hasNext = section.id !== "random" && this.hasNextPage(data);
    return { items, metadata: hasNext ? { page: page + 1 } : undefined };
  }

  // ----- Search -----

  async getAdvancedSearchForm(
    query: SearchQuery<HentalkSearchMetadata>,
  ): Promise<HentalkAdvancedSearchForm> {
    return new HentalkAdvancedSearchForm(query);
  }

  async getSearchResults(
    query: SearchQuery<HentalkSearchMetadata>,
    metadata?: HentalkSearchMetadata,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata?.page ?? 1;
    const option =
      SORT_OPTIONS.find((o) => o.id === (query.metadata?.sort ?? "newest")) ?? SORT_OPTIONS[0]!;

    const data = await this.fetchLibrary({
      page,
      sort: option.sort,
      order: option.order,
      q: query.title,
    });

    const items: SearchResultItem[] = (data.archives ?? []).map((archive) => ({
      mangaId: String(archive.id),
      title: archive.title,
      imageUrl: this.coverUrl(archive),
      contentRating: ContentRating.ADULT,
    }));

    return { items, metadata: this.hasNextPage(data) ? { page: page + 1 } : undefined };
  }

  // ----- Details -----

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const archive = await this.fetchJson<Archive>(`${API_URL}/g/${mangaId}`);

    const grouped = new Map<string, string[]>();
    for (const tag of archive.tags ?? []) {
      const ns = tag.namespace && tag.namespace.length > 0 ? tag.namespace : "tag";
      if (!grouped.has(ns)) {
        grouped.set(ns, []);
      }
      grouped.get(ns)!.push(tag.name);
    }

    const tagGroups: TagSection[] = [];
    for (const [ns, names] of grouped) {
      const tags: Tag[] = names.map((name) => ({
        id: `${ns}:${this.sanitizeId(name)}`,
        title: name,
      }));
      tagGroups.push({ id: ns, title: this.titleCase(ns), tags });
    }

    const artists = grouped.get("artist") ?? [];
    const circles = grouped.get("circle") ?? [];

    const synopsisParts: string[] = [];
    if (archive.description && archive.description.length > 0) {
      synopsisParts.push(archive.description);
    }
    synopsisParts.push(`Pages: ${archive.pages}`);
    if (archive.language) {
      synopsisParts.push(`Language: ${archive.language}`);
    }

    return {
      mangaId,
      mangaInfo: {
        thumbnailUrl: this.coverUrl(archive),
        synopsis: synopsisParts.join("\n"),
        primaryTitle: archive.title.length > 0 ? archive.title : "Unknown Title",
        secondaryTitles: [],
        contentRating: ContentRating.ADULT,
        status: "Completed",
        author: (circles.length ? circles : artists).join(", ") || undefined,
        artist: artists.join(", ") || undefined,
        tagGroups,
        shareUrl: `${SITE_URL}/g/${mangaId}`,
      },
    };
  }

  // ----- Chapters -----

  async getChapters(sourceManga: SourceManga, sinceDate?: Date): Promise<Chapter[]> {
    void sinceDate;
    const archive = await this.fetchJson<Archive>(`${API_URL}/g/${sourceManga.mangaId}`);
    const released = archive.releasedAt ?? archive.createdAt;

    return [
      {
        chapterId: sourceManga.mangaId,
        sourceManga,
        langCode: "en",
        chapNum: 1,
        title: "Chapter",
        publishDate: released ? new Date(released) : undefined,
      },
    ];
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const archive = await this.fetchJson<Archive>(`${API_URL}/g/${chapter.sourceManga.mangaId}`);

    // Faccina serves each page at /image/{hash}/{pageNumber}; the page list is
    // just the page count, no per-page metadata call needed.
    const pages: string[] = [];
    for (let i = 1; i <= archive.pages; i++) {
      pages.push(`${SITE_URL}/image/${archive.hash}/${i}`);
    }

    return {
      id: chapter.chapterId,
      mangaId: chapter.sourceManga.mangaId,
      pages,
    };
  }

  // ----- Helpers -----

  private coverUrl(archive: Archive): string {
    return `${SITE_URL}/image/${archive.hash}/${archive.thumbnail}?type=cover`;
  }

  private hasNextPage(data: LibraryResponse): boolean {
    const limit = data.limit ?? 0;
    const total = data.total ?? 0;
    return limit > 0 && data.page * limit < total;
  }

  private titleCase(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  private sanitizeId(value: string): string {
    return value.replace(/[^A-Za-z0-9._\-@()[\]%?#+=/&:]/g, "_");
  }

  private async fetchLibrary(params: {
    page: number;
    sort: string;
    order: string;
    q?: string;
  }): Promise<LibraryResponse> {
    const query: string[] = [
      `page=${encodeURIComponent(String(params.page))}`,
      `sort=${encodeURIComponent(params.sort)}`,
      `order=${encodeURIComponent(params.order)}`,
    ];
    if (params.q && params.q.trim().length > 0) {
      query.push(`q=${encodeURIComponent(params.q.trim())}`);
    }
    return this.fetchJson<LibraryResponse>(`${API_URL}/library?${query.join("&")}`);
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const [response, buffer] = await Application.scheduleRequest({ url, method: "GET" });
    if (response.status !== 200) {
      throw new Error(`Request failed (${response.status}) for ${url}`);
    }
    const body = Application.arrayBufferToUTF8String(buffer);
    try {
      return JSON.parse(body) as T;
    } catch {
      throw new Error(`Unexpected non-JSON response (${response.status}) for ${url}`);
    }
  }
}

export const Hentalk = new HentalkExtension();
