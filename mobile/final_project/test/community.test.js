import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { boardLabel, cleanSearchTerm, isBoardId } from "../shared/boards.js";
import { formatRelativeTime } from "../shared/format.js";
import { validateComment, validatePostBody, validatePostTitle } from "../shared/validation.js";

describe("게시판", () => {
  it("게시판 종류", () => {
    assert.ok(isBoardId("kr"));
    assert.ok(!isBoardId("sns"));
    assert.ok(!isBoardId("x"));
    assert.equal(boardLabel("economy"), "경제");
    assert.equal(boardLabel("sns"), "피드");
  });

  it("검색어에서 필터 문법 문자를 지운다", () => {
    assert.equal(cleanSearchTerm(" 삼성,전자 "), "삼성 전자");
    assert.equal(cleanSearchTerm("a%b_c(d)*e"), "a b c d e");
    assert.equal(cleanSearchTerm("title.ilike.x"), "title ilike x");
    assert.equal(cleanSearchTerm("x".repeat(80)).length, 50);
  });

  it("글·댓글 길이 (DB 제약과 같은 기준)", () => {
    assert.equal(validatePostTitle(" 제목 "), null);
    assert.ok(validatePostTitle("   "));
    assert.ok(validatePostTitle("가".repeat(101)));
    assert.equal(validatePostBody("내용"), null);
    assert.ok(validatePostBody(""));
    assert.ok(validatePostBody("a".repeat(10001)));
    assert.equal(validateComment("좋아요"), null);
    assert.ok(validateComment(" "));
    assert.ok(validateComment("a".repeat(2001)));
  });

  it("작성 시각을 상대 시간으로", () => {
    const now = new Date("2026-10-14T12:00:00Z");
    assert.equal(formatRelativeTime("2026-10-14T11:59:30Z", now), "방금 전");
    assert.equal(formatRelativeTime("2026-10-14T11:55:00Z", now), "5분 전");
    assert.equal(formatRelativeTime("2026-10-14T09:00:00Z", now), "3시간 전");
    assert.equal(formatRelativeTime("2026-10-12T12:00:00Z", now), "2일 전");
    assert.equal(formatRelativeTime("2026-09-01T00:00:00Z", now), "2026. 9. 1.");
  });
});
