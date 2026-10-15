import {recoverLegacyText} from "../../../platform/data/legacyScalar";

export interface WorldSetting {
    worldview: string;
    background: string;
    rules: string;
}

export function emptySetting(): WorldSetting {
    return {worldview: "", background: "", rules: ""};
}

export function normalizeSetting(raw: unknown): WorldSetting {
    const setting = emptySetting();
    if (!raw || typeof raw !== "object") return setting;
    const record = raw as Record<string, unknown>;
    setting.worldview = recoverLegacyText(record.worldview);
    setting.background = recoverLegacyText(record.background);
    setting.rules = recoverLegacyText(record.rules);
    return setting;
}
