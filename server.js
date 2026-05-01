const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3001;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || '';

app.use(cors());
app.use(express.json());

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

// Нэрийн эхний үсгээр бурхан зурхайн тэмдэг тогтоох
const NAME_TO_SIGN = {
  'А':'aries','Б':'taurus','В':'gemini','Г':'cancer','Д':'leo',
  'Е':'virgo','Ж':'libra','З':'scorpio','И':'sagittarius','К':'capricorn',
  'Л':'aquarius','М':'pisces','Н':'aries','О':'taurus','Ө':'gemini',
  'П':'cancer','Р':'leo','С':'virgo','Т':'libra','У':'scorpio',
  'Ү':'sagittarius','Х':'capricorn','Ц':'aquarius','Ч':'pisces',
  'Ш':'aries','Э':'taurus','Ю':'gemini','Я':'cancer'
};

// =============================================
// CACHE СИСТЕМ
// =============================================

const cache = new Map();

function getCacheKey(sign, period) {
  const today = new Date().toISOString().split('T')[0];
  return `${sign}-${period}-${today}`;
}

function getFromCache(sign, period) {
  const key = getCacheKey(sign, period);
  return cache.get(key) || null;
}

function setCache(sign, period, data) {
  const key = getCacheKey(sign, period);
  cache.set(key, data);
  console.log(`Cache хадгалав: ${key}`);
}

// =============================================
// AZTRO API - ЗУРХАЙ ТАТАХ
// =============================================

