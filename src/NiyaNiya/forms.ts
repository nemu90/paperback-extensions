/* SPDX-License-Identifier: GPL-3.0-or-later */

import {
  AdvancedSearchForm,
  ButtonRow,
  Form,
  InputRow,
  LabelRow,
  Section,
  SelectRow,
  ToggleRow,
  type SearchQuery,
} from "@paperback/types";

import {
  CATEGORY_OPTIONS,
  CLEARANCE_STATE_KEY,
  DEFAULT_LANGUAGE,
  DEFAULT_QUALITY,
  EXCLUDE_TAGS_KEY,
  IMAGE_QUALITY_KEY,
  LANGUAGE_OPTIONS,
  type NiyaNiyaSearchMetadata,
  QUALITY_OPTIONS,
  REMOVE_BRACKETS_KEY,
  SORT_OPTIONS,
} from "./models";

// ----- Persistent settings helpers (shared with main.ts) -----

export function getQuality(): string {
  return (Application.getState(IMAGE_QUALITY_KEY) as string | undefined) ?? DEFAULT_QUALITY;
}

export function getRemoveBrackets(): boolean {
  return (Application.getState(REMOVE_BRACKETS_KEY) as boolean | undefined) ?? false;
}

export function getExcludeTags(): string {
  return (Application.getState(EXCLUDE_TAGS_KEY) as string | undefined) ?? "";
}

export function getClearance(): string | undefined {
  const value = Application.getSecureState(CLEARANCE_STATE_KEY) as string | undefined;
  return value && value.length > 0 ? value : undefined;
}

export function setClearance(value: string | undefined): void {
  Application.setSecureState(value ?? "", CLEARANCE_STATE_KEY);
}

// ----- Settings form -----

export class SettingsForm extends Form {
  private quality = getQuality();
  private removeBrackets = getRemoveBrackets();
  private excludeTags = getExcludeTags();
  private clearanceInput = "";

  override getSections() {
    const hasClearance = getClearance() !== undefined;

    return [
      Section(
        {
          id: "reading",
          header: "Reading",
          footer: "Higher resolutions look sharper but download more slowly.",
        },
        [
          SelectRow("quality", {
            title: "Image Resolution",
            value: [this.quality],
            layout: "list",
            items: QUALITY_OPTIONS,
            minItemCount: 1,
            maxItemCount: 1,
            onValueChange: Application.Selector(this as SettingsForm, "handleQualityChange"),
          }),
        ],
      ),

      Section(
        {
          id: "display",
          header: "Display",
          footer: "Removes anything inside brackets from titles (e.g. artist/circle prefixes).",
        },
        [
          ToggleRow("removeBrackets", {
            title: "Clean up titles",
            value: this.removeBrackets,
            onValueChange: Application.Selector(this as SettingsForm, "handleRemoveBracketsChange"),
          }),
        ],
      ),

      Section(
        {
          id: "filtering",
          header: "Global filtering",
          footer: "Comma-separated tags to always hide from browse and search results.",
        },
        [
          InputRow("excludeTags", {
            title: "Excluded tags",
            value: this.excludeTags,
            onValueChange: Application.Selector(this as SettingsForm, "handleExcludeTagsChange"),
          }),
        ],
      ),

      Section(
        {
          id: "clearance",
          header: "Cloudflare clearance",
          footer:
            "Reading pages needs a clearance token from a Cloudflare check. The app grabs it " +
            "automatically the first time you open a chapter. If that fails you can paste one " +
            "manually: open niyaniya.moe in a browser, run localStorage.getItem('clearance') in " +
            "the dev console, and paste the value (without quotes) here.",
        },
        [
          LabelRow("clearanceStatus", {
            title: "Status",
            value: hasClearance
              ? { text: "Token stored", style: "success" }
              : { text: "No token yet", style: "warning" },
          }),
          InputRow("clearanceInput", {
            title: "Paste token",
            value: this.clearanceInput,
            isSecureEntry: true,
            onValueChange: Application.Selector(this as SettingsForm, "handleClearanceInput"),
          }),
          ButtonRow("saveClearance", {
            title: "Save pasted token",
            onSelect: Application.Selector(this as SettingsForm, "handleSaveClearance"),
          }),
          ButtonRow("clearClearance", {
            title: "Clear stored token",
            onSelect: Application.Selector(this as SettingsForm, "handleClearClearance"),
          }),
        ],
      ),
    ];
  }

  async handleQualityChange(value: string[]): Promise<void> {
    this.quality = value[0] ?? DEFAULT_QUALITY;
    Application.setState(this.quality, IMAGE_QUALITY_KEY);
  }

  async handleRemoveBracketsChange(value: boolean): Promise<void> {
    this.removeBrackets = value;
    Application.setState(value, REMOVE_BRACKETS_KEY);
  }

  async handleExcludeTagsChange(value: string): Promise<void> {
    this.excludeTags = value;
    Application.setState(value, EXCLUDE_TAGS_KEY);
  }

  async handleClearanceInput(value: string): Promise<void> {
    this.clearanceInput = value;
  }

  async handleSaveClearance(): Promise<void> {
    const token = this.clearanceInput.trim().replace(/^"|"$/g, "");
    if (token.length > 0) {
      setClearance(token);
      this.clearanceInput = "";
      this.reloadForm();
    }
  }

  async handleClearClearance(): Promise<void> {
    setClearance(undefined);
    this.reloadForm();
  }
}

// ----- Advanced search form -----

export class NiyaNiyaAdvancedSearchForm extends AdvancedSearchForm {
  private sort: string;
  private language: string;
  private categories: string[];

  constructor(searchQuery: SearchQuery<NiyaNiyaSearchMetadata>) {
    super();
    this.sort = searchQuery.metadata?.sort ?? SORT_OPTIONS[0]!.id;
    this.language = searchQuery.metadata?.language ?? DEFAULT_LANGUAGE;
    this.categories = searchQuery.metadata?.categories ?? CATEGORY_OPTIONS.map((c) => c.id);
  }

  override getSections() {
    return [
      Section("sort", [
        SelectRow("sort", {
          title: "Sort by",
          value: [this.sort],
          layout: "list",
          items: SORT_OPTIONS.map((o) => ({ id: o.id, title: o.label })),
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector(this as NiyaNiyaAdvancedSearchForm, "handleSort"),
        }),
      ]),

      Section("language", [
        SelectRow("language", {
          title: "Language",
          value: [this.language],
          layout: "list",
          items: LANGUAGE_OPTIONS,
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector(this as NiyaNiyaAdvancedSearchForm, "handleLanguage"),
        }),
      ]),

      Section("categories", [
        SelectRow("categories", {
          title: "Categories",
          value: this.categories,
          layout: "flow",
          items: CATEGORY_OPTIONS.map((c) => ({ id: c.id, title: c.title })),
          minItemCount: 0,
          maxItemCount: CATEGORY_OPTIONS.length,
          onValueChange: Application.Selector(
            this as NiyaNiyaAdvancedSearchForm,
            "handleCategories",
          ),
        }),
      ]),
    ];
  }

  async handleSort(value: string[]): Promise<void> {
    this.sort = value[0] ?? SORT_OPTIONS[0]!.id;
  }

  async handleLanguage(value: string[]): Promise<void> {
    this.language = value[0] ?? DEFAULT_LANGUAGE;
  }

  async handleCategories(value: string[]): Promise<void> {
    this.categories = value;
  }

  override getSearchQueryMetadata(): NiyaNiyaSearchMetadata {
    return {
      sort: this.sort,
      language: this.language,
      categories: this.categories,
    };
  }
}
