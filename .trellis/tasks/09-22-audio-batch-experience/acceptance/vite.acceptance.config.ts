// Acceptance server disables HMR so parallel source/spec writes cannot interrupt
// an in-flight browser fixture. It uses the real app configuration and storage.
import {mergeConfig} from "vite";
// This evidence configuration is retained at its final archive/2026-10 location.
import application from "../../../../../../vite.config";

export default mergeConfig(application, {server: {hmr: false}});
