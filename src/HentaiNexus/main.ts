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
  type Form,
  type PagedResults,
  type SearchQuery,
  type SearchResultItem,
  type SourceManga,
  type Tag,
  type TagSection,
} from "@paperback/types";
import * as cheerio from "cheerio";

import { getImageFormat, HentaiNexusAdvancedSearchForm, SettingsForm } from "./forms";
import {
  type HentaiNexusSearchMetadata,
  imageFieldFor,
  POPULAR_PATH,
  type ReaderImage,
  SEARCH_FILTERS,
  SITE_URL,
  SORT_OPTIONS,
} from "./models";
import { MainInterceptor } from "./network";
import type HentaiNexusConfig from "./pbconfig";
import { decryptReaderData } from "./utils";

const TAG_COUNT_REGEX = /\s*\([\d,]+\)$/;
const DETAIL_KEYS = ["Circle", "Event", "Magazine", "Parody", "Publisher", "Pages", "Favorites"];

export class HentaiNexusExtension implements ExtensionImpl<typeof HentaiNexusConfig> {
  mainRateLimiter = new BasicRateLimiter("main", {
    numberOfRequests: 2,
    bufferInterval: 1,
    ignoreImages: true,
  });

  mainInterceptor = new MainInterceptor("main");

  async initialise(): Promise<void> {
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
        id: "popular",
        title: "Popular Now",
        type: DiscoverSectionType.featured,
      },
      {
        id: "latest",
        title: "Latest",
        type: DiscoverSectionType.simpleCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata?: HentaiNexusSearchMetadata,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata?.page ?? 1;

    let url: string;
    let paginated: boolean;
    if (section.id === "popular") {
      url = `${SITE_URL}${POPULAR_PATH}`;
      paginated = false;
    } else {
      url = page > 1 ? `${SITE_URL}/page/${page}` : `${SITE_URL}/`;
      paginated = true;
    }

    const $ = await this.fetchCheerio(url);
    const items: DiscoverSectionItem[] = this.parseCards($).map((card) => ({
      type: "simpleCarouselItem",
      mangaId: card.mangaId,
      title: card.title,
      imageUrl: card.imageUrl,
      contentRating: ContentRating.ADULT,
    }));

    const hasNext = paginated && $("a.pagination-next[href]").length > 0;
    return {
      items,
      metadata: hasNext ? { page: page + 1 } : undefined,
    };
  }

  // ----- Search -----

  async getAdvancedSearchForm(
    query: SearchQuery<HentaiNexusSearchMetadata>,
  ): Promise<HentaiNexusAdvancedSearchForm> {
    return new HentaiNexusAdvancedSearchForm(query);
  }

  async getSearchResults(
    query: SearchQuery<HentaiNexusSearchMetadata>,
    metadata?: HentaiNexusSearchMetadata,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata?.page ?? 1;
    const q = this.buildQuery(query);

    const path = page > 1 ? `/page/${page}` : "/";
    const url =
      q.length > 0 ? `${SITE_URL}${path}?q=${encodeURIComponent(q)}` : `${SITE_URL}${path}`;

    const $ = await this.fetchCheerio(url);
    const items: SearchResultItem[] = this.parseCards($).map((card) => ({
      mangaId: card.mangaId,
      title: card.title,
      imageUrl: card.imageUrl,
      contentRating: ContentRating.ADULT,
    }));

    const hasNext = $("a.pagination-next[href]").length > 0;
    return {
      items,
      metadata: hasNext ? { page: page + 1 } : undefined,
    };
  }

  // ----- Details -----

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const $ = await this.fetchCheerio(`${SITE_URL}/view/${mangaId}`);

    const title = $("h1.title").first().text().trim();
    const thumbnailUrl = $("figure.image img").first().attr("src") ?? "";

    const artists = this.cellLinks($, "Artist");
    const authors = this.cellLinks($, "Author");
    const author = [...new Set([...authors, ...artists])].join(", ");

    const genreTags: Tag[] = [];
    $("span.tag a").each((_, el) => {
      const name = $(el).text().replace(TAG_COUNT_REGEX, "").trim();
      if (name.length > 0) {
        genreTags.push({ id: this.sanitizeId(name), title: name });
      }
    });

    const descriptionLines: string[] = [];
    for (const key of DETAIL_KEYS) {
      const cell = $(`td.viewcolumn:contains(${key}) + td`).first();
      if (cell.length === 0) {
        continue;
      }
      const value = (cell.clone().children().remove().end().text().trim() ||
        cell.find("a").first().text().trim()) as string;
      if (value.length > 0) {
        descriptionLines.push(`${key}: ${value}`);
      }
    }
    const synopsisCell = $(`td.viewcolumn:contains(Description) + td`).first();
    const synopsisText = synopsisCell.length > 0 ? synopsisCell.text().trim() : "";
    const synopsis = [descriptionLines.join("\n"), synopsisText]
      .filter((s) => s.length > 0)
      .join("\n\n");

    const tagGroups: TagSection[] =
      genreTags.length > 0 ? [{ id: "tags", title: "Tags", tags: genreTags }] : [];

