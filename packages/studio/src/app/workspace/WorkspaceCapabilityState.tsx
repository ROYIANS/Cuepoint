import {Link} from "@tanstack/react-router";
import {PageContent, PageState} from "../layout/PageLayout";
import {Button} from "../../ui/button";

export function WorkspaceCapabilityState({
                                             projectId,
                                             title = "此能力尚未接入原生工作区",
                                             description = "当前可使用视频项目、集数、故事与分镜。后续桌面模块接入后，这里会沿用同一套产品界面。"
                                         }: {
    projectId?: string; title?: string; description?: string;
}) {
    return <PageContent mode="detail"><PageState title={title} description={description}
                                                 action={<Button variant="outline" asChild>{projectId
                                                     ? <Link to="/p/$projectId" params={{projectId}}>返回项目</Link>
                                                     :
                                                     <Link to="/projects">返回项目库</Link>}</Button>}/></PageContent>;
}
