import { describe, expect, it, vi } from "vitest";
import {
  linkCandidates,
  listingSets,
  ownedRepository,
  ownedSite,
  pointsAtPrivate,
  publicLinks,
  reach,
  reachAll,
  repoSets,
  urlsIn,
  // @ts-expect-error plain ESM script without types
} from "../../scripts/links.mjs";

const OWNER = "tochi-mba";
const seen = { publicRepos: new Set(["open"]), privateRepos: new Set(["secret"]) };

describe("ownedRepository", () => {
  it("reads the repository out of every GitHub address that names one", () => {
    expect(ownedRepository("https://github.com/tochi-mba/Open", OWNER)).toBe("open");
    expect(ownedRepository("https://www.github.com/Tochi-Mba/open/blob/main/x.md", OWNER)).toBe("open");
    expect(ownedRepository("https://github.com/tochi-mba/open.git", OWNER)).toBe("open");
    expect(ownedRepository("https://raw.githubusercontent.com/tochi-mba/open/main/x", OWNER)).toBe("open");
    expect(ownedRepository("https://codeload.github.com/tochi-mba/open/zip/main", OWNER)).toBe("open");
    expect(ownedRepository("https://api.github.com/repos/tochi-mba/open/releases", OWNER)).toBe("open");
  });
  it("is null for someone else's repository, the owner's profile, other sites and nonsense", () => {
    expect(ownedRepository("https://github.com/vuejs/core", OWNER)).toBeNull();
    expect(ownedRepository("https://github.com/tochi-mba", OWNER)).toBeNull();
    expect(ownedRepository("https://api.github.com/users/tochi-mba", OWNER)).toBeNull();
    expect(ownedRepository("https://example.com/tochi-mba/open", OWNER)).toBeNull();
    expect(ownedRepository("not a url", OWNER)).toBeNull();
  });
});

describe("ownedSite", () => {
  it("reads the first path segment of the owner's Pages domain", () => {
    expect(ownedSite("https://tochi-mba.github.io/Secret/", OWNER)).toBe("secret");
    expect(ownedSite("https://TOCHI-MBA.github.io/a/b", OWNER)).toBe("a");
  });
  it("is null for the site root, other domains and nonsense", () => {
    expect(ownedSite("https://tochi-mba.github.io/", OWNER)).toBeNull();
    expect(ownedSite("https://someone.github.io/x/", OWNER)).toBeNull();
    expect(ownedSite("::", OWNER)).toBeNull();
  });
});

describe("pointsAtPrivate", () => {
  it("refuses any repository not known to be public, because not seeing one proves nothing", () => {
    expect(pointsAtPrivate("https://github.com/tochi-mba/secret", OWNER, seen)).toBe(true);
    expect(pointsAtPrivate("https://github.com/tochi-mba/never-heard-of", OWNER, seen)).toBe(true);
    expect(pointsAtPrivate("https://github.com/tochi-mba/open", OWNER, seen)).toBe(false);
  });
  it("refuses a Pages address only when its name is known to be private", () => {
    expect(pointsAtPrivate("https://tochi-mba.github.io/secret/", OWNER, seen)).toBe(true);
    expect(pointsAtPrivate("https://tochi-mba.github.io/work/", OWNER, seen)).toBe(false);
  });
  it("lets everything else through", () => {
    expect(pointsAtPrivate("https://pypi.org/project/weftai/", OWNER, seen)).toBe(false);
  });
});

describe("repoSets and listingSets", () => {
  const snapshot = {
    owner: OWNER,
    projects: [
      { visibility: "public", repo: "Open" },
      { visibility: "private", slug: "anonymous" },
    ],
  };
  it("vouches for the public repositories a snapshot publishes, and the portfolio itself", () => {
    const sets = repoSets(snapshot);
    expect([...sets.publicRepos].sort()).toEqual(["open", "tochi-mba.github.io"]);
    expect(sets.privateRepos.size).toBe(0);
  });
  it("knows both kinds from a listing", () => {
    const sets = listingSets([
      { name: "Open", private: false },
      { name: "Secret", private: true },
    ]);
    expect([...sets.publicRepos]).toEqual(["open"]);
    expect([...sets.privateRepos]).toEqual(["secret"]);
  });
});

