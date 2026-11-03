// Cloudflare Worker: keep FUYAO_API_KEY in Worker Secrets, never in GitHub Pages.
const ORIGIN = 'https://sherly-719.github.io';
const ROUTES = {
  price: 'https://fuyao.aicubes.cn/api/a-share/prices/snapshot?thscodes=600519.SH',
  valuation: 'https://fuyao.aicubes.cn/api/a-share/valuations/snapshot?thscodes=600519.SH'
};
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
    if (origin === ORIGIN) headers['Access-Control-Allow-Origin'] = ORIGIN;
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type'}});
    const url = new URL(request.url);
    const kind = url.pathname.slice(1);
    if (request.method !== 'GET' || !(kind in ROUTES)) return new Response(JSON.stringify({ok:false,error:'unsupported_route'}),{status:404,headers});
    if (!env.FUYAO_API_KEY) return new Response(JSON.stringify({ok:false,error:'key_not_configured'}),{status:503,headers});
    try {
      const upstream = await fetch(ROUTES[kind], {headers:{'X-api-key':env.FUYAO_API_KEY},signal:AbortSignal.timeout(8000)});
      const data = await upstream.json();
      if (!upstream.ok || data.code !== 0 || !Array.isArray(data.data?.item) || data.data.item.length === 0) {
        return new Response(JSON.stringify({ok:false,error:'upstream_unavailable',code:data.code ?? null}),{status:502,headers});
      }
      return new Response(JSON.stringify({ok:true,source:'扶摇同花顺金融数据 API',kind,as_of:data.data.timestamp ?? null,item:data.data.item[0]}),{headers});
    } catch {
      return new Response(JSON.stringify({ok:false,error:'upstream_failed'}),{status:502,headers});
    }
  }
};
