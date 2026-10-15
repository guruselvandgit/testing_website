/* ============ CONFIG ============ */
const CURRENCY = '₹';

/* ============ "DATABASE" (browser localStorage) ============ */
const BIKES = [
  { id: 'r1', name: 'Apex Road 21',     type: 'Road',     rate: 600,  color: '#d6452d', specs: '21-speed · Aluminium · M/L' },
  { id: 'r2', name: 'Velo Sprint',      type: 'Road',     rate: 750,  color: '#14746f', specs: '24-speed · Carbon fork · M' },
  { id: 'm1', name: 'Ridge Trail 29',   type: 'Mountain', rate: 700,  color: '#2f6b3a', specs: '27-speed · Front suspension' },
  { id: 'm2', name: 'Boulder Pro',      type: 'Mountain', rate: 900,  color: '#7a3fb0', specs: '30-speed · Disc brakes' },
  { id: 'c1', name: 'Harbor City',      type: 'City',     rate: 350,  color: '#e08a00', specs: '7-speed · Basket · Step-through' },
  { id: 'c2', name: 'Lane Cruiser',     type: 'City',     rate: 400,  color: '#2b5fb8', specs: '3-speed · Rear rack' },
  { id: 'e1', name: 'Volt Commuter',    type: 'Electric', rate: 1100, color: '#10222f', specs: '60 km range · Pedal assist' },
  { id: 'e2', name: 'Volt Trail E',     type: 'Electric', rate: 1400, color: '#b3261e', specs: '80 km range · Mountain tyres' },
];

const DB = {
  key: 'spokeandgo.bookings',
  all() {
    try { return JSON.parse(localStorage.getItem(this.key)) || []; }
    catch { return []; }
  },
  save(list) { localStorage.setItem(this.key, JSON.stringify(list)); },
};

/* ============ BACKEND OPERATIONS ============ */
const API = {
  // Dates are 'YYYY-MM-DD' strings, so string comparison works.
  isAvailable(bikeId, start, end) {
    return !DB.all().some(b =>
      b.bikeId === bikeId && b.status === 'active' && start <= b.end && end >= b.start);
  },
  days(start, end) {
    return Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
  },
  quote(bike, start, end) {
    return this.days(start, end) * bike.rate;
  },
  createBooking({ bikeId, name, phone, start, end }) {
    const bike = BIKES.find(b => b.id === bikeId);
    if (!bike) throw new Error('Bike not found.');
    if (end < start) throw new Error('Return date must be on or after pick-up date.');
    if (!this.isAvailable(bikeId, start, end))
      throw new Error('This bike is already booked for those dates. Try other dates.');
    const booking = {
      id: 'SG-' + Math.random().toString(36).slice(2, 7).toUpperCase(),
      bikeId, name: name.trim(), phone: phone.replace(/\s/g, ''),
      start, end, total: this.quote(bike, start, end),
      status: 'active', createdAt: new Date().toISOString(),
    };
    const list = DB.all(); list.push(booking); DB.save(list);
    return booking;
  },
  findByPhone(phone) {
    const p = phone.replace(/\s/g, '');
    return DB.all().filter(b => b.phone === p).sort((a, b) => b.start.localeCompare(a.start));
  },
  cancel(id) {
    const list = DB.all();
    const b = list.find(x => x.id === id);
    if (b) { b.status = 'cancelled'; DB.save(list); }
  },
};

/* ============ BIKE IMAGES (inline SVG, no downloads needed) ============ */
function spokes(cx, cy) {
  let s = '';
  for (let a = 0; a < 180; a += 30) {
    const r = a * Math.PI / 180, dx = 27 * Math.cos(r), dy = 27 * Math.sin(r);
    s += `<line x1="${cx - dx}" y1="${cy - dy}" x2="${cx + dx}" y2="${cy + dy}"/>`;
  }
  return s;
}

function bikeSVG(b) {
  const c = b.color, thick = b.type === 'Mountain' ? 7 : 5;
  const bars = b.type === 'Road'
    ? `<path d="M138 42 L134 32 Q146 30 148 42" fill="none" stroke="#10222f" stroke-width="3.5" stroke-linecap="round"/>`
    : `<path d="M138 42 L132 30 L148 30" fill="none" stroke="#10222f" stroke-width="3.5" stroke-linecap="round"/>`;
  const extra =
    b.type === 'Electric' ? `<rect x="80" y="52" width="26" height="12" rx="3" fill="#ffb81c" stroke="#10222f" stroke-width="2"/>` :
    b.type === 'City'     ? `<path d="M144 24 h26 l-4 14 h-18z" fill="none" stroke="#10222f" stroke-width="2.5"/>` :
    b.type === 'Mountain' ? `<path d="M138 42 L152 66" stroke="#10222f" stroke-width="4" stroke-linecap="round"/>` : '';
  return `
  <svg viewBox="0 0 200 120" role="img" aria-label="${b.name} ${b.type} bike">
    <g class="wheel"><circle cx="45" cy="80" r="30" class="tire" style="stroke-width:${thick}"/><g class="spokes">${spokes(45, 80)}</g></g>
    <g class="wheel"><circle cx="155" cy="80" r="30" class="tire" style="stroke-width:${thick}"/><g class="spokes">${spokes(155, 80)}</g></g>
    <path d="M45 80 L90 80 L78 42 L138 42 L90 80 M45 80 L78 42 M138 42 L155 80"
          fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    ${extra}${bars}
    <path d="M68 38 L88 38" stroke="#10222f" stroke-width="5" stroke-linecap="round"/>
    <circle cx="90" cy="80" r="6" fill="#10222f"/>
  </svg>`;
}

