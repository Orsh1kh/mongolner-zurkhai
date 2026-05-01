const API = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : 'https://mongolner-zurkhai.onrender.com';

const SIGNS = [
  { en:'aries',       mn:'Хуц',      date:'3/21-4/19',  element:'Гал',    symbol:'♈' },
  { en:'taurus',      mn:'Бух',      date:'4/20-5/20',  element:'Газар',  symbol:'♉' },
  { en:'gemini',      mn:'Ихэр',     date:'5/21-6/20',  element:'Агаар',  symbol:'♊' },
  { en:'cancer',      mn:'Мэлхий',   date:'6/21-7/22',  element:'Ус',     symbol:'♋' },
  { en:'leo',         mn:'Арслан',   date:'7/23-8/22',  element:'Гал',    symbol:'♌' },
  { en:'virgo',       mn:'Онгон',    date:'8/23-9/22',  element:'Газар',  symbol:'♍' },
  { en:'libra',       mn:'Жин',      date:'9/23-10/22', element:'Агаар',  symbol:'♎' },
  { en:'scorpio',     mn:'Хилэнц',   date:'10/23-11/21',element:'Ус',     symbol:'♏' },
  { en:'sagittarius', mn:'Нум',      date:'11/22-12/21',element:'Гал',    symbol:'♐' },
  { en:'capricorn',   mn:'Матар',    date:'12/22-1/19', element:'Газар',  symbol:'♑' },
  { en:'aquarius',    mn:'Хувин',    date:'1/20-2/18',  element:'Агаар',  symbol:'♒' },
  { en:'pisces',      mn:'Загас',    date:'2/19-3/20',  element:'Ус',     symbol:'♓' },
];

const NAME_TO_SIGN = {
  'А':'aries','Б':'taurus','В':'gemini','Г':'cancer','Д':'leo',
  'Е':'virgo','Ж':'libra','З':'scorpio','И':'sagittarius','К':'capricorn',
  'Л':'aquarius','М':'pisces','Н':'aries','О':'taurus','Ө':'gemini',
  'П':'cancer','Р':'leo','С':'virgo','Т':'libra','У':'scorpio',
  'Ү':'sagittarius','Х':'capricorn','Ц':'aquarius','Ч':'pisces',
  'Ш':'aries','Э':'taurus','Ю':'gemini','Я':'cancer'
};

let currentPeriod = 'today';
let activeSign = null;

// Огноо харуулах
function updateDateBadge() {
  const d = new Date();
  const opts = { year:'numeric', month:'long', day:'numeric', weekday:'long' };
  document.getElementById('todayBadge').textContent =
    d.toLocaleDateString('mn-MN', opts);
}

// Бүх картыг зурах
function renderSignCards() {
  const grid = document.getElementById('signsGrid');
  grid.innerHTML = SIGNS.map(s => `
    <div class="sign-card" id="card-${s.en}" onclick="loadSignDetail('${s.en}')">
      <div class="sign-symbol">${s.symbol}</div>
      <div class="sign-name-mn">${s.mn}</div>
      <div class="sign-date">${s.date}</div>
      <div class="sign-element">${s.element}</div>
      <div class="sign-mood" id="mood-${s.en}">
        <div class="sign-loading"><div class="mini-spinner"></div></div>
      </div>
    </div>
  `).join('');
}

// Бүх тэмдгийн mood татах
async function loadAllMoods() {
  for (const sign of SIGNS) {
    try {
      const res = await fetch(`${API}/api/zurkhai/${sign.en}?period=${currentPeriod}`);
      if (res.ok) {
        const json = await res.json();
        const el = document.getElementById(`mood-${sign.en}`);
        if (el) el.textContent = json.data?.mood || '—';
      }
    } catch(e) {
      const el = document.getElementById(`mood-${sign.en}`);
      if (el) el.textContent = 'Эрч хүчтэй';
    }
    await new Promise(r => setTimeout(r, 200));
  }
}

