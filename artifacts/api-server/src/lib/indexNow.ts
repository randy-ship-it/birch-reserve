/**
 * IndexNow (https://www.indexnow.org/documentation) for birchreserve.net.
 *
 * The key is a public verification token: IndexNow requires it to be fetchable
 * at `{key}.txt` on the host. It is not a secret.
 *
 * Notify only ever submits INDEXNOW_URL_LIST. Callers cannot add URLs.
 */
export const INDEXNOW_HOST = "birchreserve.net";
export const INDEXNOW_KEY = "83e5e0807e991d5343be4f3044fa6da9";
export const INDEXNOW_KEY_LOCATION = `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`;
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

export const INDEXNOW_URL_LIST = [
  `https://${INDEXNOW_HOST}/`,
  `https://${INDEXNOW_HOST}/terms`,
  `https://${INDEXNOW_HOST}/privacy`,
  `https://${INDEXNOW_HOST}/sample-io`,
  `https://${INDEXNOW_HOST}/insights`,
  `https://${INDEXNOW_HOST}/insights/the-shelf-after-the-receipt`,
  `https://${INDEXNOW_HOST}/buycalc`,
] as const;

export type IndexNowFetch = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{
  status: number;
  text(): Promise<string>;
}>;

export type IndexNowSubmitResult = {
  ok: boolean;
  status: number;
  body: string;
};

let fetchImpl: IndexNowFetch = (url, init) => fetch(url, init);

export function setIndexNowFetchForTests(fn: IndexNowFetch | null): void {
  fetchImpl = fn ?? ((url, init) => fetch(url, init));
}

export function indexNowPayload(): {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
} {
  return {
    host: INDEXNOW_HOST,
    key: INDEXNOW_KEY,
    keyLocation: INDEXNOW_KEY_LOCATION,
    urlList: [...INDEXNOW_URL_LIST],
  };
}

/** POST the fixed allowlist. 200 and 202 are success; other statuses are not. */
export async function submitIndexNow(): Promise<IndexNowSubmitResult> {
  const response = await fetchImpl(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(indexNowPayload()),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.text();
  return {
    ok: response.status === 200 || response.status === 202,
    status: response.status,
    body,
  };
}
