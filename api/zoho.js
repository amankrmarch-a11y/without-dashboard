export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    // Step 1: Get fresh access token using refresh token
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

    // Step 2: Determine which data to fetch
    const { source } = req.query;

    if (source === 'crm') {
      // Fetch CRM Deals from Zoho CRM
      const crmRes = await fetch(
        'https://www.zohoapis.in/crm/v3/Deals?fields=Deal_Name,Account_Name,Stage,Deal_Type_B2B_B2C_etc,Amount,Closing_Date,Created_Time,Owner&per_page=200',
        { headers: { Authorization: `Zoho-oauthtoken ${access_token}` } }
      );
      const crmData = await crmRes.json();
      return res.json({ success: true, source: 'crm', data: crmData });
    }

    if (source === 'invoices') {
      // Fetch Invoices from Zoho Books
      const email = process.env.ZOHO_EMAIL;
      // First get org ID
      const orgRes = await fetch('https://www.zohoapis.in/books/v3/organizations', {
        headers: { Authorization: `Zoho-oauthtoken ${access_token}` }
      });
      const orgData = await orgRes.json();
      const orgId = orgData.organizations?.[0]?.organization_id;
      if (!orgId) return res.status(400).json({ error: 'No org found', details: orgData });

      const invRes = await fetch(
        `https://www.zohoapis.in/books/v3/invoices?organization_id=${orgId}&status=paid,overdue&per_page=200`,
        { headers: { Authorization: `Zoho-oauthtoken ${access_token}` } }
      );
      const invData = await invRes.json();
      return res.json({ success: true, source: 'invoices', data: invData });
    }

    if (source === 'analytics') {
      // Fetch from Zoho Analytics workspace
      const { workspace, view } = req.query;
      if (!workspace || !view) return res.status(400).json({ error: 'workspace and view required' });
      const email = encodeURIComponent(process.env.ZOHO_EMAIL);
      const ws = encodeURIComponent(workspace);
      const vw = encodeURIComponent(view);
      const url = `https://analyticsapi.zoho.in/api/${email}/${ws}/${vw}?ZOHO_ACTION=EXPORT&ZOHO_OUTPUT_FORMAT=JSON&ZOHO_API_VERSION=1.0`;
      const analyticsRes = await fetch(url, {
        headers: { Authorization: `Zoho-oauthtoken ${access_token}` }
      });
      const analyticsData = await analyticsRes.json();
      return res.json({ success: true, source: 'analytics', data: analyticsData });
    }

    // Default: just verify connection works
    return res.json({ success: true, message: 'Zoho API connected!', token_type: tokenData.token_type });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
