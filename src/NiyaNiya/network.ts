/* SPDX-License-Identifier: GPL-3.0-or-later */

import {
  CloudflareError,
  PaperbackInterceptor,
  type Request,
  type Response,
} from "@paperback/types";

import { getClearance, setClearance } from "./forms";
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

// Same as the Madara/ToonGod base: point every challenge at the site root so
// the app can run one bypass instead of stacking a prompt per request.
export function niyaCloudflareError(): CloudflareError {
  return new CloudflareError(
    {
      url: `${SITE_URL}/`,
      method: "GET",
      headers: {
        Referer: `${SITE_URL}/`,
        Origin: SITE_URL,
        "User-Agent": DESKTOP_USER_AGENT,
      },
    },
    "Verify to continue. If it keeps looping, paste a token from a browser (see NiyaNiya settings).",
  );
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
    // Standard Cloudflare challenge (as handled by the Madara/ToonGod base).
    const cfMitigated = response.headers?.["cf-mitigated"];
    if (cfMitigated === "challenge") {
      throw niyaCloudflareError();
    }

    // A gated request that comes back 400/403 means the clearance token is
    // missing or expired. Drop the stale token, then either trigger the in-app
    // bypass (which can mint a new one when the webview is allowed) or, if that
    // keeps failing, the user pastes one from a browser.
    if (isClearanceGated(request) && (response.status === 400 || response.status === 403)) {
      setClearance(undefined);
      // Only escalate to the bypass webview if we don't already have a token;
      // if we just cleared a bad one, the next read attempt will re-trigger.
      if (getClearance() === undefined) {
        throw niyaCloudflareError();
      }
    }
    return data;
  }
}
