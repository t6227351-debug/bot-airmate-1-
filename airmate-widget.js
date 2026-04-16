(function () {
  'use strict';

  /* ─── CONFIG ─── Lee data-* del div #airmate-root ─────────────── */
  const ROOT = document.getElementById('airmate-root');
  if (!ROOT) return;

  const SLUG     = ROOT.dataset.slug    || 'negocio';
  const WA       = ROOT.dataset.wa      || '';
  const WORKERS  = parseInt(ROOT.dataset.workers || '1', 10);
  const BOT_NAME = ROOT.dataset.name    || 'Asistente';
  const EMOJI    = ROOT.dataset.emoji   || '💬';
  const GREETING = ROOT.dataset.greeting|| '¡Hola! ¿En qué puedo ayudarte hoy?';
  const COLOR    = ROOT.dataset.color   || '#0c1e3d';
  const SVCS     = (ROOT.dataset.svcs || '').split(',').map(s => {
    const [name, price, dur] = s.trim().split('|');
    return name ? { name: name.trim(), price: (price||'').trim(), duration: parseInt(dur||'60') } : null;
  }).filter(Boolean);

  /* ─── CONSTANTES AIRMATE ────────────────────────────────────────── */
  const PROXY    = 'https://bot-airmate-1.vercel.app/api/chat';
  const SB_URL   = 'https://vjofxmfwdybktpwiuanc.supabase.co';
  const SB_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqb2Z4bWZ3ZHlia3Rwd2l1YW5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NzU5NDYsImV4cCI6MjA5MDA1MTk0Nn0.ixU-33c0FEkO7F5xjWb3YHkvj_pQuR0gsJETrGA8ZTE';
  const COLOR2   = darken(COLOR);

  /* ─── ESTADO ────────────────────────────────────────────────────── */
  const st = {
    open: false, history: [], flow: null, /* 'cita' | 'lead' */
    selSvc: null, selDate: null, selTime: null,
  };

  /* ─── CSS ───────────────────────────────────────────────────────── */
  injectCSS(`
    :root{--am-c:${COLOR};--am-c2:${COLOR2};--am-g:#22c55e;--am-g2:#16a34a;--am-f:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}
    #am-btn{position:fixed;bottom:24px;right:24px;z-index:2147483647;width:auto;min-width:52px;height:52px;border-radius:26px;
      background:linear-gradient(135deg,var(--am-c),var(--am-c2));border:none;cursor:pointer;
      box-shadow:0 6px 24px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;gap:7px;
      padding:0 16px 0 14px;transition:all .25s cubic-bezier(.34,1.3,.64,1);}
    #am-btn:hover{transform:translateY(-2px) scale(1.04);box-shadow:0 10px 32px rgba(0,0,0,.4);}
    #am-btn .am-dot{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--am-g),var(--am-g2));
      display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:15px;}
    #am-btn .am-lbl{font-family:var(--am-f);font-size:12px;font-weight:700;color:#fff;white-space:nowrap;}
    .am-notif{position:absolute;top:-2px;right:-2px;width:12px;height:12px;border-radius:50%;background:var(--am-g);border:2px solid #fff;animation:amPulse 2s infinite;}
    @keyframes amPulse{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.5)}50%{box-shadow:0 0 0 5px rgba(34,197,94,0)}}
    #am-panel{position:fixed;bottom:88px;right:24px;z-index:2147483646;width:370px;max-height:620px;background:#fff;
      border-radius:20px;box-shadow:0 24px 64px rgba(0,0,0,.18);display:flex;flex-direction:column;overflow:hidden;
      border:1px solid rgba(0,0,0,.07);opacity:0;transform:translateY(16px) scale(.96);pointer-events:none;
      transition:all .32s cubic-bezier(.34,1.4,.64,1);}
    #am-panel.open{opacity:1;transform:none;pointer-events:all;}
    .am-hd{padding:14px 16px;background:linear-gradient(135deg,var(--am-c),var(--am-c2));display:flex;align-items:center;gap:10px;flex-shrink:0;}
    .am-avatar{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--am-g),var(--am-g2));
      display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}
    .am-hname{font-size:13px;font-weight:700;color:#fff;font-family:var(--am-f);}
    .am-hbrand{font-size:10px;font-weight:700;letter-spacing:.08em;color:var(--am-g);text-transform:uppercase;font-family:var(--am-f);}
    .am-hdot{width:6px;height:6px;border-radius:50%;background:var(--am-g);box-shadow:0 0 6px var(--am-g);animation:amPulse 2s infinite;display:inline-block;margin-right:4px;}
    .am-hstatus{font-size:11px;color:rgba(255,255,255,.65);font-family:var(--am-f);margin-top:2px;}
    .am-wa-btn{display:flex;align-items:center;gap:5px;background:rgba(255,255,255,.12);color:#fff;
      border:1px solid rgba(255,255,255,.2);border-radius:99px;padding:5px 10px;font-size:11px;font-weight:700;
      cursor:pointer;text-decoration:none;flex-shrink:0;margin-left:auto;font-family:var(--am-f);}
    #am-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth;background:#fafbfd;}
    .am-msg{display:flex;flex-direction:column;gap:3px;animation:amIn .22s ease-out both;}
    @keyframes amIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
    .am-msg.u{align-items:flex-end;}.am-msg.b{align-items:flex-start;}
    .am-bbl{max-width:86%;padding:9px 13px;border-radius:16px;font-size:13.5px;line-height:1.55;word-wrap:break-word;font-family:var(--am-f);}
    .am-msg.b .am-bbl{background:linear-gradient(135deg,var(--am-c),var(--am-c2));color:#fff;border-bottom-left-radius:4px;box-shadow:0 2px 10px rgba(0,0,0,.15);}
    .am-msg.u .am-bbl{background:linear-gradient(135deg,var(--am-g),var(--am-g2));color:#fff;border-bottom-right-radius:4px;}
    .am-time{font-size:10px;color:#aab;padding:0 4px;font-family:var(--am-f);}
    .am-typing{display:flex;align-items:center;gap:4px;padding:10px 14px;background:linear-gradient(135deg,var(--am-c),var(--am-c2));border-radius:16px;border-bottom-left-radius:4px;width:fit-content;}
    .am-td{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.6);animation:amB 1.2s infinite;}
    .am-td:nth-child(2){animation-delay:.2s}.am-td:nth-child(3){animation-delay:.4s}
    @keyframes amB{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
    /* TARJETAS DE FLUJO */
    .am-card{background:#fff;border:1.5px solid #e2e8f0;border-radius:14px;padding:16px;margin-top:4px;font-family:var(--am-f);box-shadow:0 2px 8px rgba(0,0,0,.06);}
    .am-card h4{font-size:13px;font-weight:800;color:#0c1e3d;margin:0 0 12px;}
    .am-svc-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
    .am-svc-btn{background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px;cursor:pointer;text-align:left;transition:.15s;font-family:var(--am-f);}
    .am-svc-btn:hover{border-color:var(--am-g);background:#f0fdf4;}
    .am-svc-name{font-size:12.5px;font-weight:700;color:#0c1e3d;display:block;}
    .am-svc-price{font-size:11px;color:var(--am-g2);font-weight:600;}
    .am-svc-dur{font-size:10px;color:#8a97b0;}
    .am-slots{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px;}
    .am-slot{background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:8px;padding:7px 4px;font-size:12px;font-weight:600;
      color:#0c1e3d;cursor:pointer;text-align:center;transition:.15s;font-family:var(--am-f);}
    .am-slot:hover:not(.full){border-color:var(--am-g);background:#f0fdf4;color:var(--am-g2);}
    .am-slot.full{opacity:.35;cursor:not-allowed;text-decoration:line-through;}
    .am-inp{width:100%;padding:9px 11px;border:1.5px solid #e2e8f0;border-radius:9px;font-size:13px;font-family:var(--am-f);
      outline:none;color:#0c1e3d;box-sizing:border-box;margin-bottom:8px;}
    .am-inp:focus{border-color:var(--am-g);box-shadow:0 0 0 3px rgba(34,197,94,.1);}
    .am-btn-g{width:100%;padding:11px;background:linear-gradient(135deg,var(--am-g),var(--am-g2));color:#fff;border:none;
      border-radius:10px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:var(--am-f);margin-top:4px;}
    .am-btn-g:hover{filter:brightness(1.05);}
    .am-days{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:8px;}
    .am-day{flex-shrink:0;padding:8px 12px;border:1.5px solid #e2e8f0;border-radius:10px;cursor:pointer;text-align:center;font-family:var(--am-f);transition:.15s;}
    .am-day:hover,.am-day.sel{border-color:var(--am-g);background:#f0fdf4;}
    .am-day-n{font-size:13px;font-weight:800;color:#0c1e3d;display:block;}
    .am-day-l{font-size:10px;color:#8a97b0;text-transform:uppercase;}
    /* INPUT ROW */
    #am-input-row{padding:10px 12px;border-top:1px solid rgba(0,0,0,.07);display:flex;gap:8px;align-items:center;flex-shrink:0;background:#fff;}
    #am-input{flex:1;border:1px solid rgba(0,0,0,.12);border-radius:10px;padding:8px 12px;font-family:var(--am-f);font-size:13px;
      outline:none;color:#0c1e3d;background:#f8f9fc;}
    #am-input:focus{border-color:var(--am-g);background:#fff;box-shadow:0 0 0 3px rgba(34,197,94,.12);}
    #am-send{width:36px;height:36px;border-radius:10px;flex-shrink:0;background:linear-gradient(135deg,var(--am-g),var(--am-g2));
      border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;}
    .am-footer{text-align:center;padding:5px 0 9px;font-size:10px;color:rgba(0,0,0,.28);font-family:var(--am-f);flex-shrink:0;}
    @media(max-width:480px){#am-panel{width:calc(100vw - 16px);right:8px;bottom:78px;max-height:75vh;}#am-btn{right:12px;bottom:12px;}}
  `);

  /* ─── DOM ───────────────────────────────────────────────────────── */
  const btn   = el('button', { id: 'am-btn' });
  const panel = el('div',   { id: 'am-panel' });

  btn.innerHTML = `<span class="am-notif"></span><span class="am-dot">${EMOJI}</span><span class="am-lbl">${esc(BOT_NAME)}</span>`;
  panel.innerHTML = `
    <div class="am-hd">
      <div class="am-avatar">${EMOJI}</div>
      <div style="flex:1;min-width:0">
        <div class="am-hbrand">AIRMATE</div>
        <div class="am-hname">${esc(BOT_NAME)}</div>
        <div class="am-hstatus"><span class="am-hdot"></span>En línea</div>
      </div>
      ${WA?`<a class="am-wa-btn" href="https://wa.me/${WA}" target="_blank" rel="noopener">💬 WhatsApp</a>`:''}
    </div>
    <div id="am-msgs"></div>
    <div id="am-input-row">
      <input id="am-input" type="text" placeholder="Escribe tu mensaje…" autocomplete="off"/>
      <button id="am-send"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
    </div>
    <div class="am-footer">Powered by AIRMATE</div>`;

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  btn.addEventListener('click', toggle);
  document.getElementById('am-send').addEventListener('click', send);
  document.getElementById('am-input').addEventListener('keydown', e => { if (e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();} });

  /* ─── TOGGLE ────────────────────────────────────────────────────── */
  function toggle() {
    st.open = !st.open;
    panel.classList.toggle('open', st.open);
    btn.classList.toggle('open', st.open);
    if (st.open && st.history.length === 0) setTimeout(() => addBot(GREETING), 350);
    if (st.open) setTimeout(() => document.getElementById('am-input')?.focus(), 380);
  }

  /* ─── CHAT ──────────────────────────────────────────────────────── */
  async function send() {
    const inp  = document.getElementById('am-input');
    const text = inp?.value.trim();
    if (!text || st.flow) return;
    inp.value = '';
    addUser(text);
    st.history.push({ role: 'user', content: text });
    const typ = showTyping();
    let reply;
    try   { reply = await callProxy(); }
    catch { reply = '¡Perdona! Ha habido un error. ¿Puedes repetir?'; }
    finally { removeTyping(typ); }

    /* Detectar señales del agente */
    if (reply.includes('MOSTRAR_RESERVA') || reply.includes('MOSTRAR_CITA')) {
      addBot(reply.replace(/MOSTRAR_RESERVA|MOSTRAR_CITA/g,'').trim() || '¿Qué servicio te interesa?');
      st.history.push({ role:'assistant', content: reply });
      setTimeout(() => showServicePicker(), 400);
      return;
    }
    if (reply.includes('MOSTRAR_CONTACTO') || reply.includes('MOSTRAR_LEAD')) {
      addBot(reply.replace(/MOSTRAR_CONTACTO|MOSTRAR_LEAD/g,'').trim() || 'Déjame tus datos y te contactamos.');
      st.history.push({ role:'assistant', content: reply });
      setTimeout(() => showLeadForm(), 400);
      return;
    }
    addBot(reply);
    st.history.push({ role:'assistant', content: reply });
  }

  async function callProxy() {
    const sysPrompt = buildPrompt();
    const resp = await fetch(PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system_prompt: sysPrompt, messages: st.history.slice(-12) })
    });
    if (!resp.ok) throw new Error(resp.status);
    const d = await resp.json();
    return d.reply || '¿Puedo ayudarte en algo más?';
  }

  /* ─── FLUJO RESERVA ─────────────────────────────────────────────── */
  function showServicePicker() {
    if (!SVCS.length) { showDatePicker(null); return; }
    st.flow = 'cita';
    const card = el('div', { className: 'am-msg b' });
    card.innerHTML = `<div class="am-card">
      <h4>📅 ¿Qué servicio necesitas?</h4>
      <div class="am-svc-grid">${SVCS.map((s,i) => `
        <button class="am-svc-btn" onclick="window._amPickSvc(${i})">
          <span class="am-svc-name">${esc(s.name)}</span>
          ${s.price?`<span class="am-svc-price">${esc(s.price)}</span>`:''}
          <span class="am-svc-dur">⏱ ${s.duration} min</span>
        </button>`).join('')}
      </div>
    </div>`;
    msgs().appendChild(card); scrollBot();
    window._amPickSvc = i => { card.remove(); st.selSvc = SVCS[i]; showDatePicker(SVCS[i]); };
  }

  function showDatePicker(svc) {
    st.flow = 'cita';
    const days = [];
    const now = new Date();
    for (let i = 1; i <= 14; i++) {
      const d = new Date(now); d.setDate(now.getDate() + i);
      if (d.getDay() !== 0) days.push(d); /* excluir domingos */
      if (days.length >= 7) break;
    }
    const card = el('div', { className: 'am-msg b' });
    const svcTxt = svc ? ` — ${svc.name}` : '';
    card.innerHTML = `<div class="am-card">
      <h4>📅 Elige el día${esc(svcTxt)}</h4>
      <div class="am-days">${days.map((d,i) => {
        const dStr = fmtLocalDate(d);
        const label = d.toLocaleDateString('es-ES',{weekday:'short'}).toUpperCase();
        const num   = d.getDate();
        const mon   = d.toLocaleDateString('es-ES',{month:'short'});
        return `<div class="am-day" onclick="window._amPickDay('${dStr}',this)">
          <span class="am-day-l">${label}</span>
          <span class="am-day-n">${num}</span>
          <span class="am-day-l">${mon}</span>
        </div>`;
      }).join('')}
      </div>
      <div id="am-slots-wrap"></div>
    </div>`;
    msgs().appendChild(card); scrollBot();

    window._amPickDay = async (dStr, dayEl) => {
      card.querySelectorAll('.am-day').forEach(d => d.classList.remove('sel'));
      dayEl.classList.add('sel');
      st.selDate = dStr;
      await showTimeSlots(dStr, svc?.duration || 60);
    };
  }

  async function showTimeSlots(dStr, durationMin) {
    const wrap = document.getElementById('am-slots-wrap');
    if (!wrap) return;
    wrap.innerHTML = '<div style="font-size:12px;color:#8a97b0;padding:8px 0;">Cargando horarios…</div>';

    /* Cargar citas existentes de ese día */
    const dayStart = dStr + 'T00:00:00';
    const dayEnd   = dStr + 'T23:59:59';
    const { data: existing } = await sbFetch(`appointments?biz_slug=eq.${SLUG}&starts_at=gte.${dayStart}&starts_at=lte.${dayEnd}&status=neq.cancelled&select=starts_at`);

    /* Horas disponibles 9-19 cada 30 min */
    const slots = [];
    for (let h = 9; h < 19; h++) {
      for (let m = 0; m < 60; m += 30) {
        slots.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
      }
    }

    /* Contar ocupación por slot */
    const occupied = {};
    (existing || []).forEach(a => {
      const t = new Date(a.starts_at).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit',hour12:false});
      occupied[t] = (occupied[t] || 0) + 1;
    });

    wrap.innerHTML = `<div class="am-slots">${slots.map(t => {
      const full = (occupied[t] || 0) >= WORKERS;
      return `<div class="am-slot${full?' full':''}" onclick="${full?'':'window._amPickTime(\''+t+'\')'}">
        ${t}${full?' 🔴':''}
      </div>`;
    }).join('')}</div>`;
    scrollBot();

    window._amPickTime = t => {
      st.selTime = t;
      document.querySelector('.am-card')?.remove();
      showBookingForm();
    };
  }

  function showBookingForm() {
    const svc = st.selSvc;
    const card = el('div', { className: 'am-msg b' });
    card.innerHTML = `<div class="am-card">
      <h4>📋 Tus datos para reservar</h4>
      ${svc?`<div style="font-size:12px;color:#6b7d96;margin-bottom:10px;">📅 ${svc.name} · ${st.selDate} a las ${st.selTime}</div>`:''}
      <input class="am-inp" id="am-bk-name"  type="text"  placeholder="Nombre completo" />
      <input class="am-inp" id="am-bk-phone" type="tel"   placeholder="Teléfono" />
      <input class="am-inp" id="am-bk-email" type="email" placeholder="Email (opcional)" />
      <button class="am-btn-g" onclick="window._amConfirmBooking()">✅ Confirmar reserva</button>
    </div>`;
    msgs().appendChild(card); scrollBot();

    window._amConfirmBooking = async () => {
      const name  = document.getElementById('am-bk-name')?.value.trim();
      const phone = document.getElementById('am-bk-phone')?.value.trim();
      const email = document.getElementById('am-bk-email')?.value.trim();
      if (!name || !phone) { alert('Por favor rellena nombre y teléfono.'); return; }

      card.innerHTML = '<div class="am-card" style="text-align:center;padding:20px;color:#8a97b0;">Guardando reserva…</div>';

      const svc = st.selSvc;
      const startsAt = `${st.selDate}T${st.selTime}:00`;
      const endsAt   = new Date(new Date(startsAt).getTime() + (svc?.duration||60)*60000).toISOString();

      const body = {
        biz_slug:      SLUG,
        client_name:   name,
        client_phone:  phone,
        client_email:  email || null,
        service_name:  svc?.name || 'Servicio',
        service:       svc?.name || 'Servicio',
        starts_at:     startsAt,
        ends_at:       endsAt,
        duration_minutes: svc?.duration || 60,
        status:        'pending',
        created_at:    new Date().toISOString(),
        updated_at:    new Date().toISOString()
      };

      const ok = await sbInsert('appointments', body);
      card.remove();
      st.flow = null;

      if (ok) {
        addBot(`✅ ¡Reserva confirmada, ${esc(name)}!\n\n📅 ${svc?.name||'Servicio'}\n📆 ${st.selDate} a las ${st.selTime}\n\nTe esperamos. Si necesitas cambiar algo, contáctanos.`);
        st.history.push({ role:'assistant', content:'Reserva confirmada correctamente.' });
        /* Guardar lead asociado */
        sbInsert('leads', {
          biz_slug:     SLUG, name, phone, email: email||null,
          interest:     svc?.name||'Reserva', intent: 'new',
          temperature:  'warm', status: 'new',
          created_at:   new Date().toISOString(), updated_at: new Date().toISOString()
        });
      } else {
        addBot('Ha ocurrido un error al guardar la reserva. Por favor escríbenos por WhatsApp y lo gestionamos enseguida.');
      }
    };
  }

  /* ─── FLUJO LEAD ────────────────────────────────────────────────── */
  function showLeadForm() {
    st.flow = 'lead';
    const card = el('div', { className: 'am-msg b' });
    card.innerHTML = `<div class="am-card">
      <h4>📬 ¿Cómo te contactamos?</h4>
      <input class="am-inp" id="am-ld-name"    type="text" placeholder="Nombre completo" />
      <input class="am-inp" id="am-ld-phone"   type="tel"  placeholder="Teléfono" />
      <input class="am-inp" id="am-ld-interest" type="text" placeholder="¿Qué te interesa?" />
      <button class="am-btn-g" onclick="window._amSaveLead()">Enviar →</button>
    </div>`;
    msgs().appendChild(card); scrollBot();

    window._amSaveLead = async () => {
      const name     = document.getElementById('am-ld-name')?.value.trim();
      const phone    = document.getElementById('am-ld-phone')?.value.trim();
      const interest = document.getElementById('am-ld-interest')?.value.trim();
      if (!name || !phone) { alert('Por favor rellena nombre y teléfono.'); return; }
      card.innerHTML = '<div class="am-card" style="padding:16px;color:#8a97b0;">Guardando…</div>';
      await sbInsert('leads', {
        biz_slug: SLUG, name, phone, interest: interest||'Consulta general',
        intent: 'new', temperature: 'warm', status: 'new',
        created_at: new Date().toISOString(), updated_at: new Date().toISOString()
      });
      card.remove();
      st.flow = null;
      addBot(`¡Perfecto, ${esc(name)}! Hemos guardado tus datos y te contactaremos pronto. ${WA?`Si prefieres algo más inmediato, escríbenos por WhatsApp 💬`:''}` );
      st.history.push({ role:'assistant', content:'Datos de contacto guardados.' });
    };
  }

  /* ─── SUPABASE HELPERS ──────────────────────────────────────────── */
  async function sbFetch(path) {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
        headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY }
      });
      return { data: await r.json() };
    } catch { return { data: null }; }
  }

  async function sbInsert(table, body) {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify(body)
      });
      return r.ok;
    } catch { return false; }
  }

  /* ─── SYSTEM PROMPT ─────────────────────────────────────────────── */
  function buildPrompt() {
    const svcsText = SVCS.map(s => `- ${s.name}${s.price?' ('+s.price+')':''}${s.duration?' — '+s.duration+' min':''}`).join('\n') || '- Consultar disponibilidad';
    return `Eres el asistente IA de este negocio. Tu objetivo es responder dudas, ayudar a reservar citas y capturar contactos interesados.

SERVICIOS DISPONIBLES:
${svcsText}

CÓMO ACTÚAS:
- Responde de forma natural, breve y amable.
- Si el cliente quiere reservar una cita, pedir hora o disponibilidad → responde con MOSTRAR_RESERVA al inicio.
- Si el cliente quiere que le contacten, dejar sus datos o pedir más info personalizada → responde con MOSTRAR_CONTACTO al inicio.
- Si solo tiene dudas, respóndelas directamente.
- Nunca inventes precios ni datos que no tengas.
${WA?`- Si el cliente quiere hablar con una persona, indícale WhatsApp: ${WA}`:''}

IDIOMA: Siempre responde en el idioma en que escribe el cliente.`;
  }

  /* ─── UI HELPERS ────────────────────────────────────────────────── */
  function addUser(t) { appendMsg('u', `<div class="am-bbl">${esc(t)}</div><div class="am-time">${time()}</div>`); }
  function addBot(t)  { appendMsg('b', `<div class="am-bbl">${fmt(t)}</div><div class="am-time">${time()}</div>`); }
  function appendMsg(cls, html) {
    const d = el('div', { className: 'am-msg ' + cls }); d.innerHTML = html;
    msgs().appendChild(d); scrollBot();
  }
  function showTyping() {
    const d = el('div', { className: 'am-msg b' });
    d.innerHTML = '<div class="am-typing"><span class="am-td"></span><span class="am-td"></span><span class="am-td"></span></div>';
    msgs().appendChild(d); scrollBot(); return d;
  }
  function removeTyping(d) { d?.parentNode?.removeChild(d); }
  function msgs()     { return document.getElementById('am-msgs'); }
  function scrollBot(){ const m = msgs(); if (m) m.scrollTop = m.scrollHeight; }
  function time()     { return new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}); }
  function fmtLocalDate(d) {
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function fmt(raw) {
    if (!raw) return '';
    return raw.split('\n').map(l => `<div>${esc(l)||'&nbsp;'}</div>`).join('');
  }
  function esc(s)  { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function el(tag, props) { const e = document.createElement(tag); Object.assign(e, props); return e; }
  function darken(hex) {
    try { const n=parseInt(hex.replace('#',''),16); const r=Math.max(0,(n>>16)-40),g=Math.max(0,((n>>8)&0xff)-40),b=Math.max(0,(n&0xff)-40); return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join(''); } catch{return hex;}
  }
  function injectCSS(css) { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }

})();
