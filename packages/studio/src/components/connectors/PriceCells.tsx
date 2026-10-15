import {formatPrice} from "../../lib/ai/modelCatalog/format";
import type {CatalogCost} from "../../lib/ai/modelCatalog/types";

const PRICE_LABELS = ["输入", "输出", "缓存命中", "缓存创建"] as const;

/** Four USD / 1M-token prices; an unknown price is a dash, never "$0". */
export function PriceCells({cost}: { cost?: CatalogCost }) {
    const values = [cost?.input, cost?.output, cost?.cacheRead, cost?.cacheWrite];
    return <>{values.map((value, index) => (
        <span key={PRICE_LABELS[index]} className="text-right text-xs tabular-nums"
              aria-label={`${PRICE_LABELS[index]}价格 ${formatPrice(value)}`}>
            {formatPrice(value)}
        </span>
    ))}</>;
}

export function PriceHeader() {
    return <>{PRICE_LABELS.map(label => <span key={label} className="text-right">{label}</span>)}</>;
}
