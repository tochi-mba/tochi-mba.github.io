// Lists every repository the owner has that the token can see, each with the text of its
// `.portfolio/project.json`, in one GraphQL request per page: a sync of fifty repositories is three
// requests, not a hundred. Works with the owner's own token (private repositories included) and with
// the token a workflow is given by default (public repositories only).
import { setTimeout as sleep } from "node:timers/promises";
import { METADATA_PATH } from "./schema.mjs";

const QUERY = `
query($owner: String!, $cursor: String) {
  repositoryOwner(login: $owner) {
    repositories(first: 25, after: $cursor, ownerAffiliations: OWNER, orderBy: { field: NAME, direction: ASC }) {
      pageInfo { hasNextPage endCursor }
      nodes {
        name
        isPrivate
        isArchived
        description
        url
        createdAt
        primaryLanguage { name }
        metadata: object(expression: "HEAD:${METADATA_PATH}") { ... on Blob { text } }
      }
    }
  }
}`;

/** A failure that asking again will not fix: the token is wrong, or the account does not exist. */
export class GitHubError extends Error {}

async function page({ owner, cursor, token, fetcher, attempts, wait }) {
  let failure = "";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (attempt > 1) await wait(1000 * 2 ** (attempt - 2));
    let res;
    try {
      res = await fetcher("https://api.github.com/graphql", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: QUERY, variables: { owner, cursor } }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (error) {
      failure = `the request did not complete (${error.message})`;
      continue;
    }
    if (res.status === 401 || res.status === 403) {
      throw new GitHubError(`GitHub refused the token (${res.status}); check that it has not expired`);
    }
    if (!res.ok) {
      failure = `GitHub answered ${res.status}`;
      continue;
    }
    const body = await res.json();
    // A timeout inside GitHub arrives as a 200 with errors; it is worth asking again.
    if (body.errors?.length) {
      failure = body.errors.map((e) => e.message).join("; ");
      continue;
    }
    if (!body.data?.repositoryOwner) throw new GitHubError(`GitHub has no account named ${owner}`);
    return body.data.repositoryOwner.repositories;
  }
  throw new GitHubError(`could not list repositories after ${attempts} attempts: ${failure}`);
}

/**
 * Every repository `owner` has that the token can see, in name order, each with the text of its
 * metadata file or null. A request that fails for a reason asking again could fix (a dropped
 * connection, a 5xx, a timeout inside GitHub) is retried with backoff; one that cannot is not.
 */
export async function listRepositories({ owner, token, fetcher = fetch, attempts = 4, wait = sleep }) {
  const repositories = [];
  let cursor = null;
  do {
    const connection = await page({ owner, cursor, token, fetcher, attempts, wait });
    for (const n of connection.nodes) {
      repositories.push({
        name: n.name,
        private: n.isPrivate,
        archived: n.isArchived,
        description: n.description ?? "",
        url: n.url,
        language: n.primaryLanguage?.name ?? null,
        year: new Date(n.createdAt).getUTCFullYear(),
        metadata: n.metadata?.text ?? null,
      });
    }
    cursor = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null;
  } while (cursor !== null);
  return repositories;
}
