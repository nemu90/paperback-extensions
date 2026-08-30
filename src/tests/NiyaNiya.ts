import { type TestLogger } from "@paperback/types";

import { NiyaNiya } from "../NiyaNiya/main.js";
import sourceInfo from "../NiyaNiya/pbconfig.js";
import { registerDefaultTests, TestSuite } from "./suite.js";

export async function runTests(logger: TestLogger) {
  const suite = new TestSuite("NiyaNiya tests", logger);
  registerDefaultTests(suite, NiyaNiya, sourceInfo);

  await suite.run();
}
