import type { ProviderDTO } from "@/contracts";
export function ProviderCard({provider}:{provider:ProviderDTO}) { return <section className="card"><h2>{provider.name}</h2><p>{provider.city} · 样例评分 {provider.rating} · {provider.tags.join(" / ")}</p></section>; }
