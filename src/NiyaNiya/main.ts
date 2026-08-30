/* SPDX-License-Identifier: GPL-3.0-or-later */

import {
  BasicRateLimiter,
  ContentRating,
  CookieStorageInterceptor,
  type Chapter,
  type ChapterDetails,
  type Cookie,
  type DiscoverSection,
  type DiscoverSectionItem,
  DiscoverSectionType,
  type ExtensionImpl,
  type Form,
  type PagedResults,
  type Request,
  type SearchQuery,
  type SearchResultItem,
  type SourceManga,
  type Tag,
  type TagSection,
} from "@paperback/types";

import {
  getClearance,
  getExcludeTags,
  getQuality,
  getRemoveBrackets,
  NiyaNiyaAdvancedSearchForm,
  SettingsForm,
  setClearance,
} from "./forms";
import {
  type BookEntry,
  BOOKS_URL,
  type BooksResponse,
  CATEGORY_OPTIONS,
  DEFAULT_QUALITY,
  type ImagesInfo,
  type MangaData,
  type MangaDetailResponse,
  NAMESPACE_TITLES,
  type NiyaNiyaSearchMetadata,
  SITE_URL,
  SORT_OPTIONS,
} from "./models";
import { MainInterceptor, niyaCloudflareError } from "./network";
import type NiyaNiyaConfig from "./pbconfig";

const BRACKETS_REGEX = /(\[[^\]]*\]|[({][^)}]*[)}])/g;

// Fallback order for each requested resolution, mirroring the website.
const QUALITY_FALLBACKS: Record<string, string[]> = {
  "1600": ["1600", "1280", "0", "980", "780"],
  "1280": ["1280", "1600", "0", "980", "780"],
  "980": ["980", "1280", "0", "1600", "780"],
  "780": ["780", "980", "0", "1280", "1600"],
  "0": ["0", "1600", "1280", "980", "780"],
};

export class NiyaNiyaExtension implements ExtensionImpl<typeof NiyaNiyaConfig> {
  mainRateLimiter = new BasicRateLimiter("main", {
    numberOfRequests: 3,
    bufferInterval: 1,
    ignoreImages: true,
  });

  mainInterceptor = new MainInterceptor("main");

  // Persists Cloudflare cookies collected by the bypass webview, exactly like
  // the Madara/ToonGod base does.
  cookieStorageInterceptor = new CookieStorageInterceptor({ storage: "stateManager" });

  async initialise(): Promise<void> {
    this.cookieStorageInterceptor.registerInterceptor();
    this.mainRateLimiter.registerInterceptor();
    this.mainInterceptor.registerInterceptor();
  }

  async getSettingsForm(): Promise<Form> {
    return new SettingsForm();
  }

