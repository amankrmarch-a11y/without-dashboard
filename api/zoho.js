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
    const td = await tokenRes.json();
    if (!td.access_token) return res.status(401).json({ error: 'Token failed' });
    const token = td.access_token;
    const { source } = req.query;
    const WS = '172632000001964001';
    const ORG = process.env.ZOHO_ANALYTICS_ORG_ID || '';
    const VIEWS = {
      crm:      '172632000001964013',
      meta:     '172632000001964071',
      linkedin: '172632000001964086',
      google:   '172632000001964061',
      invoices: '172632000001967250',
    };

    if (VIEWS[source]) {
      const r = await fetch(
        `https://analyticsapi.zoho.in/restapi/v2/workspaces/${WS}/views/${VIEWS[source]}/data?responseFormat=json`,
        { headers: { Authorization: `Zoho-oauthtoken ${token}`, 'ZANALYTICS-ORGID': ORG } }
      );
      const d = await r.json();
      return res.json({ success: true, source, data: d });
    }

    return res.json({ success: true, message: 'v5 ready', views: VIEWS });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}