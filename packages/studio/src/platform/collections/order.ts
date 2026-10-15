import type {Id} from "./../identity";

export function assertCompleteOrder(actualIds: Id[], orderedIds: Id[]): void {
    if (
        orderedIds.length !== actualIds.length ||
        new Set(orderedIds).size !== orderedIds.length ||
        actualIds.some((id) => !orderedIds.includes(id))
    ) {
        throw new Error("排序列表必须包含同一范围内的全部且唯一记录");
    }
}
