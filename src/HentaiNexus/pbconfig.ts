/* SPDX-License-Identifier: GPL-3.0-or-later */

import { ContentRating, SourceIntents, type ExtensionInfo } from "@paperback/types";

export default {
  name: "HentaiNexus",
  description: "Extension for hentainexus.com. English hentai manga and doujinshi.",
  version: "1.0.0",
  icon: "icon.png",
  language: "en",
  contentRating: ContentRating.ADULT,
  capabilities: [
    SourceIntents.SETTINGS_FORM_PROVIDING,
    SourceIntents.DISCOVER_SECTION_PROVIDING,
    SourceIntents.SEARCH_RESULT_PROVIDING,
    SourceIntents.CHAPTER_PROVIDING,
  ],
  badges: [
    {
      label: "18+",
      textColor: "#FFFFFF",
      backgroundColor: "#EE4444",
    },
  ],
  developers: [
    {
      // TODO: replace with your own name / GitHub before publishing.
      name: "Self-hosted",
    },
  ],
} satisfies ExtensionInfo;
