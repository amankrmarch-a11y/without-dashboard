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
    if (!tokenData.access_token) return res.status(401).json({ error: 'Token failed', details: tokenData });
    const token = tokenData.access_token;
    const { source } = req.query;

    if (source === 'analytics_orgs') {
      const r = await fetch('https://analyticsapi.zoho.in/restapi/v2/orgs', {
        headers: { Authorization: `Zoho-oauthtoken ${token}` }
      });
      const d = await r.json();
      return res.json({ success: true, data: d });
    }

    if (source === 'list_views') {
      const r = await fetch('https://analyticsapi.zoho.in/restapi/v2/workspaces/172632000001964001/views', {
        headers: { Authorization: `Zoho-oauthtoken ${token}`, 'ZANALYTICS-ORGID': process.env.ZOHO_ANALYTICS_ORG_ID || '' }
      });
      const d = await r.json();
      return res.json({ success: true, data: d });
    }

    if (source === 'invoices') {
      const orgRes = await fetch('https://www.zohoapis.in/books/v3/organizations', { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
      const orgData = await orgRes.json();
      const orgId = orgData.organizations?.[0]?.organization_id;
      let all = [], page = 1;
      while (true) {
        const r = await fetch(`https://www.zohoapis.in/books/v3/invoices?organization_id=${orgId}&per_page=200&page=${page}`, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
        const d = await r.json();
        if (!d.invoices?.length) break;
        all = [...all, ...d.invoices];
        if (!d.page_context?.has_more_page) break;
        page++;
      }
      return res.json({ success: true, source: 'invoices', count: all.length, data: all });
    }

    if (source === 'crm') {
      let all = [], page = 1;
      while (true) {
        const r = await fetch(`https://www.zohoapis.in/crm/v3/Deals?fields=Deal_Name,Account_Name,Stage,Deal_Type_B2B_B2C_etc,Amount,Closing_Date,Created_Time,Owner&per_page=200&page=${page}`, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
        const d = await r.json();
        if (!d.data?.length) break;
        all = [...all, ...d.data];
        if (!d.info?.more_records) break;
        page++;
      }
      return res.json({ success: true, source: 'crm', count: all.length, data: all });
    }

    return res.json({ success: true, message: 'v2 - Zoho API connected!', workspace: '172632000001964001' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}