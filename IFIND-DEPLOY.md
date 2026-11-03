# iFinD 市场背景接入（待完成线上验证）

GitHub Pages 网页使用扶摇在线快照，并用 `ifind-market.json` 展示经过本地 iFinD MCP 验证的 2026-11-02 沪深 300 历史快照。该文件不会自动更新。仓库中的 `worker/fuyao-proxy.js` 另准备了 `/ifind/market` 在线路由；网页只在它通过校验后用在线结果替换静态快照。该路由固定查询沪深 300 在 2026-11-02 的收盘点位与涨跌幅；不提供白酒板块诊断结论，因为实测接口没有返回完整的上涨、下跌家数。

## Cloudflare 操作

1. 打开现有 Worker `stock-diagnosis-fuyao` 的 **Edit code**，用仓库 `worker/fuyao-proxy.js` 的全部内容替换当前代码，保存并部署。现有 `FUYAO_API_KEY` Secret 保留。
2. 在 Worker 的 **Settings → Variables and Secrets** 中添加 Production Secret，名称为 `IFIND_MCP_TOKEN`，值填本机 `.agents/skills/ifind-finance-data/mcp_config.json` 的 `auth_token` 值。不要把值写进 GitHub、网页代码或聊天。
3. 访问 `https://stock-diagnosis-fuyao.719553957.workers.dev/ifind/market`。成功时应返回 `ok:true`、`symbol:"399300.SZ"`、`trade_date:"2026-11-02"`、`close` 和 `change_pct`。若返回 `ok:false`，记录错误代号即可，不要发送 Secret。当前实测返回 `stage:"init_network"`，表示 Cloudflare Worker 尚未连上 iFinD 服务。
4. 再检查原有 `/price` 和 `/valuation` 是否仍返回 `ok:true`。iFinD 在线路由不可用时，网页仍会显示明确标注的静态历史快照。

## 数据边界

- Worker 只接受固定路由和固定查询，不把用户输入传给 iFinD。
- 仅返回经过日期、代码、格式和数值校验的四个市场字段，不向网页转发原始 MCP 文本。
- 响应注明 iFinD MCP、工具名和查询口径。iFinD 本次响应未提供公告或指数的公开原始页面链接，页面需如实说明。
- Worker 连接 iFinD 使用 `:8643` 端口；本机测试成功不代表 Cloudflare 出站连接已验证。线上返回 `ifind_unavailable_or_unverified` 时，先检查 Worker 日志与端口连通性，不把失败当成正常数据。