  // ----- Discover -----

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "8",
        title: "Popular",
        subtitle: "Most viewed titles",
        type: DiscoverSectionType.featured,
      },
      {
        id: "4",
        title: "Recently Posted",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "9",
        title: "Most Favorited",
        type: DiscoverSectionType.simpleCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata?: NiyaNiyaSearchMetadata,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;
    const url = this.buildBooksUrl({ sort: section.id, page });
    const data = await this.fetchJson<BooksResponse>(url, "GET");

    const featured = section.type === DiscoverSectionType.featured;
    const items: DiscoverSectionItem[] = (data.entries ?? []).map((entry) =>
      featured
        ? {
            type: "featuredCarouselItem",
            mangaId: this.mangaId(entry),
            title: this.cleanTitle(entry.title),
            imageUrl: entry.thumbnail.path,
            contentRating: ContentRating.ADULT,
          }
        : {
            type: "simpleCarouselItem",
            mangaId: this.mangaId(entry),
            title: this.cleanTitle(entry.title),
            imageUrl: entry.thumbnail.path,
            contentRating: ContentRating.ADULT,
          },
    );

    return {
      items,
      metadata: this.hasNextPage(data) ? { page: page + 1 } : undefined,
    };
  }

  // ----- Search -----

  async getAdvancedSearchForm(
    query: SearchQuery<NiyaNiyaSearchMetadata>,
  ): Promise<NiyaNiyaAdvancedSearchForm> {
    return new NiyaNiyaAdvancedSearchForm(query);
  }

  async getSearchResults(
    query: SearchQuery<NiyaNiyaSearchMetadata>,
    metadata?: NiyaNiyaSearchMetadata,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata?.page ?? 1;
    const sort = query.metadata?.sort ?? SORT_OPTIONS[0]!.id;
    const language = query.metadata?.language ?? "all";
    const categories = query.metadata?.categories ?? CATEGORY_OPTIONS.map((c) => c.id);

    const url = this.buildBooksUrl({
      sort,
      page,
      title: query.title,
      language,
      categories,
    });

    const data = await this.fetchJson<BooksResponse>(url, "GET");

    const items: SearchResultItem[] = (data.entries ?? []).map((entry) => ({
      mangaId: this.mangaId(entry),
      title: this.cleanTitle(entry.title),
      imageUrl: entry.thumbnail.path,
      contentRating: ContentRating.ADULT,
    }));

    return {
      items,
      metadata: this.hasNextPage(data) ? { page: page + 1 } : undefined,
    };
  }

  // ----- Details -----

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const detail = await this.fetchJson<MangaDetailResponse>(
      `${BOOKS_URL}/detail/${mangaId}`,
      "GET",
    );

    const grouped = new Map<number, string[]>();
    for (const tag of detail.tags ?? []) {
      const ns = tag.namespace ?? 0;
      if (!grouped.has(ns)) {
        grouped.set(ns, []);
      }
      grouped.get(ns)!.push(tag.name);
    }

    const tagGroups: TagSection[] = [];
    for (const [ns, title] of Object.entries(NAMESPACE_TITLES)) {
      const names = grouped.get(Number(ns));
      if (!names || names.length === 0) {
        continue;
      }
      const tags: Tag[] = names.map((name) => ({
        id: `${ns}:${this.sanitizeId(name)}`,
        title: name,
      }));
      tagGroups.push({ id: ns, title, tags });
    }

    const artists = grouped.get(1) ?? [];
    const circles = grouped.get(2) ?? [];
    const parodies = grouped.get(3) ?? [];
    const magazines = grouped.get(4) ?? [];
    const characters = grouped.get(5) ?? [];

    const synopsisLines: string[] = [];
    if (circles.length) synopsisLines.push(`Circles: ${circles.join(", ")}`);
    if (magazines.length) synopsisLines.push(`Magazines: ${magazines.join(", ")}`);
    if (parodies.length) synopsisLines.push(`Parodies: ${parodies.join(", ")}`);
    if (characters.length) synopsisLines.push(`Characters: ${characters.join(", ")}`);
    synopsisLines.push(`Pages: ${detail.thumbnails.entries.length}`);

    return {
      mangaId,
      mangaInfo: {
        thumbnailUrl: detail.thumbnails.base + detail.thumbnails.main.path,
        synopsis: synopsisLines.join("\n"),
        primaryTitle: this.cleanTitle(detail.title),
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

    const detail = await this.fetchJson<MangaDetailResponse>(
      `${BOOKS_URL}/detail/${sourceManga.mangaId}`,
      "GET",
    );

    const publishDate = detail.updated_at ?? detail.created_at;

    return [
      {
        chapterId: sourceManga.mangaId,
        sourceManga,
        langCode: "en",
        chapNum: 1,
        title: "Chapter",
        publishDate: publishDate ? new Date(publishDate) : undefined,
      },
    ];
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const mangaId = chapter.sourceManga.mangaId;

    // Reading pages needs a clearance token. Trigger the in-app bypass webview
    // (which mints one when it is allowed to run); if that keeps failing the
    // user can paste a token from a real browser via settings.
    if (getClearance() === undefined) {
      throw niyaCloudflareError();
    }

    const crt = encodeURIComponent(getClearance()!);

    // Step 1: page-data (which resolutions exist, with their access keys).
    const mangaData = await this.fetchJson<MangaData>(
      `${BOOKS_URL}/detail/${mangaId}?crt=${crt}`,
      "POST",
    );

    const requested = getQuality();
    const order = QUALITY_FALLBACKS[requested] ?? QUALITY_FALLBACKS[DEFAULT_QUALITY]!;

    let realQuality: string | undefined;
    let dataId: number | undefined;
    let dataKey: string | undefined;
    for (const q of order) {
      const entry = mangaData.data[q as keyof MangaData["data"]];
      if (entry?.id != null && entry?.key != null) {
        realQuality = q;
        dataId = entry.id;
        dataKey = entry.key;
        break;
      }
    }

    if (realQuality === undefined || dataId === undefined || dataKey === undefined) {
      throw new Error("No downloadable images were found for this title");
    }

    // Step 2: resolve the actual image paths for that resolution.
    const [id, key] = mangaId.split("/");
    const images = await this.fetchJson<ImagesInfo>(
      `${BOOKS_URL}/data/${id}/${key}/${dataId}/${dataKey}/${realQuality}?crt=${crt}`,
      "GET",
    );

    const pages = images.entries.map((image) => `${images.base}/${image.path}?w=${realQuality}`);

    return {
      id: chapter.chapterId,
      mangaId,
      pages,
    };
  }

  // ----- Cloudflare bypass -----

  // Deprecated path: older app builds only hand back cookies (no localStorage).
  async saveCloudflareBypassCookies(cookies: Cookie[]): Promise<void> {
    this.storeCloudflareCookies(cookies);
  }

  async cloudflareBypassCompleted(
    request: Request,
    cookies: Cookie[],
    localStorage: Record<string, string>,
  ): Promise<void> {
    void request;

    this.storeCloudflareCookies(cookies);

    // The token is normally stored under the "clearance" key, but fall back to
    // any key that looks like it in case the site renames it.
    let token = localStorage["clearance"];
    if (!token) {
      for (const [k, v] of Object.entries(localStorage)) {
        if (/clearance/i.test(k) && v) {
          token = v;
          break;
        }
      }
    }
    if (token && token.length > 0) {
      setClearance(token.replace(/^"|"$/g, ""));
    }
  }

  private storeCloudflareCookies(cookies: Cookie[]): void {
    for (const cookie of cookies) {
      if (/^_{0,2}cf/i.test(cookie.name)) {
        this.cookieStorageInterceptor.setCookie(cookie);
      }
    }
  }

  // ----- Helpers -----

  private mangaId(entry: BookEntry): string {
    return `${entry.id}/${entry.key}`;
  }

  // Tag IDs may only contain alphanumerics or ._-@()[]%?#+=/&: — replace the
  // rest (notably spaces) so multi-word tag names are accepted by the app.
  private sanitizeId(value: string): string {
    return value.replace(/[^A-Za-z0-9._\-@()[\]%?#+=/&:]/g, "_");
  }

  private cleanTitle(title: string): string {
    if (!getRemoveBrackets()) {
      return title;
    }
    return title.replace(BRACKETS_REGEX, "").replace(/\s+/g, " ").trim() || title;
  }

  private hasNextPage(data: BooksResponse): boolean {
    const limit = data.limit ?? 0;
    const total = data.total ?? 0;
    return limit > 0 && data.page * limit < total;
  }

  private buildBooksUrl(params: {
    sort: string;
    page: number;
    title?: string;
    language?: string;
    categories?: string[];
  }): string {
    const query: string[] = [];
    query.push(`sort=${encodeURIComponent(params.sort)}`);
    query.push(`page=${encodeURIComponent(String(params.page))}`);

    const terms: string[] = [];
    if (params.language && params.language !== "all") {
      terms.push(`language:"^${params.language}$"`);
    }

    const excluded = getExcludeTags()
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (excluded.length > 0) {
      terms.push(`tag:"${excluded.map((t) => `-${t}`).join(",")}"`);
    }

    if (params.title && params.title.trim().length > 0) {
      terms.push(`title:"${params.title.trim()}"`);
    }

    if (terms.length > 0) {
      query.push(`s=${encodeURIComponent(terms.join(" "))}`);
    }

    if (params.categories && params.categories.length > 0) {
      const selected = CATEGORY_OPTIONS.filter((c) => params.categories!.includes(c.id));
      if (selected.length > 0 && selected.length < CATEGORY_OPTIONS.length) {
        query.push(`cat=${selected.reduce((sum, c) => sum + c.value, 0)}`);
      }
    }

    return `${BOOKS_URL}?${query.join("&")}`;
  }

  private async fetchJson<T>(url: string, method: "GET" | "POST"): Promise<T> {
    const [response, buffer] = await Application.scheduleRequest({ url, method });
    const body = Application.arrayBufferToUTF8String(buffer);

    if (response.status !== 200) {
      throw new Error(`Request failed (${response.status}) for ${url}`);
    }

    try {
      return JSON.parse(body) as T;
    } catch {
      throw new Error(`Unexpected non-JSON response (${response.status}) for ${url}`);
    }
  }
}

export const NiyaNiya = new NiyaNiyaExtension();
