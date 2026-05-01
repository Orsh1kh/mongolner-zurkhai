const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const cron = require('node-cron');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || '';

app.use(cors());
app.use(express.json());

// ✅ Static файлууд serve хийх
app.use(express.static(path.join(__dirname, 'public')));

// =============================================
// ТОГТМОЛ ӨГӨГДӨЛ
// =============================================

const SIGNS = [
  { en:'aries',       mn:'Хуц',      date:'3/21 - 4/19',  element:'Гал',    symbol:'♈' },
  { en:'taurus',      mn:'Бух',      date:'4/20 - 5/20',  element:'Газар',  symbol:'♉' },
  { en:'gemini',      mn:'Ихэр',     date:'5/21 - 6/20',  element:'Агаар',  symbol:'♊' },
  { en:'cancer',      mn:'Мэлхий',   date:'6/21 - 7/22',  element:'Ус',     symbol:'♋' },
  { en:'leo',         mn:'Арслан',   date:'7/23 - 8/22',  element:'Гал',    symbol:'♌' },
  { en:'virgo',       mn:'Онгон',    date:'8/23 - 9/22',  element:'Газар',  symbol:'♍' },
  { en:'libra',       mn:'Жин',      date:'9/23 - 10/22', element:'Агаар',  symbol:'♎' },
  { en:'scorpio',     mn:'Хилэнц',   date:'10/23 - 11/21',element:'Ус',     symbol:'♏' },
  { en:'sagittarius', mn:'Нум',      date:'11/22 - 12/21',element:'Гал',    symbol:'♐' },
  { en:'capricorn',   mn:'Матар',    date:'12/22 - 1/19', element:'Газар',  symbol:'♑' },
  { en:'aquarius',    mn:'Хувин',    date:'1/20 - 2/18',  element:'Агаар',  symbol:'♒' },
  { en:'pisces',      mn:'Загас',    date:'2/19 - 3/20',  element:'Ус',     symbol:'♓' },
];

const NAME_TO_SIGN = {
  'А':'aries','Б':'taurus','В':'gemini','Г':'cancer','Д':'leo',
  'Е':'virgo','Ж':'libra','З':'scorpio','И':'sagittarius','К':'capricorn',
  'Л':'aquarius','М':'pisces','Н':'aries','О':'taurus','Ө':'gemini',
  'П':'cancer','Р':'leo','С':'virgo','Т':'libra','У':'scorpio',
  'Ү':'sagittarius','Х':'capricorn','Ц':'aquarius','Ч':'pisces',
  'Ш':'aries','Э':'taurus','Ю':'gemini','Я':'cancer'
};

// =============================================
// CACHE
// =============================================

const cache = new Map();

function getCacheKey(sign, period) {
  const today = new Date().toISOString().split('T')[0];
  return `${sign}-${period}-${today}`;
}

function getFromCache(sign, period) {
  return cache.get(getCacheKey(sign, period)) || null;
}

function setCache(sign, period, data) {
  cache.set(getCacheKey(sign, period), data);
}

// =============================================
// AZTRO API
// =============================================

async function fetchHoroscope(sign, period = 'today') {
  try {
    const res = await fetch(`https://aztro.sameerkumar.website/?sign=${sign}&day=${period}`, { method: 'POST' });
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Aztro алдаа:', err.message);
    return null;
  }
}

// =============================================
// CLAUDE ОРЧУУЛГА
// =============================================

async function translateWithClaude(data, signMn) {
  if (!CLAUDE_API_KEY) return getFallback(data, signMn);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `Монгол хэлрүү орчуул. Зөвхөн JSON:
{"description":"...","compatibility":"...","mood":"...","color":"...","lucky_number":"${data.lucky_number}","lucky_time":"${data.lucky_time}","advice":"..."}

Орчуулах:
description: "${data.description}"
compatibility: "${data.compatibility}"
mood: "${data.mood}"
color: "${data.color}"`
        }]
      })
    });
    const json = await res.json();
    const text = json.content[0].text.replace(/```json|```/g, '').trim();
    return JSON.parse(text);
  } catch(e) {
    return getFallback(data, signMn);
  }
}

