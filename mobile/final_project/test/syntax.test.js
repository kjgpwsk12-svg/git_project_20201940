// 브라우저에서만 실행되는 화면 스크립트도 문법 오류가 없는지 확인한다.
// (문법 오류가 있으면 화면 전체가 비어 버린다)
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = fileURLToPath(new URL("../public/js", import.meta.url));

function scripts(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? scripts(join(dir, entry.name)) : entry.name.endsWith(".js") ? [join(dir, entry.name)] : [],
  );
}

describe("화면 스크립트 문법", () => {
  for (const file of scripts(root)) {
    it(file.slice(root.length + 1), () => {
      assert.doesNotThrow(() => execFileSync(process.execPath, ["--check", file], { stdio: "pipe" }));
    });
  }
});
