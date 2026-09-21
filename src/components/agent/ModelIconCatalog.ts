// Named exports keep Rollup from retaining the entire package namespace at the
// dynamic boundary; ModelIcon/ProviderIcon still use the library's own mappings.
export { ModelIcon, ProviderIcon } from "@lobehub/icons";