function getFallback(d, signMn) {
  const moods = {'Happy':'Баяртай','Sad':'Гунигтай','Excited':'Сэтгэл хөдлөм','Calm':'Тайван','Energetic':'Эрч хүчтэй','Romantic':'Хайрдаг','Motivated':'Урам зоригтой','Confident':'Итгэлтэй','Creative':'Бүтээлч'};
  const colors = {'Red':'Улаан','Blue':'Цэнхэр','Green':'Ногоон','Yellow':'Шар','Purple':'Нил ягаан','Orange':'Улбар шар','Pink':'Ягаан','White':'Цагаан','Black':'Хар','Gold':'Алтан'};
  return {
    description: `${signMn} тэмдэгтнүүдэд өнөөдөр шинэ боломжууд нээгдэж байна. Өөртөө итгэж урагшаа алхаарай.`,
    compatibility: d?.compatibility || 'Арслан',
    mood: moods[d?.mood] || 'Эрч хүчтэй',
    color: colors[d?.color] || (d?.color || 'Цэнхэр'),
    lucky_number: d?.lucky_number || '7',
    lucky_time: d?.lucky_time || '09:00 - 12:00',
    advice: 'Өнөөдөр эерэг сэтгэлгээтэй байж, шинэ боломжуудыг хүлээн авахад бэлэн байгаарай.'
  };
}

async function getZurkhai(signEn, signMn, period = 'today') {
  const cached = getFromCache(signEn, period);
  if (cached) return { ...cached, fromCache: true };

  const raw = await fetchHoroscope(signEn, period);
  const translated = await translateWithClaude(raw, signMn);
  const result = {
    ...translated,
    date_range: raw?.date_range || '',
    current_date: new Date().toLocaleDateString('mn-MN'),
    fromCache: false
  };
  setCache(signEn, period, result);
  return result;
}

// =============================================
// API ROUTES
// =============================================

app.get('/api/zurkhai/:sign', async (req, res) => {
  const signEn = req.params.sign.toLowerCase();
  const period = req.query.period || 'today';
  const signInfo = SIGNS.find(s => s.en === signEn);
  if (!signInfo) return res.status(404).json({ error: 'Тэмдэг олдсонгүй' });
  const data = await getZurkhai(signEn, signInfo.mn, period);
  res.json({ sign: signInfo, period, data });
});

app.get('/api/zurkhai/by-name/:name', async (req, res) => {
  const name = req.params.name;
  const first = name[0]?.toUpperCase() || 'А';
  const signEn = NAME_TO_SIGN[first] || 'aries';
  const signInfo = SIGNS.find(s => s.en === signEn);
  const period = req.query.period || 'today';
  const data = await getZurkhai(signEn, signInfo.mn, period);
  res.json({ name, sign: signInfo, period, data });
});

app.get('/api/signs', (req, res) => res.json({ signs: SIGNS }));

app.get('/health', (req, res) => res.json({ status: 'ok', cache: cache.size, signs: SIGNS.length }));

// ✅ SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Cron: өглөө 06:00
cron.schedule('0 6 * * *', async () => {
  console.log('Өглөөний зурхай татаж байна...');
  for (const sign of SIGNS) {
    await getZurkhai(sign.en, sign.mn, 'today');
    await new Promise(r => setTimeout(r, 500));
  }
}, { timezone: 'Asia/Ulaanbaatar' });

app.listen(PORT, () => {
  console.log(`🌟 МонголНэр Зурхай: http://localhost:${PORT}`);
  console.log(`Claude API: ${CLAUDE_API_KEY ? '✅ холбогдсон' : 'байхгүй (fallback)'}`);
});
