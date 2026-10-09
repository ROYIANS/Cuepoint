import assert from 'node:assert/strict';

/** Server-only readiness; it neither evaluates the fixture nor navigates a page. */
export async function prepareNativeFixture(server, moduleUrl) {
    const stages = [];
    const stage = async (name, action) => {
        const started = performance.now();
        await action();
        stages.push({name, milliseconds: Math.round(performance.now() - started)});
    };
    const optimizer = server.environments.client.depsOptimizer;
    const processing = () => Promise.all(Object.values(optimizer?.metadata.discovered ?? {}).map(info => info.processing));
    await stage('scan', async () => {await optimizer?.scanProcessing;});
    await stage('discovered-processing', processing);
    await stage('fixture-transform', async () => {
        assert.ok(await server.transformRequest(moduleUrl), 'Actual native fixture transform must complete');
    });
    await stage('static-request-idle', () => server.waitForRequestsIdle());
    await stage('post-transform-processing', async () => {
        await optimizer?.scanProcessing;
        await processing();
    });
    console.log(JSON.stringify({nativeFixtureReadiness: {moduleUrl, stages,
        limits: 'Installed Vite first-crawl/static transform preflight; dynamic/browser/CSS/font/IndexedDB readiness still belongs to unchanged browser assertions.'}}));
}
