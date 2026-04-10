export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    // Step 1: Get fresh access token
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

    // Zoho Analytics config
    const WS  = '172632000001964001';
    const ORG = process.env.ZOHO_ANALYTICS_ORG_ID || '';

    // Correct view IDs from your workspace
    const VIEWS = {
      crm:      '172632000001964013', // Deals (Zoho CRM)
      meta:     '172632000001964071', // Campaign Insights (Facebook Ads)
      linkedin: '172632000001964086', // Campaigns Performance (LinkedIn Ads)
      google:   '172632000001964061', // Campaign Performance (Google Ads)
      invoices: '172632000001967250', // Invoices (Zoho Books)
    };

    // ── Fetch from Zoho Analytics ─────────────────────────────────────────────
    if (VIEWS[source]) {
      const url = `https://analyticsapi.zoho.in/restapi/v2/workspaces/${WS}/views/${VIEWS[source]}/data`;
      const r = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'ZANALYTICS-ORGID': ORG,
          'Accept': 'application/json',
        }
      });

      // Read as text first — Analytics sometimes returns CSV instead of JSON
      const text = await r.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        // Return raw text so we can debug the format
        return res.json({
          success: false,
          source,
          error: 'Response is not JSON',
          raw: text.slice(0, 1000),
          status: r.status
        });
      }
      return res.json({ success: true, source, data });
    }

    // ── List all views in workspace ───────────────────────────────────────────
    if (source === 'list_views') {
      const r = await fetch(
        `https://analyticsapi.zoho.in/restapi/v2/workspaces/${WS}/views`,
        { headers: { 'Authorization': `Zoho-oauthtoken ${token}`, 'ZANALYTICS-ORGID': ORG } }
      );
      const d = await r.json();
      const views = d.data?.views?.map(v => ({ id: v.viewId, name: v.viewName })) || d;
      return res.json({ success: true, views });
    }

    // ── Get Analytics orgs ────────────────────────────────────────────────────
    if (source === 'analytics_orgs') {
      const r = await fetch('https://analyticsapi.zoho.in/restapi/v2/orgs', {
        headers: { 'Authorization': `Zoho-oauthtoken ${token}` }
      });
      const d = await r.json();
      return res.json({ success: true, data: d });
    }

    // ── Default: verify connection ────────────────────────────────────────────
    return res.json({
      success: true,
      message: 'v7 Zoho API ready',
      workspace: WS,
      org: ORG,
      views: VIEWS
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}