import "fake-indexeddb/auto";
import { afterEach, beforeEach } from "vitest";
import { db } from "@/platform/product/store";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterEach(async () => {
  db.close();
});
