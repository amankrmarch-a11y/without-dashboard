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
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return res.status(401).json({ error: 'Token refresh failed', details: tokenData });
    }
    const token = tokenData.access_token;
    const workspaceId = '172632000001964001';
    const baseUrl = 'https://analyticsapi.zoho.in/restapi/v2';

    const { source } = req.query;

    // ── Helper: fetch a view by name using SQL ────────────────────────────────
    async function queryView(viewName, sql) {
      const url = `${baseUrl}/workspaces/${workspaceId}/views/${encodeURIComponent(viewName)}/data`;
      const r = await fetch(`${url}?sqlQuery=${encodeURIComponent(sql)}&responseFormat=json`, {
        headers: { Authorization: `Zoho-oauthtoken ${token}`, 'ZANALYTICS-ORGID': process.env.ZOHO_ORG_ID || '' }
      });
      return r.json();
    }

    // ── List all views in workspace ───────────────────────────────────────────
    if (source === 'list_views') {
      const r = await fetch(`${baseUrl}/workspaces/${workspaceId}/views`, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` }
      });
      const d = await r.json();
      // Return just names and IDs for easy reading
      const views = d.data?.views?.map(v => ({ id: v.viewId, name: v.viewName, type: v.viewType })) || d;
      return res.json({ success: true, views });
    }

    // ── CRM Deals ─────────────────────────────────────────────────────────────
    if (source === 'crm') {
      const r = await fetch(
        `${baseUrl}/workspaces/${workspaceId}/views/${encodeURIComponent('Deals (Zoho CRM)')}/data?responseFormat=json`,
        { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
      );
      const d = await r.json();
      return res.json({ success: true, source: 'crm', data: d });
    }

    // ── Facebook/Meta Ads ─────────────────────────────────────────────────────
    if (source === 'meta') {
      const r = await fetch(
        `${baseUrl}/workspaces/${workspaceId}/views/${encodeURIComponent('Campaign Insights (Facebook Ads)')}/data?responseFormat=json`,
        { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
      );
      const d = await r.json();
      return res.json({ success: true, source: 'meta', data: d });
    }

    // ── LinkedIn Ads ──────────────────────────────────────────────────────────
    if (source === 'linkedin') {
      const r = await fetch(
        `${baseUrl}/workspaces/${workspaceId}/views/${encodeURIComponent('Campaigns Performance (LinkedIn Ads)')}/data?responseFormat=json`,
        { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
      );
      const d = await r.json();
      return res.json({ success: true, source: 'linkedin', data: d });
    }

    // ── Google Ads ────────────────────────────────────────────────────────────
    if (source === 'google') {
      const r = await fetch(
        `${baseUrl}/workspaces/${workspaceId}/views/${encodeURIComponent('Campaign Performance (Google Ads)')}/data?responseFormat=json`,
        { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
      );
      const d = await r.json();
      return res.json({ success: true, source: 'google', data: d });
    }

    // ── Invoices ──────────────────────────────────────────────────────────────
    if (source === 'invoices') {
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

    // ── Default: test connection ──────────────────────────────────────────────
    return res.json({ success: true, message: 'Zoho API connected!', workspace: workspaceId });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
