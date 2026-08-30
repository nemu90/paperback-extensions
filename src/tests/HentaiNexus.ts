import { type TestLogger } from "@paperback/types";

import { HentaiNexus } from "../HentaiNexus/main.js";
import sourceInfo from "../HentaiNexus/pbconfig.js";
import { registerDefaultTests, TestSuite } from "./suite.js";

export async function runTests(logger: TestLogger) {
  const suite = new TestSuite("HentaiNexus tests", logger);
  registerDefaultTests(suite, HentaiNexus, sourceInfo);

  await suite.run();
}
