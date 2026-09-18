import { expect, it } from "vitest";
import { db } from "@/db/database";
import { addCharacter, patchCharacter, setCharacterSlot } from "@/db/repo";
import { STUDIO_LIBRARY_ID } from "@/domain/types";
import { emptySlot } from "@/domain/slot";

// Audit characterization: these assertions expose current behavior, not desired contracts.
it("demonstrates overlapping independent character patches lose one field", async () => {
  const asset = await addCharacter(STUDIO_LIBRARY_ID);
  await Promise.all([
    patchCharacter(asset.id, { name: "New name" }),
    patchCharacter(asset.id, { bio: "New bio" }),
  ]);
  const saved = await db.characters.get(asset.id);
  expect(saved?.bio).toBe("New bio");
  expect(saved?.name).toBe(asset.name);
});

it("demonstrates overlapping character slot writes lose the other slot", async () => {
  const asset = await addCharacter(STUDIO_LIBRARY_ID);
  await Promise.all([
    setCharacterSlot(asset.id, "front", { ...emptySlot(), prompt: "Front" }),
    setCharacterSlot(asset.id, "side", { ...emptySlot(), prompt: "Side" }),
  ]);
  const saved = await db.characters.get(asset.id);
  expect(saved?.slots.side?.prompt).toBe("Side");
  expect(saved?.slots.front?.prompt).not.toBe("Front");
});
