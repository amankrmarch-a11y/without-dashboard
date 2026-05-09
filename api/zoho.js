// ── In-memory token cache (persists while serverless function is warm) ────────
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
  _tokenExpiry = Date.now() + 55 * 60 * 1000;
  return _token;
}

// ── Robust CSV state machine — handles \n inside quoted fields ───────────────
// (the old csvToJson did csv.split('\n') which fragmented multi-line records
//  like Notes = "Payment terms: 100% Advance\nDelivery fees included\n" and
//  silently dropped them. This walks character-by-character with proper quote
//  state tracking across line boundaries.)
function csvToJson(csv) {
  const rows = [];
  let row = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (inQuotes) {
      if (ch === '"') {
        if (csv[i + 1] === '"') { cur += '"'; i++; } // escaped quote
        else inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(cur); cur = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && csv[i + 1] === '\n') i++;
        row.push(cur); cur = '';
        if (row.some(v => v !== '')) rows.push(row);
        row = [];
      } else {
        cur += ch;
      }
    }
  }
  if (cur !== '' || row.length) {
    row.push(cur);
    if (row.some(v => v !== '')) rows.push(row);
  }

  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (r[i] || '').trim(); });
    return obj;
  });
}

// ── Single workspace — everything on Anish's (syncs daily) ───────────────────
const WS_ANISH = '172632000001878083';

// fetchView — original simple GET (which was working), only csvToJson is upgraded
async function fetchView(token, viewId, workspaceId, orgId) {
  const url = `https://analyticsapi.zoho.in/restapi/v2/workspaces/${workspaceId}/views/${viewId}/data`;
  const r = await fetch(url, {
    headers: {
      'Authorization': `Zoho-oauthtoken ${token}`,
      'ZANALYTICS-ORGID': orgId
    }
  });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return csvToJson(text); }
}

// raw fetch — for the debug endpoint, returns the response text untouched
async function fetchViewRaw(token, viewId, workspaceId, orgId) {
  const url = `https://analyticsapi.zoho.in/restapi/v2/workspaces/${workspaceId}/views/${viewId}/data`;
  const r = await fetch(url, {
    headers: {
      'Authorization': `Zoho-oauthtoken ${token}`,
      'ZANALYTICS-ORGID': orgId
    }
  });
  const text = await r.text();
  return {
    status: r.status,
    contentType: r.headers.get('content-type') || '',
    length: text.length,
    head: text.slice(0, 2000),
    tail: text.slice(-2000)
  };
}

const VIEWS = {
  crm:      { id: '172632000001936642', ws: WS_ANISH },
  invoices: { id: '172632000002062591', ws: WS_ANISH },
  meta:     { id: '172632000001947117', ws: WS_ANISH },
  linkedin: { id: '172632000001949105', ws: WS_ANISH },
  google:   { id: '172632000001946295', ws: WS_ANISH },
};

const fetchV = (token, key, orgId) =>
  fetchView(token, VIEWS[key].id, VIEWS[key].ws, orgId);

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

    if (source === 'critical') {
      const [crm, invoices] = await Promise.all([
        fetchV(token, 'crm',      ORG),
        fetchV(token, 'invoices', ORG),
      ]);
      return res.json({
        success: true, source: 'critical',
        crm:      wrap(crm,      'crm'),
        invoices: wrap(invoices, 'invoices'),
        meta:     wrap([], 'meta'),
        linkedin: wrap([], 'linkedin'),
        google:   wrap([], 'google'),
      });
    }

    if (source === 'ads') {
      const [meta, linkedin, google] = await Promise.all([
        fetchV(token, 'meta',     ORG),
        fetchV(token, 'linkedin', ORG),
        fetchV(token, 'google',   ORG),
      ]);
      return res.json({
        success: true, source: 'ads',
        meta:     wrap(meta,     'meta'),
        linkedin: wrap(linkedin, 'linkedin'),
        google:   wrap(google,   'google'),
      });
    }

    if (!source || source === 'all') {
      const [crm, invoices, meta, linkedin, google] = await Promise.all([
        fetchV(token, 'crm',      ORG),
        fetchV(token, 'invoices', ORG),
        fetchV(token, 'meta',     ORG),
        fetchV(token, 'linkedin', ORG),
        fetchV(token, 'google',   ORG),
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

    if (VIEWS[source]) {
      const data = await fetchV(token, source, ORG);
      return res.json(wrap(data, source));
    }

    if (source === 'list_views') {
      const r = await fetch(
        `https://analyticsapi.zoho.in/restapi/v2/workspaces/${WS_ANISH}/views`,
        { headers: { 'Authorization': `Zoho-oauthtoken ${token}`, 'ZANALYTICS-ORGID': ORG } }
      );
      const d = await r.json();
      return res.json({
        success: true,
        workspace: 'anish',
        views: d.data?.views?.map(v => ({ id: v.viewId, name: v.viewName })) || []
      });
    }

    // Debug — see exactly what Zoho returns for a given view (head + tail of raw response)
    if (source && source.startsWith('debug_')) {
      const key = source.replace('debug_', '');
      if (!VIEWS[key]) return res.json({ success: false, error: 'unknown view: ' + key });
      const debug = await fetchViewRaw(token, VIEWS[key].id, VIEWS[key].ws, ORG);
      return res.json({ success: true, source, ...debug });
    }

    return res.json({ success: true, message: 'v15 — sources: critical | ads | all | crm | invoices | meta | linkedin | google | list_views | debug_<view>' });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
