/* SPDX-License-Identifier: GPL-3.0-or-later */

import {
  CloudflareError,
  PaperbackInterceptor,
  type Request,
  type Response,
} from "@paperback/types";

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
    // missing or expired. Drop it and ask the app to run the Cloudflare check.
    if (isClearanceGated(request) && (response.status === 400 || response.status === 403)) {
      setClearance(undefined);
      throw new CloudflareError(
        {
          url: `${SITE_URL}/`,
          method: "GET",
          headers: {
            Referer: `${SITE_URL}/`,
            "User-Agent": DESKTOP_USER_AGENT,
          },
        },
        "Complete the check, wait for the page to fully load, then reopen the chapter.",
      );
    }
    return data;
  }
}
