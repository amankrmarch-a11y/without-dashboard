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
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return res.status(401).json({ error: 'Token refresh failed', details: tokenData });
    }
    const access_token = tokenData.access_token;
    const { source } = req.query;

    // ── CRM Deals ─────────────────────────────────────────────────────────────
    if (source === 'crm') {
      let allDeals = [];
      let page = 1;
      while (true) {
        const r = await fetch(
          `https://www.zohoapis.in/crm/v3/Deals?fields=Deal_Name,Account_Name,Stage,Deal_Type_B2B_B2C_etc,Amount,Closing_Date,Created_Time,Owner&per_page=200&page=${page}`,
          { headers: { Authorization: `Zoho-oauthtoken ${access_token}` } }
        );
        const d = await r.json();
        if (!d.data || !d.data.length) break;
        allDeals = [...allDeals, ...d.data];
        if (!d.info?.more_records) break;
        page++;
      }
      return res.json({ success: true, source: 'crm', count: allDeals.length, data: allDeals });
    }

    // ── Invoices ──────────────────────────────────────────────────────────────
    if (source === 'invoices') {
      // Get org ID first
      const orgRes = await fetch('https://www.zohoapis.in/books/v3/organizations', {
        headers: { Authorization: `Zoho-oauthtoken ${access_token}` }
      });
      const orgData = await orgRes.json();
      const orgId = orgData.organizations?.[0]?.organization_id;
      if (!orgId) return res.status(400).json({ error: 'No org found', details: orgData });

      // Fetch all invoices (no status filter — get all and filter in dashboard)
      let allInvoices = [];
      let page = 1;
      while (true) {
        const r = await fetch(
          `https://www.zohoapis.in/books/v3/invoices?organization_id=${orgId}&per_page=200&page=${page}`,
          { headers: { Authorization: `Zoho-oauthtoken ${access_token}` } }
        );
        const d = await r.json();
        if (!d.invoices || !d.invoices.length) break;
        allInvoices = [...allInvoices, ...d.invoices];
        if (!d.page_context?.has_more_page) break;
        page++;
      }
      return res.json({ success: true, source: 'invoices', count: allInvoices.length, data: allInvoices });
    }

    // ── Zoho Analytics ────────────────────────────────────────────────────────
    if (source === 'analytics') {
      const { workspace, view } = req.query;
      if (!workspace || !view) return res.status(400).json({ error: 'workspace and view required' });
      const email = encodeURIComponent(process.env.ZOHO_EMAIL);
      const url = `https://analyticsapi.zoho.in/api/${email}/${encodeURIComponent(workspace)}/${encodeURIComponent(view)}?ZOHO_ACTION=EXPORT&ZOHO_OUTPUT_FORMAT=JSON&ZOHO_API_VERSION=1.0`;
      const r = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${access_token}` } });
      const d = await r.json();
      return res.json({ success: true, source: 'analytics', data: d });
    }

    // ── Default: verify connection ────────────────────────────────────────────
    return res.json({ success: true, message: 'Zoho API connected!', token_type: tokenData.token_type });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
