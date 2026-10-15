import {createFileRoute} from "@tanstack/react-router";
import {IpProfilesPage} from "../../features/library/ui/IpProfilesPage";

export const Route = createFileRoute("/_studio/ips/")({component: IpProfilesPage});