    return {
      mangaId,
      mangaInfo: {
        thumbnailUrl,
        synopsis: synopsis.length > 0 ? synopsis : "No description.",
        primaryTitle: title.length > 0 ? title : "Unknown Title",
        secondaryTitles: [],
        contentRating: ContentRating.ADULT,
        status: "Completed",
        author: author.length > 0 ? author : undefined,
        artist: artists.join(", ") || undefined,
        tagGroups,
        shareUrl: `${SITE_URL}/view/${mangaId}`,
      },
    };
  }

  // ----- Chapters -----

  async getChapters(sourceManga: SourceManga, sinceDate?: Date): Promise<Chapter[]> {
    void sinceDate;
    return [
      {
        chapterId: sourceManga.mangaId,
        sourceManga,
        langCode: "en",
        chapNum: 1,
        title: "Chapter",
      },
    ];
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const $ = await this.fetchCheerio(`${SITE_URL}/read/${chapter.sourceManga.mangaId}`);

    let encoded: string | undefined;
    $("script").each((_, el) => {
      const data = $(el).html() ?? "";
      const match = /initReader\("([^"]+)"/.exec(data);
      if (match) {
        encoded = match[1];
        return false;
      }
      return undefined;
    });

    if (!encoded) {
      throw new Error("Could not find the reader payload; the page structure may have changed");
    }

    const decrypted = decryptReaderData(encoded);
    const parsed = JSON.parse(decrypted) as ReaderImage[];
    const images = parsed.filter((item) => item.type === "image");
    if (images.length === 0) {
      throw new Error("No images found for this title");
    }

    const preferred = imageFieldFor(getImageFormat());
    const pages: string[] = [];
    for (const image of images) {
      const url =
        image[preferred] ?? image.image_fallback ?? image.image_avif ?? image.image_source;
      if (url) {
        pages.push(url);
      }
    }

    if (pages.length === 0) {
      throw new Error("Selected quality is unavailable. Try WebP in settings.");
    }

    return {
      id: chapter.chapterId,
      mangaId: chapter.sourceManga.mangaId,
      pages,
    };
  }

  // ----- Helpers -----

  private parseCards($: cheerio.CheerioAPI): {
    mangaId: string;
    title: string;
    imageUrl: string;
  }[] {
    const cards: { mangaId: string; title: string; imageUrl: string }[] = [];
    const seen = new Set<string>();
    for (const element of $(".container .column").toArray()) {
      const link = $(element).find("a[href*='/view/']").first();
      const href = link.attr("href") ?? "";
      const mangaId = this.idFromUrl(href);
      if (!mangaId || seen.has(mangaId)) {
        continue;
      }
      seen.add(mangaId);
      const title = $(element).find(".card-header-title").first().text().trim();
      const imageUrl = $(element).find(".card-image img").first().attr("src") ?? "";
      cards.push({ mangaId, title: title.length > 0 ? title : "Unknown Title", imageUrl });
    }
    return cards;
  }

  private cellLinks($: cheerio.CheerioAPI, key: string): string[] {
    const out: string[] = [];
    $(`td.viewcolumn:contains(${key}) + td a`).each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 0) {
        out.push(text);
      }
    });
    return out;
  }

  private buildQuery(query: SearchQuery<HentaiNexusSearchMetadata>): string {
    const parts: string[] = [];

    const sortId = query.metadata?.sort ?? SORT_OPTIONS[0]!.id;
    const sortToken = SORT_OPTIONS.find((o) => o.id === sortId)?.token ?? "";
    if (sortToken.length > 0) {
      parts.push(sortToken);
    }

    const filters = query.metadata?.filters ?? {};
    for (const filter of SEARCH_FILTERS) {
      const raw = filters[filter.id];
      if (!raw) {
        continue;
      }
      for (const token of this.splitTokens(raw)) {
        const exclude = token.startsWith("-");
        const text = exclude ? token.slice(1) : token;
        if (text.length > 0) {
          parts.push(`${exclude ? "-" : ""}${filter.key}:${text}`);
        }
      }
    }

    if (query.title && query.title.trim().length > 0) {
      parts.push(query.title.trim());
    }

    return parts.join(" ").trim();
  }

  // Splits on commas but keeps quoted multi-word values intact.
  private splitTokens(state: string): string[] {
    const tokens: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of state) {
      if (ch === '"') {
        inQuotes = !inQuotes;
        current += ch;
      } else if (ch === "," && !inQuotes) {
        const t = current.trim();
        if (t.length > 0) tokens.push(t);
        current = "";
      } else {
        current += ch;
      }
    }
    const last = current.trim();
    if (last.length > 0) tokens.push(last);
    return tokens;
  }

  private idFromUrl(url: string): string | undefined {
    const match = /\/view\/(\d+)/.exec(url);
    return match ? match[1] : undefined;
  }

  private sanitizeId(value: string): string {
    return value.replace(/[^A-Za-z0-9._\-@()[\]%?#+=/&:]/g, "_");
  }

  private async fetchCheerio(url: string): Promise<cheerio.CheerioAPI> {
    const [response, buffer] = await Application.scheduleRequest({ url, method: "GET" });
    if (response.status !== 200) {
      throw new Error(`Request failed (${response.status}) for ${url}`);
    }
    const html = Application.arrayBufferToUTF8String(buffer);
    return cheerio.load(html);
  }
}

export const HentaiNexus = new HentaiNexusExtension();
