import { type TestLogger } from "@paperback/types";

import { Hentalk } from "../Hentalk/main.js";
import sourceInfo from "../Hentalk/pbconfig.js";
import { registerDefaultTests, TestSuite } from "./suite.js";

export async function runTests(logger: TestLogger) {
  const suite = new TestSuite("Hentalk tests", logger);
  registerDefaultTests(suite, Hentalk, sourceInfo);

  await suite.run();
}
