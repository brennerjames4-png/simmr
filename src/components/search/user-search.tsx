"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { searchUsers } from "@/actions/user";
import type { SearchUser } from "@/queries/users";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Search, X, Loader2 } from "lucide-react";

export function UserSearch({ onNavigate }: { onNavigate?: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, startSearching] = useTransition();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      startSearching(async () => {
        const data = await searchUsers(query.trim());
        setResults(data);
        setHasSearched(true);
      });
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(username: string) {
    setIsOpen(false);
    setQuery("");
    setResults([]);
    setHasSearched(false);
    onNavigate?.();
    router.push(`/profile/${username}`);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search users..."
          className="pl-9 pr-9"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults([]);
              setHasSearched(false);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Dropdown results */}
      {isOpen && (query.trim() || hasSearched) && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border bg-popover shadow-lg overflow-hidden animate-in fade-in-0 slide-in-from-top-1 duration-150">
          {isSearching && !hasSearched ? (
            <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </div>
          ) : hasSearched && results.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No users found
            </div>
          ) : !query.trim() ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Start typing to search
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {results.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleSelect(user.username)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors"
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    {user.avatarUrl && (
                      <AvatarImage
                        src={user.avatarUrl}
                        alt={user.displayName}
                      />
                    )}
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {user.displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {user.displayName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      @{user.username}
                    </p>
                    {user.bio && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {user.bio.length > 60
                          ? user.bio.slice(0, 60) + "..."
                          : user.bio}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
