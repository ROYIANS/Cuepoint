import { createFileRoute } from "@tanstack/react-router";
import { CharacterDetailPage } from "@/components/assets/CharacterDetailPage";

export const Route = createFileRoute("/p/$projectId/assets/characters/$characterId")({
  component: CharacterRoute,
});

function CharacterRoute() {
  const { projectId, characterId } = Route.useParams();
  return <CharacterDetailPage projectId={projectId} characterId={characterId} />;
}
