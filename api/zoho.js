// ── In-memory token cache (persists while serverless function is warm) ────────
// Vercel reuses warm instances for ~5 min — this avoids redundant token refreshes
let _token = null;
let _tokenExpiry = 0;

async function getToken() {
  if (_token && Date.now() < _tokenExpiry) return _token;
  const res = await fetch('https://accounts.zoho.in/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      refresh_token: process.env.ZOHO_REFRESH_TOKEN,
    })
  });
  const td = await res.json();
  if (!td.access_token) throw new Error('Token refresh failed: ' + JSON.stringify(td));
  _token = td.access_token;
  _tokenExpiry = Date.now() + 55 * 60 * 1000; // cache 55 min
  return _token;
}

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

async function fetchView(token, viewId, orgId) {
  const WS = '172632000001964001';
  const url = `https://analyticsapi.zoho.in/restapi/v2/workspaces/${WS}/views/${viewId}/data`;
  const r = await fetch(url, {
    headers: { 'Authorization': `Zoho-oauthtoken ${token}`, 'ZANALYTICS-ORGID': orgId }
  });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return csvToJson(text); }
}

const VIEWS = {
  crm:      '172632000001964013',
  invoices: '172632000001967250',
  meta:     '172632000001964071',
  linkedin: '172632000001964086',
  google:   '172632000001964061',
};

const wrap = (data, src) => ({
  success: true, source: src,
  count: Array.isArray(data) ? data.length : 0,
  data:  Array.isArray(data) ? data : []
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const token = await getToken();
    const ORG   = process.env.ZOHO_ANALYTICS_ORG_ID || '';
    const { source } = req.query;

    // ── Phase 1: Critical — CRM + Invoices only (~2 sources, fast) ───────────
    if (source === 'critical') {
      const [crm, invoices] = await Promise.all([
        fetchView(token, VIEWS.crm,      ORG),
        fetchView(token, VIEWS.invoices,  ORG),
      ]);
      return res.json({
        success: true, source: 'critical',
        crm:      wrap(crm,      'crm'),
        invoices: wrap(invoices, 'invoices'),
        // Empty stubs so dashboard parse code doesn't crash
        meta:     wrap([], 'meta'),
        linkedin: wrap([], 'linkedin'),
        google:   wrap([], 'google'),
      });
    }

    // ── Phase 2: Ads — Meta + LinkedIn + Google (~3 sources) ─────────────────
    if (source === 'ads') {
      const [meta, linkedin, google] = await Promise.all([
        fetchView(token, VIEWS.meta,     ORG),
        fetchView(token, VIEWS.linkedin, ORG),
        fetchView(token, VIEWS.google,   ORG),
      ]);
      return res.json({
        success: true, source: 'ads',
        meta:     wrap(meta,     'meta'),
        linkedin: wrap(linkedin, 'linkedin'),
        google:   wrap(google,   'google'),
      });
    }

    // ── All at once (fallback / manual) ──────────────────────────────────────
    if (!source || source === 'all') {
      const [crm, invoices, meta, linkedin, google] = await Promise.all([
        fetchView(token, VIEWS.crm,      ORG),
        fetchView(token, VIEWS.invoices, ORG),
        fetchView(token, VIEWS.meta,     ORG),
        fetchView(token, VIEWS.linkedin, ORG),
        fetchView(token, VIEWS.google,   ORG),
      ]);
      return res.json({
        success: true, source: 'all',
        crm:      wrap(crm,      'crm'),
        invoices: wrap(invoices, 'invoices'),
        meta:     wrap(meta,     'meta'),
        linkedin: wrap(linkedin, 'linkedin'),
        google:   wrap(google,   'google'),
      });
    }

    // ── Single source (for debugging) ────────────────────────────────────────
    if (VIEWS[source]) {
      const data = await fetchView(token, VIEWS[source], ORG);
      return res.json(wrap(data, source));
    }

    // ── List views ────────────────────────────────────────────────────────────
    if (source === 'list_views') {
      const r = await fetch(
        `https://analyticsapi.zoho.in/restapi/v2/workspaces/172632000001964001/views`,
        { headers: { 'Authorization': `Zoho-oauthtoken ${token}`, 'ZANALYTICS-ORGID': ORG } }
      );
      const d = await r.json();
      return res.json({ success: true, views: d.data?.views?.map(v => ({ id: v.viewId, name: v.viewName })) || [] });
    }

    return res.json({ success: true, message: 'v12 Zoho API — sources: critical | ads | all | crm | invoices | meta | linkedin | google' });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
