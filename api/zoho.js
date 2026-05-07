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

function csvToJson(csv) {
  const lines = csv.split('\n');
  const result = [];
  let headers = null;

  for (const rawLine of lines) {
    if (!rawLine.trim()) continue;
    const fields = parseCSVLine(rawLine);
    if (!headers) { headers = fields.map(h => h.trim()); continue; }
    if (fields.length < headers.length / 2) continue; // skip badly malformed rows
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (fields[i] || '').trim(); });
    if (Object.values(obj).some(v => v)) result.push(obj);
  }
  return result;
}

function parseCSVLine(line) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i+1] === '"') { cur += '"'; i++; } // escaped quote
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

// ── Single workspace — everything on Anish's (syncs daily) ───────────────────
const WS_ANISH = '172632000001878083';

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

// ── View IDs — correct IDs from each workspace ────────────────────────────────
const VIEWS = {
  crm:      { id: '172632000001936642', ws: WS_ANISH }, // Deals — Anish's workspace
  invoices: { id: '172632000002062591', ws: WS_ANISH }, // Invoices (Zoho Books) — Anish's workspace
  meta:     { id: '172632000001947117', ws: WS_ANISH }, // Campaign Insights — Anish's workspace
  linkedin: { id: '172632000001949105', ws: WS_ANISH }, // Campaigns Performance — Anish's workspace
  google:   { id: '172632000001946295', ws: WS_ANISH }, // Campaign Performance — Anish's workspace
};

// Helper — fetch using the view's own workspace
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

    // ── Phase 1: Critical — Invoices (yours) + CRM (Anish's) ─────────────────
    if (source === 'critical') {
      const [crm, invoices] = await Promise.all([
        fetchV(token, 'crm',      ORG), // → Anish's workspace
        fetchV(token, 'invoices', ORG), // → your workspace
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

    // ── Phase 2: Ads — all from Anish's workspace ─────────────────────────────
    if (source === 'ads') {
      const [meta, linkedin, google] = await Promise.all([
        fetchV(token, 'meta',     ORG), // → Anish's workspace
        fetchV(token, 'linkedin', ORG), // → Anish's workspace
        fetchV(token, 'google',   ORG), // → Anish's workspace
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

    // ── Single source (for debugging) ─────────────────────────────────────────
    if (VIEWS[source]) {
      const data = await fetchV(token, source, ORG);
      return res.json(wrap(data, source));
    }

    // ── List views (debug helper) ─────────────────────────────────────────────
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

    return res.json({ success: true, message: 'v13 Dual-workspace Zoho API — sources: critical | ads | all | crm | invoices | meta | linkedin | google | list_views' });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