async function fetchHoroscope(sign, period = 'today') {
  try {
    const url = `https://aztro.sameerkumar.website/?sign=${sign}&day=${period}`;
    const res = await fetch(url, { method: 'POST' });
    if (!res.ok) throw new Error(`Aztro API алдаа: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Aztro fetch алдаа:', err.message);
    return null;
  }
}

// =============================================
// CLAUDE API - МОНГОЛ ОРЧУУЛГА
// =============================================

async function translateWithClaude(horoscopeData, signMn) {
  if (!CLAUDE_API_KEY) {
    return getFallbackTranslation(horoscopeData, signMn);
  }

  try {
    const prompt = `Та монгол хэлний мэргэжлийн орчуулагч. 
Дараах зурхайн мэдээллийг монгол хэлрүү орчуулна уу. 
Орчуулга нь уран яруу, монгол уншигчид ойлгомжтой байх ёстой.
Зөвхөн JSON форматаар хариулна уу, тайлбар хэрэггүй.

Орчуулах мэдээлэл:
- description: "${horoscopeData.description}"
- compatibility: "${horoscopeData.compatibility}"
- mood: "${horoscopeData.mood}"
- color: "${horoscopeData.color}"
- lucky_number: "${horoscopeData.lucky_number}"
- lucky_time: "${horoscopeData.lucky_time}"

JSON форматаар хариулна уу:
{
  "description": "монгол орчуулга",
  "compatibility": "монгол нэр",
  "mood": "монгол үг",
  "color": "монгол өнгө",
  "lucky_number": "${horoscopeData.lucky_number}",
  "lucky_time": "${horoscopeData.lucky_time}",
  "advice": "нэмэлт зөвлөгөө монголоор"
}`;

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
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await res.json();
    const text = data.content[0].text;
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error('Claude API алдаа:', err.message);
    return getFallbackTranslation(horoscopeData, signMn);
  }
}

// Claude API байхгүй үед орлуулах
function getFallbackTranslation(d, signMn) {
  const moods = { 'Happy':'Баяртай', 'Sad':'Гунигтай', 'Excited':'Сэтгэл хөдлөм', 'Calm':'Тайван', 'Energetic':'Эрч хүчтэй', 'Romantic':'Хайрдаг', 'Confused':'Эргэлзэж байна', 'Motivated':'Урам зоригтой', 'Anxious':'Сандарч байна', 'Confident':'Итгэлтэй', 'Creative':'Бүтээлч', 'Productive':'Бүтээмжтэй' };
  const colors = { 'Red':'Улаан', 'Blue':'Цэнхэр', 'Green':'Ногоон', 'Yellow':'Шар', 'Purple':'Нил ягаан', 'Orange':'Улбар шар', 'Pink':'Ягаан', 'White':'Цагаан', 'Black':'Хар', 'Gold':'Алтан', 'Silver':'Мөнгөн' };
  return {
    description: `${signMn} тэмдэгтнүүдэд өнөөдөр шинэ боломжууд нээгдэж байна. Өөртөө итгэж, урагшаа зоригтой алхаарай. Ойр дотны хүмүүс таны дэмжлэг болно.`,
    compatibility: d.compatibility || 'Арслан',
    mood: moods[d.mood] || 'Эрч хүчтэй',
    color: colors[d.color] || d.color,
    lucky_number: d.lucky_number || '7',
    lucky_time: d.lucky_time || '09:00 - 12:00',
    advice: 'Өнөөдөр эерэг сэтгэлгээтэй байж, шинэ боломжуудыг хүлээн авахад бэлэн байгаарай.'
  };
}

// =============================================
// БҮРЭН ЗУРХАЙ ТАТАХ + ОРЧУУЛАХ
// =============================================

async function getZurkhai(signEn, signMn, period = 'today') {
  const cached = getFromCache(signEn, period);
  if (cached) {
    console.log(`Cache-с буцаав: ${signEn} ${period}`);
    return { ...cached, fromCache: true };
  }

  console.log(`API-с татаж байна: ${signEn} ${period}...`);
  const raw = await fetchHoroscope(signEn, period);

  if (!raw) {
    const fallback = getFallbackTranslation({}, signMn);
    return { ...fallback, date_range: '', current_date: new Date().toLocaleDateString('mn-MN') };
  }

  const translated = await translateWithClaude(raw, signMn);
  const result = {
    ...translated,
    date_range: raw.date_range || '',
    current_date: raw.current_date || new Date().toLocaleDateString('mn-MN'),
    fromCache: false
  };

  setCache(signEn, period, result);
  return result;
}

// =============================================
// API ENDPOINTS
// =============================================

// GET /api/zurkhai/:sign?period=today|tomorrow|yesterday
app.get('/api/zurkhai/:sign', async (req, res) => {
  const signEn = req.params.sign.toLowerCase();
  const period = req.query.period || 'today';
  const signInfo = SIGNS.find(s => s.en === signEn);

  if (!signInfo) {
    return res.status(404).json({ error: 'Тэмдэг олдсонгүй', available: SIGNS.map(s => s.en) });
  }

  const data = await getZurkhai(signEn, signInfo.mn, period);
  res.json({ sign: signInfo, period, data });
});

// GET /api/zurkhai/by-name/:name — нэрээр зурхай олох
app.get('/api/zurkhai/by-name/:name', async (req, res) => {
  const name = req.params.name;
  const firstLetter = name[0]?.toUpperCase() || 'А';
  const signEn = NAME_TO_SIGN[firstLetter] || 'aries';
  const signInfo = SIGNS.find(s => s.en === signEn);
  const period = req.query.period || 'today';

  const data = await getZurkhai(signEn, signInfo.mn, period);
  res.json({ name, sign: signInfo, period, data });
});

// GET /api/signs — бүх тэмдэгүүдийн жагсаалт
app.get('/api/signs', (req, res) => {
  res.json({ signs: SIGNS });
});

// GET /api/zurkhai/all/today — өдрийн бүх зурхай
app.get('/api/all/today', async (req, res) => {
  const results = [];
  for (const sign of SIGNS) {
    const data = await getZurkhai(sign.en, sign.mn, 'today');
    results.push({ sign, data });
  }
  res.json({ date: new Date().toLocaleDateString('mn-MN'), results });
});

// GET /health
app.get('/health', (req, res) => {
  res.json({ status: 'ok', cache_size: cache.size, signs: SIGNS.length });
});

// =============================================
// CRON JOB — Өглөө 06:00-д автоматаар татна
// =============================================

cron.schedule('0 6 * * *', async () => {
  console.log('🌅 Өглөөний зурхай татаж байна...');
  for (const sign of SIGNS) {
    await getZurkhai(sign.en, sign.mn, 'today');
    await new Promise(r => setTimeout(r, 500)); // Rate limit
  }
  console.log('✅ Бүх зурхай cache-д хадгалагдлаа');
}, { timezone: 'Asia/Ulaanbaatar' });

app.listen(PORT, () => {
  console.log(`🌟 МонголНэр Зурхай API: http://localhost:${PORT}`);
  console.log(`🔑 Claude API: ${CLAUDE_API_KEY ? 'холбогдсон ✅' : 'байхгүй (fallback ашиглана)'}`);
});
