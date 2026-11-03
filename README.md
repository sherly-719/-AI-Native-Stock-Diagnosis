# 证据镜：A 股个股诊断 MVP

运行：直接打开 `dist/index.html`，或在本目录运行 `python -m http.server 8000 -d dist`。输入问题、选择公司类型、点击重新诊断。勾选“模拟数据接口失败”查看降级。

产品选择：以贵州茅台（600519）为样本。消费品经营及财务指标有公开年报原始证据。问题关键词和公司类型确定诊断维度；数值计算由 JavaScript 固定公式完成，证据卡区分正面、负面、矛盾、未知，并能打开原报告。没有接入在线模型，避免把生成文本误称为已核验事实。

数据：贵州茅台 2025 年年度报告，上交所 2026-04-17 披露。原始单位元，页面换算亿元；同比=(2025/2024-1)*100%。页面为固定快照，不宣称实时。行情与估值通过 Cloudflare Worker 代理扶摇 API 在线读取；同行及新闻因缺乏已验证的数据源而标未知。

扶摇和 iFinD：扶摇 API Key 仅配置在 Cloudflare Worker Secret `FUYAO_API_KEY`，不在浏览器或仓库；`worker/fuyao-proxy.js` 固定代理 600519.SH 的行情与估值快照。页面验证响应状态、标的、时间戳和必需数值字段，失败显示未知。iFinD MCP 已在本地通过查询验证，网页使用 `ifind-market.json` 展示 2026-11-02 沪深 300 历史快照，并标明静态且不会自动更新。iFinD Worker 在线路由目前在 Cloudflare 初始化连接失败，页面仅在它通过校验后才用在线结果替换静态快照；详见 `IFIND-DEPLOY.md`。

边界：只支持一只示例股票的年报快照与扶摇在线行情、估值；公司类型切换展示维度选择机制，不把茅台数据冒充银行或科技公司数据。无在线 LLM、同业排名或交易建议。行情快照不保证逐笔实时，须以返回时间戳判断。


## 扶摇在线数据部署

Cloudflare Worker 源码见 `worker/fuyao-proxy.js`。部署后在 Worker 的 Production 环境添加类型为 Secret 的 `FUYAO_API_KEY`，勿在代码或仓库粘贴真实值。公开接口为 `/price` 和 `/valuation`；前端固定调用 `stock-diagnosis-fuyao.719553957.workers.dev`。若更换 Worker 地址，需同步修改网页 `refreshLive()` 的 `base`。用户截图已证明两个端点返回 600519.SH 的非空数据，且网页显示了相应字段与时点。


