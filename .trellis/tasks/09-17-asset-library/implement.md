# Implement — asset-library

## Checklist

1. 资产列表页 + 新建角色/场景（默认名「未命名角色/场景」）。
2. 详情表单绑定 Dexie。
3. 槽位上传/替换/清除 + 未引用 media 回收。
4. 确认删除。
5. 确认 `projectPackage.ts` 收集资产 media。
6. 工作区「资产」入口不再是空壳。

## Validation

`npm run build`。浏览器：建角色/场景 → 传图 → 刷新 → 导出导入 → 删资产。

## Risky files

- media 回收：镜头仍引用的图不得删
- 导入后的 object URL 生命周期
