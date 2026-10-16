import {db as productDb} from "../../../../platform/product/store";
import type {ProductStore} from "../../../../platform/storage/types";
import type {McpCatalogue} from "../models/connection";
import {readMcpCatalogueRecord} from "../runtime/records";

/** Strict read; unavailable/corrupt is not an empty catalogue. */
export function getMcpCatalogue(store: ProductStore = productDb): Promise<McpCatalogue> {
    return store.transaction("r", ["deviceSettings"], tx => readMcpCatalogueRecord(tx));
}
