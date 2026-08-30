/* SPDX-License-Identifier: GPL-3.0-or-later */

import {
  AdvancedSearchForm,
  Form,
  InputRow,
  Section,
  SelectRow,
  type SearchQuery,
} from "@paperback/types";

import {
  DEFAULT_IMAGE_FORMAT,
  type HentaiNexusSearchMetadata,
  IMAGE_FORMAT_KEY,
  IMAGE_FORMAT_OPTIONS,
  SORT_OPTIONS,
} from "./models";

export function getImageFormat(): string {
  return (Application.getState(IMAGE_FORMAT_KEY) as string | undefined) ?? DEFAULT_IMAGE_FORMAT;
}

export class SettingsForm extends Form {
  private format = getImageFormat();

  override getSections() {
    return [
      Section(
        {
          id: "reading",
          header: "Reading",
          footer:
            "Original quality needs a HentaiNexus account and is not available anonymously; " +
            "WebP works without one.",
        },
        [
          SelectRow("format", {
            title: "Image Quality",
            value: [this.format],
            layout: "list",
            items: IMAGE_FORMAT_OPTIONS,
            minItemCount: 1,
            maxItemCount: 1,
            onValueChange: Application.Selector(this as SettingsForm, "handleFormatChange"),
          }),
        ],
      ),
    ];
  }

  async handleFormatChange(value: string[]): Promise<void> {
    this.format = value[0] ?? DEFAULT_IMAGE_FORMAT;
    Application.setState(this.format, IMAGE_FORMAT_KEY);
  }
}

export class HentaiNexusAdvancedSearchForm extends AdvancedSearchForm {
  private sort: string;
  private filters: Record<string, string>;

  constructor(searchQuery: SearchQuery<HentaiNexusSearchMetadata>) {
    super();
    this.sort = searchQuery.metadata?.sort ?? SORT_OPTIONS[0]!.id;
    this.filters = { ...searchQuery.metadata?.filters };
  }

  override getSections() {
    return [
      Section("sort", [
        SelectRow("sort", {
          title: "Sort by",
          value: [this.sort],
          layout: "list",
          items: SORT_OPTIONS.map((o) => ({ id: o.id, title: o.title })),
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector(this as HentaiNexusAdvancedSearchForm, "handleSort"),
        }),
      ]),

      Section(
        {
          id: "filters",
          header: "Filters",
          footer:
            "Separate items with commas. Prepend a dash (-) to exclude. " +
            'Wrap multi-word items in double quotes (").',
        },
        [
          InputRow("tag", {
            title: "Tags",
            value: this.filters["tag"] ?? "",
            onValueChange: Application.Selector(
              this as HentaiNexusAdvancedSearchForm,
              "handleFilter_tag",
            ),
          }),
          InputRow("artist", {
            title: "Artists",
            value: this.filters["artist"] ?? "",
            onValueChange: Application.Selector(
              this as HentaiNexusAdvancedSearchForm,
              "handleFilter_artist",
            ),
          }),
          InputRow("author", {
            title: "Authors",
            value: this.filters["author"] ?? "",
            onValueChange: Application.Selector(
              this as HentaiNexusAdvancedSearchForm,
              "handleFilter_author",
            ),
          }),
          InputRow("circle", {
            title: "Circles",
            value: this.filters["circle"] ?? "",
            onValueChange: Application.Selector(
              this as HentaiNexusAdvancedSearchForm,
              "handleFilter_circle",
            ),
          }),
          InputRow("event", {
            title: "Events",
            value: this.filters["event"] ?? "",
            onValueChange: Application.Selector(
              this as HentaiNexusAdvancedSearchForm,
              "handleFilter_event",
            ),
          }),
          InputRow("parody", {
            title: "Parodies",
            value: this.filters["parody"] ?? "",
            onValueChange: Application.Selector(
              this as HentaiNexusAdvancedSearchForm,
              "handleFilter_parody",
            ),
          }),
          InputRow("magazine", {
            title: "Magazines",
            value: this.filters["magazine"] ?? "",
            onValueChange: Application.Selector(
              this as HentaiNexusAdvancedSearchForm,
              "handleFilter_magazine",
            ),
          }),
          InputRow("publisher", {
            title: "Publishers",
            value: this.filters["publisher"] ?? "",
            onValueChange: Application.Selector(
              this as HentaiNexusAdvancedSearchForm,
              "handleFilter_publisher",
            ),
          }),
        ],
      ),
    ];
  }

  async handleSort(value: string[]): Promise<void> {
    this.sort = value[0] ?? SORT_OPTIONS[0]!.id;
  }

  // Individual per-filter handlers so each row updates its own key.
  async handleFilter_tag(value: string): Promise<void> {
    this.filters["tag"] = value;
  }
  async handleFilter_artist(value: string): Promise<void> {
    this.filters["artist"] = value;
  }
  async handleFilter_author(value: string): Promise<void> {
    this.filters["author"] = value;
  }
  async handleFilter_circle(value: string): Promise<void> {
    this.filters["circle"] = value;
  }
  async handleFilter_event(value: string): Promise<void> {
    this.filters["event"] = value;
  }
  async handleFilter_parody(value: string): Promise<void> {
    this.filters["parody"] = value;
  }
  async handleFilter_magazine(value: string): Promise<void> {
    this.filters["magazine"] = value;
  }
  async handleFilter_publisher(value: string): Promise<void> {
    this.filters["publisher"] = value;
  }

  override getSearchQueryMetadata(): HentaiNexusSearchMetadata {
    return {
      sort: this.sort,
      filters: this.filters,
    };
  }
}
