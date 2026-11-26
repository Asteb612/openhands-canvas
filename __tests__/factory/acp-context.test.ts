import { describe, expect, it } from "vitest";
import { parseAcpContext } from "#/factory/acp-context";

describe("parseAcpContext", () => {
  it("reads the relay's context fill", () => {
    expect(parseAcpContext('{"used":412000,"size":1000000,"at":"x"}')).toEqual({
      used: 412000,
      size: 1000000,
    });
  });
  it("rejects malformed or empty files", () => {
    expect(parseAcpContext("not json")).toBeNull();
    expect(parseAcpContext('{"used":1,"size":0}')).toBeNull();
    expect(parseAcpContext('{"used":"1","size":10}')).toBeNull();
  });
});
