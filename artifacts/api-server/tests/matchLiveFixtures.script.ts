import fx from "./fixtures/match-urls.json";
import { fetchSiteSignals } from "../src/lib/overhaul/fetchSite";
import { scoreMatch } from "../src/lib/overhaul/audienceMatch";
const out:any[]=[];
for (const f of fx as any[]) {
  const s = await fetchSiteSignals(f.url);
  const r = scoreMatch(s, f.blurb);
  out.push({url:f.url,expect:f.expect,fetched:s.fetched,note:s.fetchNote??null,title:s.title.slice(0,60),score:r.score,label:r.label,type:r.businessType,rec:r.recommended.product,top:r.topCategories.map(c=>c.label+":"+c.strength).join(", ")});
  console.log(JSON.stringify(out.at(-1)));
}
const fs = await import("node:fs"); fs.writeFileSync("/tmp/match-scores.json", JSON.stringify(out,null,1));
