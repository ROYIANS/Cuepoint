import {useMemo, useState} from "react";
import {Input} from "@/components/ui/input";
import type {CatalogEntry} from "@/lib/ai/modelCatalog/types";
import {PriceCells, PriceHeader} from "./PriceCells";
import {VirtualRows} from "./VirtualRows";

const TABLE_GRID = "grid grid-cols-[minmax(0,1fr)_88px_repeat(4,56px)] items-center gap-2";

/** Read-only raw prices of the loaded catalog (no original-vendor "reference" labelling: these are the entries themselves). */
export function ModelPriceTable({entries}: { entries: readonly CatalogEntry[] }) {
    const [provider, setProvider] = useState("");
    const [search, setSearch] = useState("");
    const providers = useMemo(() => [...new Set(entries.map(entry => entry.provider))].sort(), [entries]);
    const visible = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return entries.filter(entry => (!provider || entry.provider === provider) &&
            (!needle || entry.name.toLowerCase().includes(needle) || entry.id.toLowerCase().includes(needle)));
    }, [entries, provider, search]);
    return (
        <section aria-labelledby="model-price-table" className="mt-8">
            <h2 id="model-price-table" className="text-base font-semibold">模型定价</h2>
            <p className="text-muted-foreground mt-1 text-sm">单位：USD / 每百万 Tokens。"—" 表示价格未知，并非免费。</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
                <Input className="min-w-40 flex-1" value={search} placeholder="搜索模型名称或 ID"
                       aria-label="搜索定价表"
                       onChange={event => setSearch(event.target.value)}/>
                <select className="border-input h-9 max-w-44 rounded-md border bg-transparent px-2 text-sm"
                        value={provider}
                        aria-label="按供应商筛选定价" onChange={event => setProvider(event.target.value)}>
                    <option value="">全部供应商</option>
                    {providers.map(id => <option key={id} value={id}>{id}</option>)}
                </select>
            </div>
            <div className={`${TABLE_GRID} text-muted-foreground mt-3 px-3 text-xs`} aria-hidden>
                <span>模型</span><span>供应商</span><PriceHeader/>
            </div>
            {visible.length ? <VirtualRows count={visible.length} rowHeight={48} viewportHeight={384} label="模型定价"
                                           renderRow={position => {
                                               const entry = visible[position];
                                               return (
                                                   <div className={`${TABLE_GRID} h-full px-3`}>
                            <span className="min-w-0">
                                <span className="block truncate text-sm">{entry.name}</span>
                                <span
                                    className="text-muted-foreground block truncate font-mono text-xs">{entry.id}</span>
                            </span>
                                                       <span className="truncate text-xs">{entry.provider}</span>
                                                       <PriceCells cost={entry.cost}/>
                                                   </div>
                                               );
                                           }}/> :
                <p className="text-muted-foreground py-8 text-center text-sm">没有匹配的模型</p>}
        </section>
    );
}