/* ============ UI ============ */
const $ = s => document.querySelector(s);
let currentBike = null;

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3800);
}

function renderFleet(type = 'all') {
  const list = BIKES.filter(b => type === 'all' || b.type === type);
  $('#bikeGrid').innerHTML = list.map((b, i) => `
    <article class="card" style="animation-delay:${i * 60}ms">
      <div class="pic">${bikeSVG(b)}</div>
      <div class="info">
        <h3>${b.name}</h3>
        <span class="meta">${b.type} · ${b.specs}</span>
        <div class="foot">
          <span class="price">${CURRENCY}${b.rate} <small>/ day</small></span>
          <button class="btn btn-ink btn-sm" data-book="${b.id}">Book</button>
        </div>
      </div>
    </article>`).join('');
}

/* hero wheel spokes */
document.querySelectorAll('.hero-bike .wheel').forEach((w, i) => {
  w.querySelector('.spokes').innerHTML = spokes(i === 0 ? 45 : 155, 80);
});

/* filters */
$('#filters').addEventListener('click', e => {
  const chip = e.target.closest('.chip'); if (!chip) return;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  renderFleet(chip.dataset.type);
});

/* open booking dialog */
$('#bikeGrid').addEventListener('click', e => {
  const btn = e.target.closest('[data-book]'); if (!btn) return;
  currentBike = BIKES.find(b => b.id === btn.dataset.book);
  $('#dlgTitle').textContent = `${currentBike.name} · ${CURRENCY}${currentBike.rate}/day`;
  $('#dlgBike').innerHTML = bikeSVG(currentBike);
  const today = new Date().toISOString().slice(0, 10);
  $('#fStart').min = $('#fEnd').min = today;
  $('#fStart').value = $('#fEnd').value = '';
  $('#formMsg').textContent = ''; $('#fTotal').textContent = '–';
  $('#bookDialog').showModal();
});
$('#closeDlg').addEventListener('click', () => $('#bookDialog').close());

/* live price + availability check */
function updateQuote() {
  const s = $('#fStart').value, e = $('#fEnd').value, msg = $('#formMsg');
  msg.textContent = '';
  if (s) $('#fEnd').min = s;
  if (!s || !e) { $('#fTotal').textContent = '–'; return; }
  if (e < s) { msg.textContent = 'Return date must be on or after pick-up date.'; $('#fTotal').textContent = '–'; return; }
  const n = API.days(s, e);
  $('#fTotal').textContent = `${CURRENCY}${API.quote(currentBike, s, e)} (${n} day${n > 1 ? 's' : ''})`;
  if (!API.isAvailable(currentBike.id, s, e)) msg.textContent = 'Not available for these dates.';
}
$('#fStart').addEventListener('change', updateQuote);
$('#fEnd').addEventListener('change', updateQuote);

/* submit booking */
$('#bookForm').addEventListener('submit', e => {
  e.preventDefault();
  try {
    const booking = API.createBooking({
      bikeId: currentBike.id, name: $('#fName').value, phone: $('#fPhone').value,
      start: $('#fStart').value, end: $('#fEnd').value,
    });
    $('#bookDialog').close();
    $('#bookForm').reset();
    toast(`Booked! Your ID is ${booking.id}. Total ${CURRENCY}${booking.total}.`);
  } catch (err) {
    $('#formMsg').textContent = err.message;
  }
});

/* my bookings */
function renderBookings(phone) {
  const list = API.findByPhone(phone), box = $('#bookingList');
  if (!list.length) { box.innerHTML = `<p class="empty">No bookings found for this number.</p>`; return; }
  box.innerHTML = list.map(b => {
    const bike = BIKES.find(x => x.id === b.bikeId);
    return `<div class="booking">
      <div><span class="id">${b.id} · ${bike ? bike.name : 'Bike'}</span>
        <small>${b.start} to ${b.end} · ${CURRENCY}${b.total} · ${b.status}</small></div>
      ${b.status === 'active' ? `<button class="btn btn-sm cancel" data-cancel="${b.id}">Cancel</button>` : ''}
    </div>`;
  }).join('');
}
$('#lookupForm').addEventListener('submit', e => { e.preventDefault(); renderBookings($('#lookupPhone').value); });
$('#bookingList').addEventListener('click', e => {
  const btn = e.target.closest('[data-cancel]'); if (!btn) return;
  API.cancel(btn.dataset.cancel);
  renderBookings($('#lookupPhone').value);
  toast('Booking cancelled.');
});

renderFleet();
