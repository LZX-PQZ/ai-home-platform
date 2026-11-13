import Link from "next/link";
export function ModulePage({ title, owner, description, children }: { title: string; owner: string; description: string; children?: React.ReactNode }) {
 return <><span className="badge">负责人 {owner} · 模拟数据 / 待开发</span><h1>{title}</h1><p>{description}</p>{children}<section className="card"><h2>本模块开工</h2><p>按 docs/tasks/{owner}.md 开发；共享字段从 src/contracts 引入。</p><Link href="/">返回工作台</Link></section></>;
}
