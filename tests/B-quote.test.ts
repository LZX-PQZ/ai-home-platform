import test from "node:test";
import assert from "node:assert/strict";
import { quotes, demoDemand, providers } from "../src/lib/mock-data";
import { summarizeQuote } from "../src/lib/quote-engine";
import { matchProviders } from "../src/lib/match";
test("汇总已知费用并保留待确认项目",()=>{assert.deepEqual(summarizeQuote(quotes[0]),{knownTotalCents:1200000,pendingItems:["垃圾清运"]});});
test("施工匹配不混入异地或材料供应商",()=>{const result=matchProviders(demoDemand,providers);assert.equal(result.length,2);assert.ok(result.every(r=>r.provider.city==="深圳"&&r.provider.kind==="construction"));});
