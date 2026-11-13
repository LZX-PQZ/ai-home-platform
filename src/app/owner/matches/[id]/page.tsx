import { ModulePage } from "@/components/ui/ModulePage";
import { ProviderCard } from "@/components/ProviderCard";
import { providers } from "@/lib/mock-data";
export default function Page() { return <ModulePage title="服务方匹配" owner="B" description="固定样例数据；按实际需求检索与交互由 B 实现。">{providers.filter(p=>p.city==="深圳"&&p.kind==="construction").map(p=><ProviderCard key={p.id} provider={p}/>)}</ModulePage>; }
