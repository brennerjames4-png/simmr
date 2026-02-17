import { UserSearch } from "@/components/search/user-search";

export default function SearchPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Explore</h1>
        <p className="text-sm text-muted-foreground">
          Find cooks and food creators
        </p>
      </div>
      <UserSearch />
    </div>
  );
}
