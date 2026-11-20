#!/usr/bin/env node
/**
 * After every edit to interface code (.ts and .tsx under src) or the manual (.md under wiki): reminds the
 * editor to cut the new text to the fewest words, and lists any banned word in the file.
 * Rules: "Copy" in CLAUDE.md and scripts/copy-rules.mjs. Never blocks; it only reports.
 */
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { isCopyFile, vocabularyHits } from "../../scripts/copy-rules.mjs";

let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  try {
    const event = JSON.parse(input || "{}");
    const abs = event.tool_input?.file_path;
    if (!abs) return;
    const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const file = relative(root, abs);
    if (!isCopyFile(file)) return;
    const added = `${event.tool_input?.new_string ?? ""}${event.tool_input?.content ?? ""}`;
    // Only when the edit touched Spanish copy: quoted or JSX text with letters, or any manual page.
    if (!file.startsWith("wiki/") && !/[>"'`][^<>"'`{}]*[A-Za-zÁÉÍÓÚáéíóúñ]{3,}\s[A-Za-zÁÉÍÓÚáéíóúñ]/.test(added)) return;
    const hits = vocabularyHits(file, readFileSync(abs, "utf8"));
    const lines = [
      `Copy check for ${file}: before moving on, reread every text you added or changed and cut it to the fewest words (CLAUDE.md → Copy).`,
      "Remove: what the heading, column, document or icon already says; context the user can work out alone; explanations of ordinary controls; narrative and connectors. Labels are nouns or short facts. Neutral Spanish, tú, impersonal, the agreed vocabulary.",
      ...(hits.length ? ["Banned words in this file:", ...hits] : []),
    ];
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: lines.join("\n") } }));
  } catch {
    // A broken hook must never get in the way of an edit.
  }
});
