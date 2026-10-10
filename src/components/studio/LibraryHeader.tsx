import {Search} from "lucide-react";
import type {ReactNode} from "react";
import {Input} from "@/components/ui/input";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "@/components/ui/select";
import type {LibrarySort} from "@/lib/library";
import {PageHeader, PageToolbar} from "@/components/layout/PageLayout";

export function LibraryHeader({
                                  title,
                                  query,
                                  onQuery,
                                  sort,
                                  onSort,
                                  extra,
                                  description,
                              }: {
    title: string;
    query: string;
    onQuery: (value: string) => void;
    sort: LibrarySort;
    onSort: (value: LibrarySort) => void;
    extra?: ReactNode;
    description?: ReactNode;
}) {
    return (
        <>
            <PageHeader title={title} description={description} actions={extra}/>
            <PageToolbar className="library-header-toolbar">
                <Select value={sort} onValueChange={(value) => onSort(value as LibrarySort)}>
                    <SelectTrigger aria-label="排序方式" className="min-w-28">
                        <SelectValue placeholder="排序"/>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="updated">按修改</SelectItem>
                        <SelectItem value="created">按创建</SelectItem>
                        <SelectItem value="name">按名称</SelectItem>
                    </SelectContent>
                </Select>
                <div className="library-search relative order-first">
                    <Search
                        className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"/>
                    <Input
                        value={query}
                        onChange={(event) => onQuery(event.target.value)}
                        placeholder="搜索…"
                        aria-label={`搜索${title}`}
                        className="pl-8 text-sm"
                    />
                </div>
            </PageToolbar>
        </>
    );
}
