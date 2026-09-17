import { createFileRoute } from "@tanstack/react-router";
import { CharacterDetailPage } from "@/components/assets/CharacterDetailPage";

export const Route = createFileRoute("/_studio/characters/$characterId")({
  component: CharacterStudioRoute,
});

function CharacterStudioRoute() {
  const { characterId } = Route.useParams();
  return <CharacterDetailPage characterId={characterId} back={{ kind: "studio" }} />;
}
