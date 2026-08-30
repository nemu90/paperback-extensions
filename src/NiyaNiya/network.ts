/* SPDX-License-Identifier: GPL-3.0-or-later */

import { PaperbackInterceptor, type Request, type Response } from "@paperback/types";

import { setClearance } from "./forms";
import { DESKTOP_USER_AGENT, SITE_URL } from "./models";

// Requests to these API paths are gated behind a Cloudflare clearance token.
// Everything else on the API (browse, search, details, tags) is open.
function isClearanceGated(request: Request): boolean {
  const url = request.url;
  if (/\/books\/data\//.test(url)) {
    return true;
  }
  // The page-data call is a POST to /books/detail/... (the GET variant is open).
  if (/\/books\/detail\//.test(url) && request.method.toUpperCase() === "POST") {
    return true;
  }
  return false;
}

export class MainInterceptor extends PaperbackInterceptor {
  override async interceptRequest(request: Request): Promise<Request> {
    request.headers = {
      ...request.headers,
      Referer: `${SITE_URL}/`,
      Origin: SITE_URL,
      "User-Agent": DESKTOP_USER_AGENT,
    };
    return request;
  }

  override async interceptResponse(
    request: Request,
    response: Response,
    data: ArrayBuffer,
  ): Promise<ArrayBuffer> {
    // A gated request that comes back 400/403 means the clearance token is
    // missing or expired. Drop it and tell the user to refresh it from settings.
    if (isClearanceGated(request) && (response.status === 400 || response.status === 403)) {
      setClearance(undefined);
      throw new Error(
        "Clearance token missing or expired. Open niyaniya.moe in a browser, then use the " +
          "bookmarklet in NiyaNiya settings to copy a fresh token and paste it there.",
      );
    }
    return data;
  }
}
