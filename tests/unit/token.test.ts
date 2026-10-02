import { beforeEach, describe, expect, it, vi } from "vitest";

const execFileSync = vi.fn();
vi.mock("node:child_process", () => ({ execFileSync: (...args: unknown[]) => execFileSync(...args) }));

// @ts-expect-error plain ESM script without types
const { cliToken, findToken } = await import("../../scripts/token.mjs");

// In braces: a function returned from beforeEach is run as the test's cleanup, and mockReset returns the mock.
beforeEach(() => {
  execFileSync.mockReset();
});

describe("cliToken", () => {
  it("is the GitHub CLI's sign-in, trimmed", () => {
    execFileSync.mockReturnValue("gho_abc\n");
    expect(cliToken()).toBe("gho_abc");
    expect(execFileSync).toHaveBeenCalledWith("gh", ["auth", "token"], expect.objectContaining({ encoding: "utf8" }));
  });
  it("is null when the CLI prints nothing, is missing or is signed out", () => {
    execFileSync.mockReturnValue("  \n");
    expect(cliToken()).toBeNull();
    execFileSync.mockImplementation(() => {
      throw new Error("gh: not found");
    });
    expect(cliToken()).toBeNull();
  });
});

describe("findToken", () => {
  const noCli = () => null;
  it("takes the first variable that is set, in the order given", () => {
    expect(findToken(["A", "B"], { A: "", B: "b-token" }, noCli)).toEqual({ token: "b-token", from: "B" });
    expect(findToken(["A", "B"], { A: "a-token", B: "b-token" }, noCli)).toEqual({ token: "a-token", from: "A" });
  });
  it("falls back to the CLI's sign-in, and to nothing", () => {
    expect(findToken(["A"], {}, () => "cli-token")).toEqual({ token: "cli-token", from: "the GitHub CLI" });
    expect(findToken(["A"], {}, noCli)).toBeNull();
  });
  it("reads the real environment and the real CLI when not told otherwise", () => {
    execFileSync.mockReturnValue("from-cli");
    expect(findToken(["PORTFOLIO_TEST_UNSET_VARIABLE"])).toEqual({ token: "from-cli", from: "the GitHub CLI" });
  });
});
