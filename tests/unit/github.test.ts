import { describe, expect, it, vi } from "vitest";
// @ts-expect-error plain ESM script without types
import { GitHubError, listRepositories } from "../../scripts/github.mjs";
// @ts-expect-error plain ESM script without types
import { METADATA_PATH } from "../../scripts/schema.mjs";

const node = (name: string, extra: object = {}) => ({
  name,
  isPrivate: false,
  isArchived: false,
  description: `${name} does a thing`,
  url: `https://github.com/tochi-mba/${name}`,
  createdAt: "2024-02-03T04:05:06Z",
  primaryLanguage: { name: "Python" },
  metadata: { text: `{"slug":"${name.toLowerCase()}"}` },
  ...extra,
});

const page = (nodes: object[], endCursor: string | null) =>
  new Response(
    JSON.stringify({
      data: { repositoryOwner: { repositories: { pageInfo: { hasNextPage: endCursor !== null, endCursor }, nodes } } },
    }),
    { status: 200 },
  );

const options = (fetcher: unknown) => ({ owner: "tochi-mba", token: "t0ken", fetcher, wait: async () => {} });

describe("listRepositories", () => {
  it("reads every page and shapes each repository", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(page([node("Alpha")], "cursor-1"))
      .mockResolvedValueOnce(
        page([node("Beta", { isPrivate: true, metadata: null, primaryLanguage: null, description: null })], null),
      );
    const repos = await listRepositories(options(fetcher));
    expect(repos).toEqual([
      {
        name: "Alpha",
        private: false,
        archived: false,
        description: "Alpha does a thing",
        url: "https://github.com/tochi-mba/Alpha",
        language: "Python",
        year: 2024,
        metadata: '{"slug":"alpha"}',
      },
      {
        name: "Beta",
        private: true,
        archived: false,
        description: "",
        url: "https://github.com/tochi-mba/Beta",
        language: null,
        year: 2024,
        metadata: null,
      },
    ]);
    const [, second] = fetcher.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(second.body as string).variables).toEqual({ owner: "tochi-mba", cursor: "cursor-1" });
  });
  it("asks for the metadata file in the same request and authenticates with the token", async () => {
    const fetcher = vi.fn().mockResolvedValue(page([], null));
    await listRepositories(options(fetcher));
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.github.com/graphql");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer t0ken");
    expect(JSON.parse(init.body as string).query).toContain(`HEAD:${METADATA_PATH}`);
  });
  it("asks again after a dropped connection, a server error or a timeout inside GitHub", async () => {
    const wait = vi.fn(async () => {});
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response("busy", { status: 502 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ errors: [{ message: "timedout" }] }), { status: 200 }))
      .mockResolvedValueOnce(page([node("Alpha")], null));
    const repos = await listRepositories({ ...options(fetcher), wait });
    expect(repos).toHaveLength(1);
    expect(wait.mock.calls.map((c) => (c as unknown as [number])[0])).toEqual([1000, 2000, 4000]);
  });
  it("gives up after the last attempt and says what went wrong", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("down", { status: 503 }));
    await expect(listRepositories({ ...options(fetcher), attempts: 2 })).rejects.toThrow(
      /after 2 attempts: GitHub answered 503/,
    );
    const offline = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    await expect(listRepositories({ ...options(offline), attempts: 1 })).rejects.toThrow(
      /did not complete \(fetch failed\)/,
    );
  });
  it("does not ask again when the token is refused or the account does not exist", async () => {
    const refused = vi.fn().mockResolvedValue(new Response("no", { status: 401 }));
    await expect(listRepositories(options(refused))).rejects.toBeInstanceOf(GitHubError);
    expect(refused).toHaveBeenCalledTimes(1);
    const nobody = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { repositoryOwner: null } })));
    await expect(listRepositories(options(nobody))).rejects.toThrow(/no account named tochi-mba/);
    expect(nobody).toHaveBeenCalledTimes(1);
  });
});
