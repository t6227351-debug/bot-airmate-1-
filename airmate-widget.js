(function () {
  'use strict';

  const cfg          = window.AIRMATE_CONFIG || {};
  const PROXY_URL    = (cfg.proxy_url   || 'https://bot-airmate-1.vercel.app/api/chat').replace(/\/$/, '');
  const PROXY_TOKEN  = cfg.proxy_token  || '';
  const BOT_COLOR    = cfg.bot_color    || '#0c1e3d';
  const BOT_NAME     = cfg.bot_name     || 'Asistente';
  const BIZ_ID       = cfg.business_id  || 'negocio';
  const WA_PHONE     = cfg.wa_phone     || '';
  const GREETING     = cfg.greeting     || '¡Hola! ¿En qué puedo ayudarte hoy?';
  const SYSTEM_PROMPT = _buildPrompt();
  const BOT_DARK = _darken(BOT_COLOR);

  const st = {
    open: false, history: [], msgCount: 0, ctaShown: false,
    sessionId: 's_' + Math.random().toString(36).slice(2, 10),
    lastUserMsg: '',
  };

  _injectCSS(`
    :root {
      --am-navy:  ${BOT_COLOR};
      --am-navy2: ${BOT_DARK};
      --am-green: #22c55e;
      --am-green2:#16a34a;
      --am-font:  -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #am-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 2147483647;
      width: auto; min-width: 52px; height: 52px; border-radius: 26px;
      background: linear-gradient(135deg, var(--am-navy) 0%, var(--am-navy2) 100%);
      border: none; cursor: pointer;
      box-shadow: 0 6px 24px rgba(0,0,0,.35), 0 2px 8px rgba(0,0,0,.2);
      display: flex; align-items: center; justify-content: center; gap: 7px;
      padding: 0 16px 0 14px; transition: all .25s cubic-bezier(.34,1.3,.64,1); overflow: hidden;
    }
    #am-btn::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(34,197,94,.18) 0%, transparent 60%); border-radius: inherit; pointer-events: none; }
    #am-btn:hover { transform: translateY(-2px) scale(1.04); box-shadow: 0 10px 32px rgba(0,0,0,.4), 0 4px 12px rgba(34,197,94,.25); }
    #am-btn .am-dot { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, var(--am-green) 0%, var(--am-green2) 100%); display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 2px 8px rgba(34,197,94,.4); transition: transform .25s; }
    #am-btn:hover .am-dot { transform: rotate(12deg) scale(1.1); }
    #am-btn .am-lbl { font-family: var(--am-font); font-size: 12px; font-weight: 700; color: #fff; letter-spacing: .04em; white-space: nowrap; transition: opacity .2s, transform .2s; }
    #am-btn .am-lbl-open { position: absolute; font-family: var(--am-font); font-size: 12px; font-weight: 700; color: rgba(255,255,255,.8); letter-spacing: .04em; opacity: 0; transform: scale(.8); transition: opacity .2s, transform .2s; }
    #am-btn.open .am-lbl { opacity: 0; transform: scale(.8); }
    #am-btn.open .am-lbl-open { opacity: 1; transform: scale(1); }
    #am-btn .am-ic  { transition: opacity .2s, transform .2s; }
    #am-btn .am-ic2 { position: absolute; left: 14px; opacity: 0; transform: rotate(-90deg); transition: opacity .2s, transform .2s; }
    #am-btn.open .am-ic  { opacity: 0; transform: scale(.5); }
    #am-btn.open .am-ic2 { opacity: 1; transform: rotate(0deg); }
    .am-notif { position: absolute; top: -2px; right: -2px; width: 12px; height: 12px; border-radius: 50%; background: var(--am-green); border: 2px solid #fff; animation: amPulse 2s infinite; }
    @keyframes amPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,.5); } 50% { box-shadow: 0 0 0 5px rgba(34,197,94,0); } }
    #am-panel { position: fixed; bottom: 88px; right: 24px; z-index: 2147483646; width: 370px; max-height: 610px; background: #fff; border-radius: 20px; box-shadow: 0 24px 64px rgba(0,0,0,.18), 0 8px 24px rgba(0,0,0,.1); display: flex; flex-direction: column; overflow: hidden; border: 1px solid rgba(0,0,0,.07); opacity: 0; transform: translateY(16px) scale(.96); pointer-events: none; transition: all .32s cubic-bezier(.34,1.4,.64,1); }
    #am-panel.open { opacity: 1; transform: none; pointer-events: all; }
    .am-header { padding: 14px 16px; background: linear-gradient(135deg, var(--am-navy) 0%, var(--am-navy2) 100%); display: flex; align-items: center; gap: 10px; flex-shrink: 0; position: relative; overflow: hidden; }
    .am-header::after { content: ''; position: absolute; top: -40px; right: -20px; width: 100px; height: 100px; border-radius: 50%; background: radial-gradient(circle, rgba(34,197,94,.18) 0%, transparent 70%); pointer-events: none; }
    .am-avatar { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, var(--am-green) 0%, var(--am-green2) 100%); display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 2px 8px rgba(34,197,94,.35); font-size: 18px; }
    .am-hname   { font-size: 13px; font-weight: 700; color: #fff; line-height: 1.2; font-family: var(--am-font); }
    .am-hbrand  { font-size: 10px; font-weight: 700; letter-spacing: .08em; color: var(--am-green); text-transform: uppercase; margin-bottom: 1px; font-family: var(--am-font); }
    .am-hstatus { font-size: 11px; color: rgba(255,255,255,.65); display: flex; align-items: center; gap: 4px; margin-top: 2px; font-family: var(--am-font); }
    .am-sdot    { width: 6px; height: 6px; border-radius: 50%; background: var(--am-green); box-shadow: 0 0 6px var(--am-green); animation: amPulse 2s infinite; }
    .am-wa-btn { display: flex; align-items: center; gap: 5px; background: rgba(255,255,255,.12); color: #fff; border: 1px solid rgba(255,255,255,.15); border-radius: 99px; padding: 5px 10px; font-size: 11px; font-weight: 700; cursor: pointer; transition: all .15s; text-decoration: none; flex-shrink: 0; margin-left: auto; font-family: var(--am-font); }
    .am-wa-btn:hover { background: rgba(255,255,255,.22); }
    #am-msgs { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; scroll-behavior: smooth; background: #fafbfd; }
    #am-msgs::-webkit-scrollbar { width: 4px; }
    #am-msgs::-webkit-scrollbar-thumb { background: rgba(0,0,0,.1); border-radius: 2px; }
    .am-msg { display: flex; flex-direction: column; gap: 3px; animation: amIn .22s ease-out both; }
    @keyframes amIn { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform: none; } }
    .am-msg.u { align-items: flex-end; }
    .am-msg.b { align-items: flex-start; }
    .am-bbl { max-width: 84%; padding: 9px 13px; border-radius: 16px; font-size: 13.5px; line-height: 1.55; word-wrap: break-word; font-family: var(--am-font); }
    .am-msg.b .am-bbl { background: linear-gradient(135deg, var(--am-navy) 0%, var(--am-navy2) 100%); color: #fff; border-bottom-left-radius: 4px; box-shadow: 0 2px 10px rgba(0,0,0,.15); }
    .am-msg.u .am-bbl { background: linear-gradient(135deg, var(--am-green) 0%, var(--am-green2) 100%); color: #fff; border-bottom-right-radius: 4px; box-shadow: 0 2px 10px rgba(34,197,94,.22); }
    .am-msg.b .am-bbl ul { list-style: none; padding: 0; margin: 4px 0 0; display: flex; flex-direction: column; gap: 5px; }
    .am-msg.b .am-bbl li { display: flex; align-items: flex-start; gap: 6px; font-size: 13px; }
    .am-msg.b .am-bbl li::before { content: '·'; color: var(--am-green); font-weight: 900; flex-shrink: 0; margin-top: 1px; }
    .am-msg.b .am-bbl strong { font-weight: 700; color: rgba(255,255,255,.95); }
    .am-time { font-size: 10px; color: #aab; padding: 0 4px; font-family: var(--am-font); }
    .am-typing { display: flex; align-items: center; gap: 4px; padding: 10px 14px; background: linear-gradient(135deg, var(--am-navy) 0%, var(--am-navy2) 100%); border-radius: 16px; border-bottom-left-radius: 4px; width: fit-content; box-shadow: 0 2px 10px rgba(0,0,0,.15); }
    .am-td { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,.6); animation: amBounce 1.2s infinite; }
    .am-td:nth-child(2) { animation-delay: .2s; } .am-td:nth-child(3) { animation-delay: .4s; }
    @keyframes amBounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-5px); } }
    #am-qr { display: flex; gap: 6px; padding: 8px 12px 0; overflow-x: auto; flex-shrink: 0; background: #fafbfd; }
    #am-qr::-webkit-scrollbar { display: none; }
    .am-qr { flex-shrink: 0; padding: 5px 11px; border-radius: 20px; border: 1.5px solid rgba(34,197,94,.4); background: #fff; color: var(--am-navy); font-size: 12px; cursor: pointer; white-space: nowrap; transition: background .15s, color .15s, border-color .15s; font-family: var(--am-font); }
    .am-qr:hover { background: var(--am-navy); color: #fff; border-color: var(--am-navy); }
    .am-qr-wa { background: #e8faf0; color: #128c4a; border-color: rgba(37,211,102,.4); font-weight: 700; }
    .am-qr-wa:hover { background: #25D366; color: #fff; border-color: #25D366; }
    .am-wa-cta { background: linear-gradient(145deg, #0c1e3d 0%, #0f2d4a 100%); border-radius: 16px; padding: 16px 14px 14px; margin: 2px 0; display: flex; flex-direction: column; gap: 10px; animation: amUp .35s ease-out; box-shadow: 0 4px 16px rgba(0,0,0,.18); }
    @keyframes amUp { from { opacity:0; transform: translateY(10px); } to { opacity:1; transform: none; } }
    .am-wa-cta-head { font-size: 13px; font-weight: 800; color: #fff; font-family: var(--am-font); letter-spacing: .01em; }
    .am-wa-cta-sub { font-size: 12px; color: rgba(255,255,255,.65); font-family: var(--am-font); line-height: 1.45; margin-top: -4px; }
    .am-wa-cta-btn { display: flex; align-items: center; justify-content: center; gap: 8px; background: #25D366; color: #fff; border: none; border-radius: 11px; padding: 11px 16px; font-size: 14px; font-weight: 800; cursor: pointer; text-decoration: none; font-family: var(--am-font); box-shadow: 0 4px 14px rgba(37,211,102,.5); transition: all .18s; letter-spacing: .01em; }
    .am-wa-cta-btn:hover { transform: translateY(-2px); box-shadow: 0 7px 20px rgba(37,211,102,.6); background: #20c45d; }
    #am-input-row { padding: 10px 12px; border-top: 1px solid rgba(0,0,0,.07); display: flex; gap: 8px; align-items: center; flex-shrink: 0; background: #fff; }
    #am-input { flex: 1; border: 1px solid rgba(0,0,0,.12); border-radius: 10px; padding: 8px 12px; font-family: var(--am-font); font-size: 13px; outline: none; color: var(--am-navy); background: #f8f9fc; transition: all .15s; }
    #am-input:focus { border-color: var(--am-green); background: #fff; box-shadow: 0 0 0 3px rgba(34,197,94,.12); }
    #am-send { width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0; background: linear-gradient(135deg, var(--am-green) 0%, var(--am-green2) 100%); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .18s; box-shadow: 0 2px 8px rgba(34,197,94,.35); }
    #am-send:hover { transform: scale(1.08) translateY(-1px); box-shadow: 0 4px 14px rgba(34,197,94,.45); }
    #am-send svg { width: 16px; height: 16px; }
    .am-footer { text-align: center; padding: 5px 0 9px; font-size: 10px; color: rgba(0,0,0,.3); letter-spacing: .02em; font-family: var(--am-font); flex-shrink: 0; }
    .am-footer a { color: inherit; text-decoration: none; }
    @media (max-width: 480px) {
      #am-panel { width: calc(100vw - 20px); right: 10px; bottom: 80px; max-height: 75vh; }
      #am-btn   { right: 14px; bottom: 14px; }
    }
  `);

  const btn = _el('button', { id: 'am-btn' });
  btn.innerHTML = `
    <span class="am-notif"></span>
    <span class="am-ic"><div class="am-dot"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 10.5L8 3l5 7.5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="12.5" r="1.5" fill="white"/></svg></div></span>
    <span class="am-lbl">AIRMATE LEADS</span>
    <span class="am-ic2"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>
    <span class="am-lbl-open">Cerrar</span>`;

  const panel = _el('div', { id: 'am-panel' });
  const waHref = WA_PHONE ? `https://wa.me/${WA_PHONE}` : '#';
  panel.innerHTML = `
    <div class="am-header">
      <div class="am-avatar">💬</div>
      <div style="flex:1;min-width:0">
        <div class="am-hbrand">AIRMATE LEADS</div>
        <div class="am-hname">${_esc(BOT_NAME)}</div>
        <div class="am-hstatus"><span class="am-sdot"></span> En línea</div>
      </div>
      ${WA_PHONE ? `<a class="am-wa-btn" href="${waHref}" target="_blank" rel="noopener"><svg width="12" height="12" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.998 2C6.478 2 2 6.478 2 12c0 1.843.498 3.567 1.362 5.058L2 22l5.07-1.345A9.952 9.952 0 0011.998 22c5.52 0 10-4.478 10-10S17.518 2 11.998 2zm0 18.18a8.172 8.172 0 01-4.164-1.14l-.298-.178-3.012.799.807-2.944-.194-.304A8.18 8.18 0 013.818 12c0-4.51 3.672-8.18 8.18-8.18 4.51 0 8.18 3.67 8.18 8.18 0 4.51-3.67 8.18-8.18 8.18z"/></svg> WhatsApp</a>` : ''}
    </div>
    <div id="am-msgs"></div>
    <div id="am-qr">
      <button class="am-qr" onclick="window._amQR('productos')">🛍️ Busco un producto</button>
      <button class="am-qr" onclick="window._amQR('servicios')">✨ Necesito un servicio</button>
      <button class="am-qr" onclick="window._amQR('precio')">💰 ¿Cuánto cuesta?</button>
      <button class="am-qr" onclick="window._amQR('horario')">🕐 Horario</button>
      ${WA_PHONE ? `<button class="am-qr am-qr-wa" onclick="window._amWA()">💬 WhatsApp</button>` : ''}
    </div>
    <div id="am-input-row">
      <input id="am-input" type="text" placeholder="Escribe tu pregunta…" autocomplete="off" />
      <button id="am-send" aria-label="Enviar"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
    </div>
    <div class="am-footer">Powered by <a href="#" target="_blank">AIRMATE LEADS</a></div>`;

  document.body.appendChild(btn);
  document.body.appendChild(panel);
  btn.addEventListener('click', _toggle);
  document.getElementById('am-send').addEventListener('click', _send);
  document.getElementById('am-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _send(); } });

  window._amQR = topic => {
    const map = {
      productos:  'Estoy buscando un producto pero no sé cuál elegir, ¿me ayudas?',
      servicios:  'Necesito un servicio, ¿me podéis orientar sobre cuál me conviene?',
      precio:     '¿Cuánto me costaría aproximadamente?',
      horario:    '¿Cuál es vuestro horario?',
      direccion:  '¿Dónde estáis?',
    };
    document.getElementById('am-input').value = map[topic] || topic;
    _send();
  };
  window._amWA = () => _addWACTA();

  function _toggle() { st.open ? _close() : _open(); }
  function _open() {
    st.open = true; panel.classList.add('open'); btn.classList.add('open');
    if (st.history.length === 0) setTimeout(() => _addBot(GREETING), 300);
    setTimeout(() => document.getElementById('am-input')?.focus(), 350);
  }
  function _close() { st.open = false; panel.classList.remove('open'); btn.classList.remove('open'); }

  async function _send() {
    const input = document.getElementById('am-input');
    const text = input?.value.trim();
    if (!text) return;
    input.value = ''; st.lastUserMsg = text;
    _addUser(text);
    st.history.push({ role: 'user', content: text });
    st.msgCount++;
    const typing = _showTyping();
    let reply;
    try { reply = await _callProxy(); } catch (_) { reply = _fallback(); } finally { _removeTyping(typing); }
    _addBot(reply);
    st.history.push({ role: 'assistant', content: reply });
    if (st.msgCount > 0 && st.msgCount % 3 === 0 && !st.ctaShown && WA_PHONE) {
      st.ctaShown = true;
      setTimeout(() => _addWACTA(), 900);
    }
  }

  async function _callProxy() {
    if (!PROXY_URL) throw new Error('Sin proxy');
    const headers = { 'Content-Type': 'application/json' };
    if (PROXY_TOKEN) headers['X-Airmate-Token'] = PROXY_TOKEN;
    const resp = await fetch(PROXY_URL, {
      method: 'POST', headers,
      body: JSON.stringify({ messages: st.history.slice(-10), system_prompt: SYSTEM_PROMPT, business_id: BIZ_ID }),
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    return data.reply || _fallback();
  }

  function _addUser(text) { _appendMsg('u', `<div class="am-bbl">${_esc(text)}</div><div class="am-time">${_time()}</div>`); }
  function _addBot(text)  { _appendMsg('b', `<div class="am-bbl">${_fmt(text)}</div><div class="am-time">${_time()}</div>`); }
  function _appendMsg(cls, html) { const d = _el('div', { className: 'am-msg ' + cls }); d.innerHTML = html; document.getElementById('am-msgs').appendChild(d); _scrollBottom(); }
  function _showTyping() { const d = _el('div', { className: 'am-msg b' }); d.innerHTML = '<div class="am-typing"><span class="am-td"></span><span class="am-td"></span><span class="am-td"></span></div>'; document.getElementById('am-msgs').appendChild(d); _scrollBottom(); return d; }
  function _removeTyping(el) { el?.parentNode?.removeChild(el); }
  function _scrollBottom() { const m = document.getElementById('am-msgs'); if (m) m.scrollTop = m.scrollHeight; }

  function _fmt(raw) {
    if (!raw) return '';
    const esc = s => _esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Separar bloques por línea en blanco
    const blocks = raw.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);

    const isItem = l => /^[-•·*]\s/.test(l) || /^\d+[.)]\s/.test(l) ||
      /^[🛍✨📍🕐💇💆🧖💪🏋🧘🥗🍽🏥🩺💊🧴👗👔👖👠👟🎁🛒✅➡️▪️▸]/.test(l);

    const cleanItem = l => l.replace(/^[-•·*]\s*/, '').replace(/^\d+[.)]\s*/, '');

    let html = '';
    for (const block of blocks) {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) continue;

      // Si todas las líneas son items → lista compacta
      if (lines.every(isItem)) {
        html += '<ul style="margin:4px 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:5px">';
        for (const l of lines) {
          html += `<li style="display:flex;align-items:flex-start;gap:6px;line-height:1.5">
            <span style="color:#22c55e;font-weight:900;flex-shrink:0;margin-top:1px">·</span>
            <span>${esc(cleanItem(l))}</span>
          </li>`;
        }
        html += '</ul>';
      }
      // Si la primera línea es texto y el resto son items → intro + lista
      else if (lines.length > 1 && !isItem(lines[0]) && lines.slice(1).some(isItem)) {
        html += `<p style="margin:0 0 7px 0;line-height:1.55">${esc(lines[0])}</p>`;
        const rest = lines.slice(1);
        html += '<ul style="margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:5px">';
        for (const l of rest) {
          if (isItem(l)) {
            html += `<li style="display:flex;align-items:flex-start;gap:6px;line-height:1.5">
              <span style="color:#22c55e;font-weight:900;flex-shrink:0;margin-top:1px">·</span>
              <span>${esc(cleanItem(l))}</span>
            </li>`;
          } else {
            html += `<li style="line-height:1.55;padding-left:14px">${esc(l)}</li>`;
          }
        }
        html += '</ul>';
      }
      // Párrafo de texto normal
      else {
        const text = lines.join(' ');
        html += `<p style="margin:0 0 6px 0;line-height:1.6">${esc(text)}</p>`;
      }
    }

    return html.replace(/<p style="[^"]*"><\/p>/g, '');
  }

  function _addWACTA() {
    const waUrl = `https://wa.me/${WA_PHONE}?text=${encodeURIComponent('¡Hola! Vengo del chat de vuestra web y me gustaría más información.')}`;
    const d = document.createElement('div');
    d.className = 'am-msg b';
    d.innerHTML = `<div class="am-wa-cta">
      <div class="am-wa-cta-head">💬 ¿Hablamos por WhatsApp?</div>
      <div class="am-wa-cta-sub">Escríbenos directamente y te atendemos al momento.</div>
      <a class="am-wa-cta-btn" href="${waUrl}" target="_blank" rel="noopener">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.998 2C6.478 2 2 6.478 2 12c0 1.843.498 3.567 1.362 5.058L2 22l5.07-1.345A9.952 9.952 0 0011.998 22c5.52 0 10-4.478 10-10S17.518 2 11.998 2zm0 18.18a8.172 8.172 0 01-4.164-1.14l-.298-.178-3.012.799.807-2.944-.194-.304A8.18 8.18 0 013.818 12c0-4.51 3.672-8.18 8.18-8.18 4.51 0 8.18 3.67 8.18 8.18 0 4.51-3.67 8.18-8.18 8.18z"/></svg>
        Abrir WhatsApp ahora
      </a>
    </div><div class="am-time">${_time()}</div>`;
    document.getElementById('am-msgs').appendChild(d);
    _scrollBottom();
  }

  function _fallback() {
    const t = (st.lastUserMsg || '').toLowerCase();
    if (WA_PHONE) {
      if (t.includes('precio') || t.includes('cuánto') || t.includes('cuesta'))
        return `Los precios dependen de lo que necesites exactamente. Para darte un dato concreto, lo mejor es que me cuentes un poco más o nos escribas al ${WA_PHONE}.`;
      if (t.includes('horario') || t.includes('abrís') || t.includes('abren'))
        return cfg.hours ? `Estamos disponibles: ${cfg.hours}` : `Ahora mismo no tengo el horario aquí, puedes consultarlo al ${WA_PHONE}.`;
      if (t.includes('dónde') || t.includes('dirección') || t.includes('ubicación'))
        return cfg.address ? `Nos encontramos en ${cfg.address}` : `La dirección puedes consultarla al ${WA_PHONE}.`;
      return `Ahora mismo no tengo esa información a mano. Si quieres una respuesta rápida, puedes escribirnos al ${WA_PHONE}.`;
    }
    return cfg.address ? `Puedes visitarnos en ${cfg.address} y te atendemos en persona.` : 'Ahora mismo no puedo responderte, pero escríbenos y te ayudamos.';
  }

  function _buildPrompt() {
    return _defaultPrompt();
  }

  function _defaultPrompt() {
    const n        = cfg.bot_name || cfg.business_id || 'este negocio';
    const products = (cfg.products || '').trim();
    const services = (cfg.services || '').trim();
    const extras   = (cfg.extras   || '').trim();
    const hours    = (cfg.hours    || '').trim() || '(no configurado)';
    const address  = (cfg.address  || '').trim() || '(no configurada)';
    const wa       = cfg.wa_phone || '';

    return `Eres el asistente de ventas de "${n}". Tu único objetivo es acercar al cliente a dar el siguiente paso: comprar, reservar o contactar por WhatsApp.

INFORMACIÓN DEL NEGOCIO:
${products ? `- Productos: ${products}` : '- Productos: pregunta al cliente qué busca'}
${services ? `- Servicios: ${services}` : '- Servicios: asesoramiento personalizado'}
${extras   ? `- Extra: ${extras}` : ''}
- Horario: ${hours !== '(no configurado)' ? hours : 'consultar por WhatsApp'}
- Dirección: ${address !== '(no configurada)' ? address : 'consultar por WhatsApp'}
${wa ? `- WhatsApp: ${wa}` : ''}

REGLA NÚMERO 1 — MENSAJES CORTOS:
Escribe UN solo mensaje con máximo 2 frases. Nunca más. Si tienes varias cosas que decir, dile una y espera su respuesta para seguir. NUNCA hagas listas largas, NUNCA des toda la información de golpe.

CÓMO ACTÚAS:
- Si el cliente saluda: haz UNA pregunta corta para saber qué busca. Nada más.
- Si el cliente pregunta por algo: responde lo esencial en 1-2 frases y termina con una pregunta que avance la conversación.
- Si el cliente muestra interés: recomienda UNA opción concreta con confianza. No listes todo.
- Si el cliente duda o pone objeciones: una frase que entiende su duda + una pregunta corta para resolver.
- Siempre termina con un paso claro: una pregunta, o mandarlo a WhatsApp.

CUÁNDO MANDAR A WHATSAPP:
En cuanto quiera comprar, reservar o confirmar algo: "Para gestionarlo, escríbenos al ${wa || 'nuestro WhatsApp'} — te atendemos al momento."

PROHIBIDO:
- Listas de más de 2 puntos en un solo mensaje.
- Más de 2 frases seguidas sin esperar respuesta.
- "¡Por supuesto!", "¡Encantado!", "¡Claro que sí!" — habla como persona.
- Inventar urgencia, stock limitado o datos que no tienes.
- Escribir "wa.me/..." — solo el número si lo tienes.
- Gestionar citas o confirmar reservas — eso va por WhatsApp.

IDIOMA: Responde siempre en el idioma en que escribe el cliente.`;

  }

  function _darken(hex) {
    try { const n = parseInt(hex.replace('#',''), 16); const r = Math.max(0,(n>>16)-30), g = Math.max(0,((n>>8)&0xff)-30), b = Math.max(0,(n&0xff)-30); return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join(''); } catch(_){return hex;}
  }
  function _injectCSS(css) { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }
  function _el(tag, props) { const e = document.createElement(tag); Object.assign(e, props); return e; }
  function _esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function _time() { return new Date().toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' }); }

})();
