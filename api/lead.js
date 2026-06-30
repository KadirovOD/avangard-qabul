// Vercel serverless function — Avangard School qabul forma → amoCRM
// Vercel env vars (Settings → Environment Variables):
//   AMOCRM_SUBDOMAIN      — masalan, "avangard"  (avangard.amocrm.ru dan)
//   AMOCRM_ACCESS_TOKEN   — long-lived integratsiya tokeni
//   AMOCRM_PIPELINE_ID    — (ixtiyoriy) bo'sh bo'lsa default pipeline
//   AMOCRM_STATUS_ID      — (ixtiyoriy) bosqich ID
//   AMOCRM_RESPONSIBLE_ID — (ixtiyoriy) mas'ul foydalanuvchi ID

export default async function handler(req, res) {
  // CORS — har qanday origin'dan ruxsat (forma boshqa domainda bo'lsa ham ishlasin)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const { name, phone, address, grade, gradeLabel } = body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'name va phone majburiy' });
  }

  const SUB = process.env.AMOCRM_SUBDOMAIN;
  const TOKEN = process.env.AMOCRM_ACCESS_TOKEN;
  const PIPELINE_ID = process.env.AMOCRM_PIPELINE_ID;
  const STATUS_ID = process.env.AMOCRM_STATUS_ID;
  const RESPONSIBLE_ID = process.env.AMOCRM_RESPONSIBLE_ID;

  // amoCRM credentials yo'q bo'lsa, qabul qilamiz va console'ga yozamiz
  // (foydalanuvchi env vars'larni keyinroq qo'shganda ishlay boshlaydi)
  if (!SUB || !TOKEN) {
    console.warn('[amoCRM] AMOCRM_SUBDOMAIN yoki AMOCRM_ACCESS_TOKEN o\'rnatilmagan');
    console.log('[lead]', { name, phone, address, grade, gradeLabel, ts: new Date().toISOString() });
    return res.status(200).json({ ok: true, mode: 'logged', warning: 'amoCRM not configured' });
  }

  try {
    // JWT'dan api_domain'ni o'qib olamiz (amoCRM data-center subdomain'i)
    // Long-lived token misol: header.payload.signature — payload base64url
    let apiDomain = `${SUB}.amocrm.ru`;
    try {
      const payload = JSON.parse(Buffer.from(TOKEN.split('.')[1], 'base64').toString());
      if (payload.api_domain) apiDomain = payload.api_domain;
      console.log('[amoCRM] JWT api_domain:', payload.api_domain, 'account_id:', payload.account_id);
    } catch (e) {
      console.warn('[amoCRM] JWT parse failed, falling back to subdomain:', e.message);
    }
    const baseUrl = `https://${apiDomain}`;
    console.log('[amoCRM] Using baseUrl:', baseUrl);

    // 1) Contact yaratish (telefon + manzil)
    const contactBody = [{
      name,
      custom_fields_values: [
        {
          field_code: 'PHONE',
          values: [{ value: phone, enum_code: 'MOB' }],
        },
        ...(address ? [{
          field_code: 'ADDRESS',
          values: [{ value: address }],
        }] : []),
      ],
    }];

    const contactRes = await fetch(`${baseUrl}/api/v4/contacts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contactBody),
    });

    if (!contactRes.ok) {
      const err = await contactRes.text();
      console.error('[amoCRM] Contact create failed:', contactRes.status, err);
      return res.status(502).json({ error: 'amoCRM contact create failed', status: contactRes.status, detail: err.slice(0, 500) });
    }

    const contactJson = await contactRes.json();
    const contactId = contactJson._embedded?.contacts?.[0]?.id;

    // 2) Lead yaratish (contact bilan bog'langan)
    const lead = {
      name: `Qabul: ${name} — ${gradeLabel || grade + '-sinf'}`,
      ...(PIPELINE_ID && { pipeline_id: Number(PIPELINE_ID) }),
      ...(STATUS_ID && { status_id: Number(STATUS_ID) }),
      ...(RESPONSIBLE_ID && { responsible_user_id: Number(RESPONSIBLE_ID) }),
      _embedded: {
        contacts: contactId ? [{ id: contactId }] : [],
        tags: [
          { name: 'Veb-sayt qabul' },
          { name: gradeLabel || `${grade}-sinf` },
        ],
      },
    };

    const leadRes = await fetch(`${baseUrl}/api/v4/leads`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([lead]),
    });

    if (!leadRes.ok) {
      const err = await leadRes.text();
      console.error('[amoCRM] Lead create failed:', leadRes.status, err);
      return res.status(502).json({ error: 'amoCRM lead create failed', status: leadRes.status, detail: err.slice(0, 500) });
    }

    const leadJson = await leadRes.json();
    const leadId = leadJson._embedded?.leads?.[0]?.id;

    // 3) Note qo'shish (manzil, sinf va boshqa qo'shimcha ma'lumotlar)
    if (leadId) {
      const noteText = [
        `🎓 Yangi qabul anketasi`,
        `👤 ${name}`,
        `📞 ${phone}`,
        address ? `📍 ${address}` : null,
        gradeLabel ? `📚 ${gradeLabel}` : null,
        `🕒 ${new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}`,
      ].filter(Boolean).join('\n');

      await fetch(`${baseUrl}/api/v4/leads/${leadId}/notes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{
          note_type: 'common',
          params: { text: noteText },
        }]),
      }).catch(e => console.warn('[amoCRM] Note create failed:', e.message));
    }

    return res.status(200).json({ ok: true, leadId, contactId });
  } catch (err) {
    console.error('[amoCRM] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
