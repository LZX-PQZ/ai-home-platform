import { notFound } from "next/navigation";
import { MatchResults } from "@/features/b/MatchResults";
import { loadMatchData } from "@/lib/match/data";

export default function Page({ params }: { params: { id: string } }) {
  const data = loadMatchData(params.id);
  if (!data) notFound();
  return <MatchResults data={data} />;
}
