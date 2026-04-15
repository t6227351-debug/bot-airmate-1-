import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DAYS = ['sun','mon','tue','wed','thu','fri','sat'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  // ── GET /api/appointments?action=slots&slug=X&duration=30&from=YYYY-MM-DD&days=7
  if (req.method === 'GET' && action === 'slots') {
    const { slug, duration, from, days = 7 } = req.query;
    if (!slug || !duration) return res.status(400).json({ error: 'slug y duration requeridos' });

    const { data: biz, error } = await supabase
      .from('business_configs')
      .select('schedule,config')
      .eq('slug', slug)
      .maybeSingle();

    if (error || !biz) return res.status(404).json({ error: 'Negocio no encontrado' });

    const durMin = parseInt(duration);
    const gapMin = parseInt(biz.config?.gap_minutes ?? 0);
    const maxDays = parseInt(biz.config?.max_days_ahead ?? 30);
    const startDate = from ? new Date(from) : new Date();
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + Math.min(parseInt(days), maxDays));

    // Traer citas existentes en ese rango
    const { data: existing } = await supabase
      .from('appointments')
      .select('starts_at,ends_at')
      .eq('business_slug', slug)
      .neq('status', 'cancelled')
      .gte('starts_at', startDate.toISOString())
      .lte('starts_at', endDate.toISOString());

    const slots = [];
    const now = new Date();

    for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
      const dayKey = DAYS[d.getDay()];
      const dayHours = biz.schedule[dayKey];
      if (!dayHours || dayHours.length === 0) continue;

      // dayHours: ["09:00","14:00","16:00","20:00"] = dos franjas
      for (let i = 0; i < dayHours.length; i += 2) {
        const [startH, startM] = dayHours[i].split(':').map(Number);
        const [endH, endM]     = dayHours[i+1].split(':').map(Number);

        const slotStart = new Date(d);
        slotStart.setHours(startH, startM, 0, 0);
        const frameEnd = new Date(d);
        frameEnd.setHours(endH, endM, 0, 0);

        let cursor = new Date(slotStart);
        while (cursor.getTime() + durMin * 60000 <= frameEnd.getTime()) {
          const slotEnd = new Date(cursor.getTime() + durMin * 60000);

          // Ignorar slots pasados
          if (cursor > now) {
            // Comprobar que no se solapa con ninguna cita existente (+gap)
            const overlaps = (existing || []).some(apt => {
              const aStart = new Date(apt.starts_at).getTime() - gapMin * 60000;
              const aEnd   = new Date(apt.ends_at).getTime()   + gapMin * 60000;
              return cursor.getTime() < aEnd && slotEnd.getTime() > aStart;
            });

            if (!overlaps) {
              slots.push({
                date: cursor.toISOString().slice(0, 10),
                time: cursor.toTimeString().slice(0, 5),
                starts_at: cursor.toISOString(),
                ends_at: slotEnd.toISOString(),
              });
            }
          }

          cursor = new Date(cursor.getTime() + durMin * 60000 + gapMin * 60000);
        }
      }
    }

    return res.status(200).json({ slots: slots.slice(0, 20) }); // max 20 opciones
  }

  // ── GET /api/appointments?action=list&slug=X&from=YYYY-MM-DD&to=YYYY-MM-DD
  if (req.method === 'GET' && action === 'list') {
    const { slug, from, to } = req.query;
    if (!slug) return res.status(400).json({ error: 'slug requerido' });

    let query = supabase
      .from('appointments')
      .select('*')
      .eq('business_slug', slug)
      .order('starts_at', { ascending: true });

    if (from) query = query.gte('starts_at', new Date(from).toISOString());
    if (to)   query = query.lte('starts_at', new Date(to + 'T23:59:59').toISOString());

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ appointments: data });
  }

  // ── POST /api/appointments?action=book
  if (req.method === 'POST' && action === 'book') {
    const { slug, client_name, client_phone, client_email, service, duration_minutes, starts_at, notes } = req.body;
    if (!slug || !client_name || !service || !duration_minutes || !starts_at) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const { data: biz } = await supabase
      .from('business_configs')
      .select('config')
      .eq('slug', slug)
      .maybeSingle();

    const gapMin = parseInt(biz?.config?.gap_minutes ?? 0);
    const autoConfirm = biz?.config?.auto_confirm !== false;

    const startsAt = new Date(starts_at);
    const endsAt   = new Date(startsAt.getTime() + parseInt(duration_minutes) * 60000);

    // Verificar que el hueco sigue libre
    const { data: clash } = await supabase
      .from('appointments')
      .select('id')
      .eq('business_slug', slug)
      .neq('status', 'cancelled')
      .lt('starts_at', new Date(endsAt.getTime() + gapMin * 60000).toISOString())
      .gt('ends_at',   new Date(startsAt.getTime() - gapMin * 60000).toISOString());

    if (clash && clash.length > 0) {
      return res.status(409).json({ error: 'Ese hueco ya no está disponible, elige otro horario.' });
    }

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        business_slug: slug,
        client_name,
        client_phone: client_phone || null,
        client_email: client_email || null,
        service,
        duration_minutes: parseInt(duration_minutes),
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: autoConfirm ? 'confirmed' : 'pending',
        notes: notes || null,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ appointment: data, confirmed: autoConfirm });
  }

  // ── PATCH /api/appointments?action=update&id=X
  if (req.method === 'PATCH' && action === 'update') {
    const { id } = req.query;
    const { status } = req.body;
    if (!id || !status) return res.status(400).json({ error: 'id y status requeridos' });

    const { data, error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ appointment: data });
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
