import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  validateBio,
  validateEmail,
  validateNickname,
  validatePassword,
  validatePasswordConfirm,
} from "../shared/validation.js";

describe("회원 입력 검증", () => {
  it("닉네임: 2~15자, 한글·영문·숫자·밑줄", () => {
    assert.equal(validateNickname("개미"), null);
    assert.equal(validateNickname("value_investor1"), null);
    assert.ok(validateNickname("a"));
    assert.ok(validateNickname("a".repeat(16)));
    assert.ok(validateNickname("<script>"));
    assert.ok(validateNickname("공 백"));
  });

  it("이메일 형식", () => {
    assert.equal(validateEmail(" me@example.com "), null);
    assert.ok(validateEmail(""));
    assert.ok(validateEmail("me@example"));
  });

  it("비밀번호: 8자 이상, 영문과 숫자", () => {
    assert.equal(validatePassword("abcd1234"), null);
    assert.ok(validatePassword("abc123"));
    assert.ok(validatePassword("abcdefgh"));
    assert.ok(validatePassword("12345678"));
    assert.equal(validatePasswordConfirm("abcd1234", "abcd1234"), null);
    assert.ok(validatePasswordConfirm("abcd1234", "abcd1235"));
  });

  it("소개 200자", () => {
    assert.equal(validateBio("a".repeat(200)), null);
    assert.ok(validateBio("a".repeat(201)));
  });
});
