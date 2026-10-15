import {browserDatabase} from "@/platform/storage/browserDatabase";
if (!browserDatabase) throw new Error("Original source fixtures require the explicit browser adapter");
export const db=browserDatabase;
