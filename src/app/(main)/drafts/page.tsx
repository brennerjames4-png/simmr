import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getDrafts } from "@/queries/inspiration";
import { DraftCard } from "@/components/inspiration/draft-card";
import { ArrowLeft, FileText } from "lucide-react";

export const metadata = {
  title: "My Drafts",
};

export default async function DraftsPage() {
  const user = await requireAuth();
  const drafts = await getDrafts(user.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/feed"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to feed
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">
          My Drafts{" "}
          {drafts.length > 0 && (
            <span className="text-muted-foreground font-normal text-lg">
              ({drafts.length})
            </span>
          )}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          AI-generated recipes waiting to be cooked and published
        </p>
      </div>

      {drafts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
            <FileText className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">No drafts yet</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Use the ✨ button on the feed to get inspired and save recipes as
            drafts.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {drafts.map((draft) => (
            <DraftCard key={draft.id} draft={draft} />
          ))}
        </div>
      )}
    </div>
  );
}
