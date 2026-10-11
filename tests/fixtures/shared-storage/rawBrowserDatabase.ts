import {browserDatabase} from "@/lib/storage/browserDatabase";
if (!browserDatabase) throw new Error("Original source fixtures require the explicit browser adapter");
export const db=browserDatabase;
