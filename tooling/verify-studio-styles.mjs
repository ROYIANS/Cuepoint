import {readFile, readdir} from 'node:fs/promises';
import {join} from 'node:path';

/** Verify emitted selectors from a business feature outside the neutral UI directory. */
export async function verifyStudioStyles({root, output}) {
    const source = await readFile(join(root, 'packages/studio/src/features/video/ui/StoryboardPrintPage.tsx'), 'utf8');
    const classes = ['max-w-6xl', 'tracking-[0.18em]', 'text-black/55', 'mt-12', 'print:grid-cols-2'];
    const css = [];
    async function visit(directory) {
        for (const entry of await readdir(directory, {withFileTypes: true})) {
            const file = join(directory, entry.name);
            if (entry.isDirectory()) await visit(file);
            else if (entry.name.endsWith('.css')) css.push(await readFile(file, 'utf8'));
        }
    }
    await visit(output);
    for (const name of classes) {
        if (!source.includes(name)) throw new Error('Studio CSS source probe changed: ' + name);
        const selector = '.' + name.replace(/[^a-zA-Z0-9_-]/g, character => '\\' + character);
        if (!css.some(text => text.includes(selector))) throw new Error('Studio feature selector missing from built CSS: ' + name);
    }
    return {feature: 'video/StoryboardPrintPage', selectors: classes, cssFiles: css.length};
}
