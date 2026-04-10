// CSV → JSON parser
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
    // ── ONE token refresh per request ────────────────────────────────────────
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
      crm:      '172632000001964013',
      meta:     '172632000001964071',
      linkedin: '172632000001964086',
      google:   '172632000001964061',
      invoices: '172632000001967250',
    };

    // ── ALL sources in one call — only ONE token refresh needed ──────────────
    if (source === 'all') {
      const [crm, invoices, meta, linkedin, google] = await Promise.all([
        fetchView(token, WS, VIEWS.crm,      ORG),
        fetchView(token, WS, VIEWS.invoices,  ORG),
        fetchView(token, WS, VIEWS.meta,      ORG),
        fetchView(token, WS, VIEWS.linkedin,  ORG),
        fetchView(token, WS, VIEWS.google,    ORG),
      ]);
      return res.json({
        success: true,
        source: 'all',
        crm:      { success: true, format: 'csv', count: Array.isArray(crm)      ? crm.length      : 0, data: crm },
        invoices: { success: true, format: 'csv', count: Array.isArray(invoices) ? invoices.length : 0, data: invoices },
        meta:     { success: true, format: 'csv', count: Array.isArray(meta)     ? meta.length     : 0, data: meta },
        linkedin: { success: true, format: 'csv', count: Array.isArray(linkedin) ? linkedin.length : 0, data: linkedin },
        google:   { success: true, format: 'csv', count: Array.isArray(google)   ? google.length   : 0, data: google },
      });
    }

    // ── Single source (kept for debugging) ───────────────────────────────────
    if (VIEWS[source]) {
      const data = await fetchView(token, WS, VIEWS[source], ORG);
      return res.json({ success: true, source, format: 'csv', count: Array.isArray(data) ? data.length : 0, data });
    }

    if (source === 'list_views') {
      const r = await fetch(
        `https://analyticsapi.zoho.in/restapi/v2/workspaces/${WS}/views`,
        { headers: { 'Authorization': `Zoho-oauthtoken ${token}`, 'ZANALYTICS-ORGID': ORG } }
      );
      const d = await r.json();
      return res.json({ success: true, views: d.data?.views?.map(v => ({ id: v.viewId, name: v.viewName })) || d });
    }

    return res.json({ success: true, message: 'v10 Zoho API ready', workspace: WS });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