describe("publicLinks", () => {
  it("keeps only links a visitor can open: not private, not known dead", () => {
    const links = {
      source: "https://github.com/tochi-mba/secret",
      site: "https://example.com/gone",
      package: "https://pypi.org/project/x/",
    };
    expect(publicLinks(links, OWNER, seen, new Set(["https://example.com/gone"]))).toEqual({
      package: "https://pypi.org/project/x/",
    });
    expect(publicLinks({ site: "https://example.com/" }, OWNER, seen)).toEqual({ site: "https://example.com/" });
  });
});

describe("urlsIn and linkCandidates", () => {
  it("finds every address in prose, stopping at brackets and quotes", () => {
    expect(urlsIn('See (https://a.example/x) and "https://b.example/y". Not http:/c.')).toEqual([
      "https://a.example/x",
      "https://b.example/y",
    ]);
    expect(urlsIn("nothing here")).toEqual([]);
  });
  it("lists each safe link once, sorted", () => {
    const snapshot = {
      owner: OWNER,
      projects: [
        {
          visibility: "public",
          repo: "Open",
          links: { source: "https://github.com/tochi-mba/Open", site: "https://z.example/" },
        },
        {
          visibility: "private",
          links: { package: "https://z.example/", source: "https://github.com/tochi-mba/Hidden" },
        },
      ],
    };
    expect(linkCandidates(snapshot)).toEqual(["https://github.com/tochi-mba/Open", "https://z.example/"]);
  });
});

describe("reach", () => {
  const answer = (status: number) => async () => new Response(null, { status });
  it("is ok for a page that answers, and dead only for one that is clearly gone", async () => {
    expect(await reach("https://x", answer(200))).toBe("ok");
    expect(await reach("https://x", answer(404))).toBe("dead");
    expect(await reach("https://x", answer(410))).toBe("dead");
  });
  it("is unknown for anything that says nothing about what a visitor would see", async () => {
    expect(await reach("https://x", answer(503))).toBe("unknown");
    expect(await reach("https://x", answer(403))).toBe("unknown");
    const timeout = async () => {
      throw new DOMException("timed out", "TimeoutError");
    };
    expect(await reach("https://x", timeout)).toBe("unknown");
  });
  it("is dead when the host does not exist at all", async () => {
    const noHost = async () => {
      throw new TypeError("fetch failed", { cause: { code: "ENOTFOUND" } });
    };
    expect(await reach("https://x", noHost)).toBe("dead");
  });
  it("asks as a stranger, following redirects, and does not download the page", async () => {
    const cancel = vi.fn();
    const fetcher = vi.fn(async () => ({ status: 200, ok: true, body: { cancel } }) as unknown as Response);
    await reach("https://x", fetcher);
    const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(init).toMatchObject({ method: "GET", redirect: "follow" });
    expect(JSON.stringify(init.headers)).not.toMatch(/authorization/i);
    expect(cancel).toHaveBeenCalled();
  });
});

describe("reachAll", () => {
  it("asks once per distinct address, a few at a time", async () => {
    let inFlight = 0;
    let most = 0;
    const fetcher = vi.fn(async (url: string) => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return new Response(null, { status: url.endsWith("gone") ? 404 : 200 });
    });
    const urls = Array.from({ length: 10 }, (_, i) => `https://x/${i}`);
    const results = await reachAll([...urls, "https://x/0", "https://x/gone"], fetcher, 3);
    expect(fetcher).toHaveBeenCalledTimes(11);
    expect(most).toBeLessThanOrEqual(3);
    expect(results.get("https://x/gone")).toBe("dead");
    expect(results.get("https://x/9")).toBe("ok");
  });
  it("asks nothing for nothing", async () => {
    const fetcher = vi.fn();
    expect((await reachAll([], fetcher)).size).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
