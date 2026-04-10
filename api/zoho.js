// Helper: parse CSV text into array of objects
function csvToJson(csv) {
  const lines = csv.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  // Parse headers
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h.trim()] = (values[idx] || '').trim();
    });
    rows.push(obj);
  }
  return rows;
}

// Helper: parse a single CSV line respecting quoted fields
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    // Get fresh access token
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

    // ── Fetch from Zoho Analytics (auto CSV→JSON) ─────────────────────────────
    if (VIEWS[source]) {
      const url = `https://analyticsapi.zoho.in/restapi/v2/workspaces/${WS}/views/${VIEWS[source]}/data`;
      const r = await fetch(url, {
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'ZANALYTICS-ORGID': ORG,
          'Accept': 'application/json',
        }
      });
      const text = await r.text();

      // Try JSON first
      let data;
      try {
        data = JSON.parse(text);
        return res.json({ success: true, source, format: 'json', data });
      } catch (e) {
        // It's CSV — convert to JSON
        const rows = csvToJson(text);
        return res.json({
          success: true,
          source,
          format: 'csv',
          count: rows.length,
          columns: rows.length > 0 ? Object.keys(rows[0]) : [],
          data: rows
        });
      }
    }

    // ── List views ────────────────────────────────────────────────────────────
    if (source === 'list_views') {
      const r = await fetch(
        `https://analyticsapi.zoho.in/restapi/v2/workspaces/${WS}/views`,
        { headers: { 'Authorization': `Zoho-oauthtoken ${token}`, 'ZANALYTICS-ORGID': ORG } }
      );
      const d = await r.json();
      const views = d.data?.views?.map(v => ({ id: v.viewId, name: v.viewName })) || d;
      return res.json({ success: true, views });
    }

    // ── Invoices fallback via Zoho Books API ──────────────────────────────────
    if (source === 'invoices_books') {
      const orgRes = await fetch('https://www.zohoapis.in/books/v3/organizations', {
        headers: { Authorization: `Zoho-oauthtoken ${token}` }
      });
      const orgData = await orgRes.json();
      const orgId = orgData.organizations?.[0]?.organization_id;
      if (!orgId) return res.status(400).json({ error: 'No org found' });
      let all = [], page = 1;
      while (true) {
        const r = await fetch(
          `https://www.zohoapis.in/books/v3/invoices?organization_id=${orgId}&per_page=200&page=${page}`,
          { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
        );
        const d = await r.json();
        if (!d.invoices?.length) break;
        all = [...all, ...d.invoices];
        if (!d.page_context?.has_more_page) break;
        page++;
      }
      return res.json({ success: true, source: 'invoices', count: all.length, data: all });
    }

    // ── Default ───────────────────────────────────────────────────────────────
    return res.json({
      success: true,
      message: 'v8 Zoho API ready',
      workspace: WS,
      views: VIEWS
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}