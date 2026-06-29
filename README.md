# Avangard School — Qabul forma

Avangard School maktabiga onlayn qabul anketasi. Lidlar **amoCRM** ga avtomatik yo'naltiriladi.

## Live

Vercel'da deploy qilingan: (deploydan keyin URL bu yerda ko'rinadi)

## Struktura

```
qabul/
├─ index.html          ← qabul anketasi (statik, mobil-first)
├─ logo.png            ← Avangard School emblema
├─ api/
│  └─ lead.js          ← Vercel serverless → amoCRM API ga forward qiladi
├─ vercel.json
└─ package.json
```

## amoCRM integratsiya — Vercel env vars

Vercel Dashboard → Project → Settings → Environment Variables:

| Nom | Qiymat | Majburiy |
|---|---|---|
| `AMOCRM_SUBDOMAIN` | `avangard` (avangard.amocrm.ru dan) | ✅ |
| `AMOCRM_ACCESS_TOKEN` | Long-lived integratsiya tokeni | ✅ |
| `AMOCRM_PIPELINE_ID` | Voronka ID (raqam) | ✗ |
| `AMOCRM_STATUS_ID` | Bosqich ID | ✗ |
| `AMOCRM_RESPONSIBLE_ID` | Mas'ul foydalanuvchi ID | ✗ |

### Long-lived token olish (amoCRM):

1. amoCRM kirish → **Sozlamalar** → **Integratsiyalar** → **+ Yaratish o'z integratsiyangiz**
2. Nom: "Avangard Qabul Forma", Tavsif ixtiyoriy
3. Faqat **Kirish huquqi** kerak (Webhook URL bo'sh qoldiring)
4. Yaratgandan keyin **Long-lived token** generatsiya qiling → uni `AMOCRM_ACCESS_TOKEN` ga qo'ying

Env vars o'rnatilmagan bo'lsa, forma ishlay beradi (foydalanuvchiga muvaffaqiyat ekrani), lekin lid faqat Vercel log'larida ko'rinadi.

## Lokal ishga tushirish

```bash
npx vercel dev
# yoki oddiy statik server (api ishlmaydi):
python3 -m http.server 8766
```

## Deploy

```bash
vercel --prod
```
