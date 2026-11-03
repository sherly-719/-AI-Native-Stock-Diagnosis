// Cloudflare Worker. Configure FUYAO_API_KEY and IFIND_MCP_TOKEN as Secrets.
const ORIGIN = 'https://sherly-719.github.io';
const IFIND_URL = 'https://api-mcp.51ifind.com:8643/ds-mcp-servers/hexin-ifind-ds-index-mcp';
const MARKET_DATE = '20261102';
const MARKET_QUERY = '沪深300指数2026年11月2日收盘点位和涨跌幅';
const ROUTES = {
  price: 'https://fuyao.aicubes.cn/api/a-share/prices/snapshot?thscodes=600519.SH',
  valuation: 'https://fuyao.aicubes.cn/api/a-share/valuations/snapshot?thscodes=600519.SH'
};

function headers(origin) {
  const h = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
  if (origin === ORIGIN) h['Access-Control-Allow-Origin'] = ORIGIN;
  return h;
}
function json(data, status, origin, cache = false) {
  const h = headers(origin);
  if (cache) h['Cache-Control'] = 'public, max-age=3600';
  return new Response(JSON.stringify(data), {status, headers:h});
}
async function mcpPost(payload, token, session) {
  const h = {
    'Content-Type':'application/json',
    'Accept':'application/json, text/event-stream',
    'Authorization':token,
    'User-Agent':'stock-diagnosis-mvp'
  };
  if (session) h['Mcp-Session-Id'] = session;
  const response = await fetch(IFIND_URL, {
    method:'POST', headers:h, body:JSON.stringify(payload), signal:AbortSignal.timeout(10000)
  });
  if (!response.ok) throw Error('ifind_http_error');
  const text = await response.text();
  return {session:response.headers.get('Mcp-Session-Id'), data:text ? JSON.parse(text) : null};
}
function parseMarket(result) {
  const text = result?.result?.content?.find(x => x.type === 'text')?.text;
  if (!text) throw Error('ifind_empty');
  const envelope = JSON.parse(text);
  if (envelope.code !== 1 || !envelope.data?.answer) throw Error('ifind_bad_result');
  const params = envelope.data.indicators_params;
  if (params?.['收盘价']?.['交易日期'] !== MARKET_DATE ||
      params?.['涨跌幅']?.['交易日期'] !== MARKET_DATE) throw Error('ifind_date_mismatch');
  const rows = envelope.data.answer.split('\n').map(x => x.trim()).filter(Boolean);
  const row = rows.find(x => /^\|399300\.SZ\|沪深300\|/.test(x));
  if (!row) throw Error('ifind_symbol_mismatch');
  const cells = row.split('|').slice(1,-1).map(x => x.trim());
  if (cells.length !== 4) throw Error('ifind_shape_mismatch');
  const close = Number(cells[2]);
  const changePct = Number(cells[3]);
  if (!Number.isFinite(close) || close <= 0 || !Number.isFinite(changePct) || Math.abs(changePct) > 30)
    throw Error('ifind_number_invalid');
  return {ok:true, source:'同花顺 iFinD MCP', tool:'index_data', symbol:'399300.SZ', name:'沪深300',
    trade_date:'2026-11-02', close, change_pct:changePct, query:MARKET_QUERY,
    note:'历史指数快照；接口未提供公开原始页面链接。'};
}
async function market(env, origin) {
  if (!env.IFIND_MCP_TOKEN) return json({ok:false,error:'ifind_key_not_configured'},503,origin);
  try {
    const init = await mcpPost({jsonrpc:'2.0',id:1,method:'initialize',params:{
      protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'stock-diagnosis-mvp',version:'1.0.0'}
    }}, env.IFIND_MCP_TOKEN);
    if (!init.session) throw Error('ifind_session_missing');
    await mcpPost({jsonrpc:'2.0',method:'notifications/initialized'},env.IFIND_MCP_TOKEN,init.session);
    const result = await mcpPost({jsonrpc:'2.0',id:2,method:'tools/call',params:{
      name:'index_data',arguments:{query:MARKET_QUERY}
    }},env.IFIND_MCP_TOKEN,init.session);
    return json(parseMarket(result.data),200,origin,true);
  } catch {
    return json({ok:false,error:'ifind_unavailable_or_unverified'},502,origin);
  }
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:{
      ...headers(origin),'Access-Control-Allow-Methods':'GET, OPTIONS',
      'Access-Control-Allow-Headers':'Content-Type'
    }});
    const kind = new URL(request.url).pathname.slice(1);
    if (request.method !== 'GET') return json({ok:false,error:'unsupported_route'},404,origin);
    if (kind === 'ifind/market') return market(env,origin);
    if (!Object.hasOwn(ROUTES,kind)) return json({ok:false,error:'unsupported_route'},404,origin);
    if (!env.FUYAO_API_KEY) return json({ok:false,error:'key_not_configured'},503,origin);
    try {
      const upstream = await fetch(ROUTES[kind], {headers:{'X-api-key':env.FUYAO_API_KEY},signal:AbortSignal.timeout(8000)});
      const data = await upstream.json();
      if (!upstream.ok || data.code !== 0 || !Array.isArray(data.data?.item) || data.data.item.length === 0)
        return json({ok:false,error:'upstream_unavailable',code:data.code ?? null},502,origin);
      return json({ok:true,source:'扶摇同花顺金融数据 API',kind,
        as_of:data.data.timestamp ?? null,item:data.data.item[0]},200,origin);
    } catch {
      return json({ok:false,error:'upstream_failed'},502,origin);
    }
  }
};

