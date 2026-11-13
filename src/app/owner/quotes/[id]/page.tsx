import { notFound } from "next/navigation";
import { QuoteComparison } from "@/features/b/QuoteComparison";
import { loadQuoteData } from "@/lib/quote-engine/data";

export default function Page({ params }: { params: { id: string } }) {
  const data = loadQuoteData(params.id);
  if (!data) notFound();
  return <QuoteComparison data={data} />;
}
