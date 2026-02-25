import { db } from "@/lib/db";
import { corpusAnalytics } from "@/lib/db/schema";
import { sql, gte } from "drizzle-orm";

export async function getCorpusHitRates(days: number = 30): Promise<
  {
    endpoint: string;
    total: number;
    corpusHits: number;
    apiCalls: number;
    hitRate: number;
  }[]
> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const results = await db
    .select({
      endpoint: corpusAnalytics.endpoint,
      total: sql<number>`count(*)::int`,
      corpusHits: sql<number>`count(*) filter (where ${corpusAnalytics.servedFrom} = 'corpus')::int`,
      apiCalls: sql<number>`count(*) filter (where ${corpusAnalytics.servedFrom} = 'api')::int`,
    })
    .from(corpusAnalytics)
    .where(gte(corpusAnalytics.createdAt, since))
    .groupBy(corpusAnalytics.endpoint);

  return results.map((r) => ({
    endpoint: r.endpoint,
    total: r.total,
    corpusHits: r.corpusHits,
    apiCalls: r.apiCalls,
    hitRate: r.total > 0 ? Math.round((r.corpusHits / r.total) * 100) : 0,
  }));
}
