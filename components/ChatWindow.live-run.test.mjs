import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// A questionnaire call is answered from a dialog while its run is live, and a
// steer sent meanwhile opens a later group without ending the run. Liveness is
// therefore decided per message, not only for the live tail (#1).
test("gives a message the run's liveness, not just the live tail's", async () => {
  for (const path of ["../components/ChatWindow.tsx", "../demo/components/ChatWindow.tsx"]) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(
      source,
      /const liveRunIdx = liveRunMessageIndex\(messages, \{\s*runActive: agentRunning,\s*toolRunning: agentPhase\?\.kind === "running_tools",\s*\}\);/,
      `${path}: expected the run's liveness to come from liveRunMessageIndex()`,
    );
    assert.match(
      source,
      /isRunActive=\{options\.isRunActive \?\? \(idx === liveRunIdx\)\}/,
      `${path}: expected every message to fall back to the live run's own message`,
    );
  }
});
