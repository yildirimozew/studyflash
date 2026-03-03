"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const STATUSES = ["OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const CATEGORIES = [
  "Subscription",
  "Billing",
  "Product - Flashcards",
  "Product - Quiz",
  "Product - Podcast",
  "Product - Upload",
  "Product - Mindmap",
  "Product - Mock Exam",
  "Product - Summary",
  "Account",
  "Technical",
  "General",
];

export function TicketFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.push(`/tickets?${params.toString()}`);
  };

  const clearFilters = () => {
    router.push("/tickets");
  };

  const hasFilters =
    searchParams.has("status") ||
    searchParams.has("priority") ||
    searchParams.has("category") ||
    searchParams.has("search");

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        placeholder="Search tickets..."
        className="w-64"
        defaultValue={searchParams.get("search") || ""}
        onChange={(e) => {
          const val = e.target.value;
          if (val.length === 0 || val.length >= 2) {
            updateParam("search", val || null);
          }
        }}
      />

      <Select
        value={searchParams.get("status") || "all"}
        onValueChange={(v) => updateParam("status", v)}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {s.replace("_", " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("priority") || "all"}
        onValueChange={(v) => updateParam("priority", v)}
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All priorities</SelectItem>
          {PRIORITIES.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("category") || "all"}
        onValueChange={(v) => updateParam("category", v)}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {CATEGORIES.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
