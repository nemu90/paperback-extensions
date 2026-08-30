/* SPDX-License-Identifier: GPL-3.0-or-later */

import { PaperbackInterceptor, type Request, type Response } from "@paperback/types";

import { SITE_URL } from "./models";

export class MainInterceptor extends PaperbackInterceptor {
  override async interceptRequest(request: Request): Promise<Request> {
    request.headers = {
      ...request.headers,
      Referer: `${SITE_URL}/`,
      "User-Agent": await Application.getDefaultUserAgent(),
    };
    return request;
  }

  override async interceptResponse(
    request: Request,
    response: Response,
    data: ArrayBuffer,
  ): Promise<ArrayBuffer> {
    void request;
    void response;
    return data;
  }
}
