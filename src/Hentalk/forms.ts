/* SPDX-License-Identifier: GPL-3.0-or-later */

import { AdvancedSearchForm, Section, SelectRow, type SearchQuery } from "@paperback/types";

import { type HentalkSearchMetadata, SORT_OPTIONS } from "./models";

export class HentalkAdvancedSearchForm extends AdvancedSearchForm {
  private sort: string;

  constructor(searchQuery: SearchQuery<HentalkSearchMetadata>) {
    super();
    this.sort = searchQuery.metadata?.sort ?? SORT_OPTIONS[0]!.id;
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
          onValueChange: Application.Selector(this as HentalkAdvancedSearchForm, "handleSort"),
        }),
      ]),
    ];
  }

  async handleSort(value: string[]): Promise<void> {
    this.sort = value[0] ?? SORT_OPTIONS[0]!.id;
  }

  override getSearchQueryMetadata(): HentalkSearchMetadata {
    return { sort: this.sort };
  }
}
