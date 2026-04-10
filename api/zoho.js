export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  try {
    const tokenRes = await fetch('https://accounts.zoho.in/oauth/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        refresh_token: process.env.ZOHO_REFRESH_TOKEN,
      })
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.status(401).json({ error: 'Token failed' });
    const token = tokenData.access_token;
    const { source, viewId } = req.query;
    const WS = '172632000001964001';
    const ORG = process.env.ZOHO_ANALYTICS_ORG_ID || '';
    const VIEWS = {
      crm: '172632000001964029',
      meta: '172632000001964071',
      linkedin: '172632000001964085',
      google: '172632000001964061',
    };

    if (source === 'analytics' || VIEWS[source]) {
      const vid = viewId || VIEWS[source];
      if (!vid) return res.status(400).json({ error: 'viewId required' });
      const r = await fetch(
        `https://analyticsapi.zoho.in/restapi/v2/workspaces/${WS}/views/${vid}/data?responseFormat=json`,
        { headers: { Authorization: `Zoho-oauthtoken ${token}`, 'ZANALYTICS-ORGID': ORG } }
      );
      const d = await r.json();
      return res.json({ success: true, source, data: d });
    }

    if (source === 'invoices') {
      const orgRes = await fetch('https://www.zohoapis.in/books/v3/organizations', {
        headers: { Authorization: `Zoho-oauthtoken ${token}` }
      });
      const orgData = await orgRes.json();
      const orgId = orgData.organizations?.[0]?.organization_id;
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

    return res.json({ success: true, message: 'v3 - Zoho API ready', workspace: WS });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}