// Дэлгэрэнгүй зурхай ачаалах
async function loadSignDetail(signEn) {
  const sign = SIGNS.find(s => s.en === signEn);
  if (!sign) return;

  // Active card
  document.querySelectorAll('.sign-card').forEach(c => c.classList.remove('active'));
  const card = document.getElementById(`card-${signEn}`);
  if (card) { card.classList.add('active'); card.scrollIntoView({ behavior:'smooth', block:'nearest' }); }

  activeSign = signEn;
  const detail = document.getElementById('detailView');
  detail.className = 'detail-view';
  detail.innerHTML = `<div class="loading-all"><div class="spinner"></div><p>${sign.mn} зурхай ачааллаж байна...</p></div>`;
  detail.scrollIntoView({ behavior:'smooth', block:'start' });

  try {
    const res = await fetch(`${API}/api/zurkhai/${signEn}?period=${currentPeriod}`);
    const json = await res.json();
    const d = json.data;

    const periodLabel = { today:'Өнөөдрийн', tomorrow:'Маргаашийн', yesterday:'Өчигдрийн' }[currentPeriod];

    detail.innerHTML = `
    <h3 style="font-family:'Playfair Display',serif;font-size:18px;margin-bottom:1rem;color:var(--muted)">${periodLabel} зурхай</h3>
    <div class="detail-card">
      <div class="detail-top">
        <div class="detail-sign-row">
          <div class="detail-symbol">${sign.symbol}</div>
          <div>
            <div class="detail-name">${sign.mn}</div>
            <div class="detail-date">${sign.date}</div>
          </div>
        </div>
        <div class="detail-tags">
          <span class="dtag">${sign.element}</span>
          <span class="dtag">${d.mood || 'Эрч хүчтэй'}</span>
          <span class="dtag">🍀 ${d.lucky_number || '7'}</span>
        </div>
      </div>

      <div class="detail-desc">${d.description || 'Өнөөдөр шинэ боломжууд нээгдэж байна. Өөртөө итгэж урагшаа алхаарай.'}</div>

      <div class="detail-grid">
        <div class="detail-cell">
          <div class="dc-label">Нийцэл</div>
          <div class="dc-val">${d.compatibility || '—'}</div>
        </div>
        <div class="detail-cell">
          <div class="dc-label">Азтай цаг</div>
          <div class="dc-val">${d.lucky_time || '—'}</div>
        </div>
        <div class="detail-cell">
          <div class="dc-label">Азтай өнгө</div>
          <div class="dc-val">${d.color || '—'}</div>
        </div>
      </div>

      <div class="advice-section">
        <div class="advice-block">
          <div class="advice-label">Өнөөдрийн зөвлөгөө</div>
          ${d.advice || 'Эерэг сэтгэлгээтэй байж, шинэ боломжуудыг хүлээн авахад бэлэн байгаарай.'}
        </div>
      </div>

      <div class="detail-actions">
        <button class="btn-act" onclick="shareSign('${sign.mn}', '${signEn}')">🔗 Хуваалцах</button>
        <button class="btn-act gold" onclick="openModal()">✦ Дэлгэрэнгүй</button>
      </div>
    </div>`;

  } catch(e) {
    detail.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--muted)">Холболтын алдаа гарлаа. Дахин оролдоно уу.</div>`;
  }
}

// Нэрээр хайх
async function searchByName() {
  const name = document.getElementById('nameInput').value.trim();
  if (!name) return;

  const first = name[0].toUpperCase();
  const signEn = NAME_TO_SIGN[first] || 'aries';
  const sign = SIGNS.find(s => s.en === signEn);

  alert(`"${name}" нэр → ${sign?.mn || signEn} тэмдэгт харгалзана`);
  loadSignDetail(signEn);
}

// Period солих
function setPeriod(period, btn) {
  currentPeriod = period;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderSignCards();
  loadAllMoods();
  if (activeSign) loadSignDetail(activeSign);
}

// Хуваалцах
function shareSign(name, signEn) {
  const url = location.href.split('?')[0] + '?sign=' + signEn;
  if (navigator.share) { navigator.share({ title:`${name} — Өнөөдрийн зурхай`, url }); }
  else { navigator.clipboard?.writeText(url); alert('Линк хуулагдлаа!'); }
}

function openModal() { document.getElementById('modal').classList.add('open'); }
function closeModal() { document.getElementById('modal').classList.remove('open'); }
function handlePay() { alert('QPay холболт тун удахгүй!\ninfo@mongolner.mn'); closeModal(); }

document.getElementById('nameInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') searchByName();
});

// URL-с тэмдэг унших
const params = new URLSearchParams(location.search);
if (params.get('sign')) {
  setTimeout(() => loadSignDetail(params.get('sign')), 1000);
}

// Эхлүүлэх
updateDateBadge();
renderSignCards();
loadAllMoods();
