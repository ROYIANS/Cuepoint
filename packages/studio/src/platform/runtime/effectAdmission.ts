/** Application Quit closes fresh effects, while original Stop/readback/publication remain usable. */
export function createEffectAdmission() {
    let open = true;
    return Object.freeze({
        assertOpen() {if (!open) throw new Error("应用正在退出，无法开始新的操作");},
        close() {open = false;},
        get open() {return open;},
    });
}

export const productEffectAdmission = createEffectAdmission();
