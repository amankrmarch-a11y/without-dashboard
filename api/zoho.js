function csvToJson(csv) {
  const lines = csv.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (vals[i] || '').trim(); });
    return obj;
  }).filter(r => Object.values(r).some(v => v));
}
function parseLine(line) {
  const result = []; let cur = ''; let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur);
  return result;
}

async function fetchView(token, workspaceId, viewId, orgId) {
  const url = `https://analyticsapi.zoho.in/restapi/v2/workspaces/${workspaceId}/views/${viewId}/data`;
  const r = await fetch(url, {
    headers: { 'Authorization': `Zoho-oauthtoken ${token}`, 'ZANALYTICS-ORGID': orgId }
  });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return csvToJson(text); }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    // ONE token refresh per request
    const tokenRes = await fetch('https://accounts.zoho.in/oauth/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'refresh_token',
        client_id:     process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        refresh_token: process.env.ZOHO_REFRESH_TOKEN,
      })
    });
    const td = await tokenRes.json();
    if (!td.access_token) {
      return res.status(401).json({ error: 'Token refresh failed', details: td });
    }
    const token = td.access_token;
    const { source } = req.query;

    const WS  = '172632000001964001';
    const ORG = process.env.ZOHO_ANALYTICS_ORG_ID || '';

    const VIEWS = {
      // ── Ads ──────────────────────────────────────────────
      crm:           '172632000001964013',
      meta:          '172632000001964071',
      linkedin:      '172632000001964086',
      google:        '172632000001964061',
      invoices:      '172632000001967250',
      // ── Instagram ────────────────────────────────────────
      ig_info:       '172632000001964020',  // Profile Information
      ig_insights:   '172632000001964028',  // Profile Insights (daily reach)
      ig_media:      '172632000001964026',  // Media Insights (per-post: timestamp + engagement)
      ig_reels:      '172632000001964029',  // Reels Insights
      // ── LinkedIn Pages ───────────────────────────────────
      li_page_info:    '172632000001964030', // Pages Informations
      li_page_stats:   '172632000001964037', // Page Statistics By Date
      li_followers:    '172632000001964034', // Follower Counts By Date
      li_industries:   '172632000001964033', // Follower Counts By Industries
      li_posts:        '172632000001964038', // Post Insights
      li_shares:       '172632000001964031', // Share Statistics By Date
    };

    // ── Single source (for debugging) ────────────────────────────────────────
    if (source && VIEWS[source]) {
      const data = await fetchView(token, WS, VIEWS[source], ORG);
      return res.json({ success: true, source, count: Array.isArray(data) ? data.length : 0, data });
    }

    // ── List views ────────────────────────────────────────────────────────────
    if (source === 'list_views') {
      const r = await fetch(
        `https://analyticsapi.zoho.in/restapi/v2/workspaces/${WS}/views`,
        { headers: { 'Authorization': `Zoho-oauthtoken ${token}`, 'ZANALYTICS-ORGID': ORG } }
      );
      const d = await r.json();
      return res.json({ success: true, views: d.data?.views?.map(v => ({ id: v.viewId, name: v.viewName })) || d });
    }

    // ── ALL sources — ONE token refresh, all fetched in parallel ─────────────
    if (!source || source === 'all') {
      const [
        crm, invoices, meta, linkedin, google,
        ig_info, ig_insights, ig_media, ig_reels,
        li_page_info, li_page_stats, li_followers, li_industries, li_posts, li_shares
      ] = await Promise.all([
        fetchView(token, WS, VIEWS.crm,          ORG),
        fetchView(token, WS, VIEWS.invoices,      ORG),
        fetchView(token, WS, VIEWS.meta,          ORG),
        fetchView(token, WS, VIEWS.linkedin,      ORG),
        fetchView(token, WS, VIEWS.google,        ORG),
        fetchView(token, WS, VIEWS.ig_info,       ORG),
        fetchView(token, WS, VIEWS.ig_insights,   ORG),
        fetchView(token, WS, VIEWS.ig_media,      ORG),
        fetchView(token, WS, VIEWS.ig_reels,      ORG),
        fetchView(token, WS, VIEWS.li_page_info,  ORG),
        fetchView(token, WS, VIEWS.li_page_stats, ORG),
        fetchView(token, WS, VIEWS.li_followers,  ORG),
        fetchView(token, WS, VIEWS.li_industries, ORG),
        fetchView(token, WS, VIEWS.li_posts,      ORG),
        fetchView(token, WS, VIEWS.li_shares,     ORG),
      ]);

      const wrap = (data, src) => ({
        success: true, source: src,
        count: Array.isArray(data) ? data.length : 0,
        data: Array.isArray(data) ? data : []
      });

      return res.json({
        success: true, source: 'all',
        crm:          wrap(crm,          'crm'),
        invoices:     wrap(invoices,     'invoices'),
        meta:         wrap(meta,         'meta'),
        linkedin:     wrap(linkedin,     'linkedin'),
        google:       wrap(google,       'google'),
        ig_info:      wrap(ig_info,      'ig_info'),
        ig_insights:  wrap(ig_insights,  'ig_insights'),
        ig_media:     wrap(ig_media,     'ig_media'),
        ig_reels:     wrap(ig_reels,     'ig_reels'),
        li_page_info: wrap(li_page_info, 'li_page_info'),
        li_page_stats:wrap(li_page_stats,'li_page_stats'),
        li_followers: wrap(li_followers, 'li_followers'),
        li_industries:wrap(li_industries,'li_industries'),
        li_posts:     wrap(li_posts,     'li_posts'),
        li_shares:    wrap(li_shares,    'li_shares'),
      });
    }

    return res.json({ success: true, message: 'v11 Zoho API ready' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
