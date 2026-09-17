import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LibrarySort } from "@/lib/library";

export function LibraryHeader({
  title,
  query,
  onQuery,
  sort,
  onSort,
  extra,
}: {
  title: string;
  query: string;
  onQuery: (value: string) => void;
  sort: LibrarySort;
  onSort: (value: LibrarySort) => void;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[28px] leading-none tracking-tight">{title}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={sort} onValueChange={(value) => onSort(value as LibrarySort)}>
          <SelectTrigger size="sm" className="bg-card min-w-28">
            <SelectValue placeholder="排序" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">按修改</SelectItem>
            <SelectItem value="created">按创建</SelectItem>
            <SelectItem value="name">按名称</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="搜索…"
            className="bg-card h-8 w-52 pl-8 text-sm"
          />
        </div>
        {extra}
      </div>
    </div>
  );
}
