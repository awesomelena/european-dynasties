export type WikiSummary = {
  extract: string;
  thumbnail?: string;
  url: string;
};

const cache = new Map<string, Promise<WikiSummary | null>>();

export function fetchSummary(title: string): Promise<WikiSummary | null> {
  let pending = cache.get(title);
  if (pending === undefined) {
    pending = fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
    )
      .then((response) => (response.ok ? response.json() : null))
      .then((json) =>
        json === null
          ? null
          : {
              extract: json.extract,
              thumbnail: json.thumbnail?.source,
              url: json.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${title}`,
            }
      )
      .catch(() => null);
    cache.set(title, pending);
  }
  return pending;
}