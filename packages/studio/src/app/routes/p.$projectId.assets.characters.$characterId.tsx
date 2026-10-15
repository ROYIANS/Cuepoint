import {createFileRoute} from "@tanstack/react-router";
import {CharacterDetailPage} from "../../features/library/ui/CharacterDetailPage";

export const Route = createFileRoute("/p/$projectId/assets/characters/$characterId")({
    component: CharacterRoute,
});

function CharacterRoute() {
    const {projectId, characterId} = Route.useParams();
    return <CharacterDetailPage characterId={characterId} back={{kind: "project", projectId}}/>;
}
