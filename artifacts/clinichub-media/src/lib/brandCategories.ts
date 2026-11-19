/** Friday v1.2 §6 shared category keys, via Birch's same-origin /v1/brand-categories (static contract copy first). */
import { useEffect, useState } from "react";
import { FRIDAY_CATEGORIES } from "../../../api-server/src/lib/kitCalc/fridayV12";

type Cat = { key: string; label: string };
let cache: Cat[] | null = null;
export function useBrandCategories(): Cat[] {
  const [cats, setCats] = useState<Cat[]>(cache ?? [...FRIDAY_CATEGORIES]);
  useEffect(() => {
    if (cache) return;
    fetch("/v1/brand-categories")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { categories?: Cat[] } | null) => {
        const list = d?.categories?.filter((c) => c && typeof c.key === "string" && typeof c.label === "string");
        if (list?.length) (cache = list), setCats(list);
      })
      .catch(() => undefined);
  }, []);
  return cats;
}
