import {InstalledSkillsPanel} from "./InstalledSkillsPanel";
import {useInstalledSkills} from "./useInstalledSkills";

/** Installed-skill management lives here; the composer menu only toggles skills for a thread. */
export function InstalledSkillsSettings() {
    const controller = useInstalledSkills();
    return <section className="skills-settings-entry">
        <InstalledSkillsPanel open inline onOpenChange={() => undefined} controller={controller}/>
    </section>;
}
