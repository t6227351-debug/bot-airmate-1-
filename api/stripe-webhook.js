import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Mapeo por nombre de producto (fragmento) → plan ──────────────────────────
// Así no importa el importe exacto. El nombre del producto en Stripe debe
// contener alguna de estas palabras clave (case-insensitive).
const PRODUCT_PLAN_MAP = [
  { keywords: ['airmate'],          plan: 'airmate' },
  { keywords: ['pro'],              plan: 'pro'     },
  { keywords: ['growth'],           plan: 'growth'  },
  { keywords: ['start'],            plan: 'start'   },
];

// Fallback: mapeo por importe exacto (céntimos) para compatibilidad
const AMOUNT_MAP = {
  3999:  { plan: 'airmate',  type: 'maintenance' },
  25000: { plan: 'start',    type: 'setup'       },
  28900: { plan: 'start',    type: 'setup'       }, // 250 setup + 39 mes1
  40000: { plan: 'growth',   type: 'setup'       },
  45900: { plan: 'growth',   type: 'setup'       }, // 400 setup + 59 mes1
  80000: { plan: 'pro',      type: 'setup'       },
  89900: { plan: 'pro',      type: 'setup'       }, // 800 setup + 99 mes1
  3900:  { plan: 'start',    type: 'maintenance' },
  5900:  { plan: 'growth',   type: 'maintenance' },
  9900:  { plan: 'pro',      type: 'maintenance' },
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Detecta el plan buscando en los nombres de los line items del checkout
async function detectPlanFromSession(session) {
  try {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 5 });
    for (const item of lineItems.data) {
      const productName = (item.description || item.price?.product?.name || '').toLowerCase();
      for (const entry of PRODUCT_PLAN_MAP) {
        if (entry.keywords.some(k => productName.includes(k))) {
          return entry.plan;
        }
      }
    }
  } catch (_) {}
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ── Pago completado ─────────────────────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email   = session.customer_details?.email?.toLowerCase();
    const name    = session.customer_details?.name || '';
    const phone   = session.customer_details?.phone || null;
    const amount  = session.amount_total;

    if (!email) {
      console.log('No email in session, skipping.');
      return res.status(200).json({ received: true });
    }

    // 1. Intentar detectar plan por nombre de producto
    let plan = await detectPlanFromSession(session);

    // 2. Fallback por importe exacto
    if (!plan) {
      plan = AMOUNT_MAP[amount]?.plan || null;
    }

    console.log(`Pago recibido: email=${email} importe=${amount}c plan=${plan}`);

    if (!plan) {
      console.log('No se pudo mapear el pago a ningun plan.');
      return res.status(200).json({ received: true });
    }

    // Determinar si es setup (tiene cargo único) o solo mantenimiento
    const isSetupPlan = ['start', 'growth', 'pro'].includes(plan);

    // 3. Activar o crear cliente en Supabase
    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      // Cliente ya existe — actualizar plan y activar
      const { error } = await supabase
        .from('clients')
        .update({ active: true, plan })
        .eq('email', email);
      if (error) console.error('Error activando cliente:', error);
      else console.log(`Plan ${plan} activado para ${email}`);
    } else {
      // Cliente nuevo — crear registro (pagó sin registrarse antes)
      const { error } = await supabase
        .from('clients')
        .insert({ name: name || email, email, plan, active: true, password: null });
      if (error) console.error('Error creando cliente:', error);
      else console.log(`Cliente nuevo creado: ${email} plan=${plan}`);
    }

    // 4. Si es setup de web → crear solicitud en el panel Owner
    if (isSetupPlan) {
      const planLabels  = { start: 'START', growth: 'GROWTH', pro: 'PRO' };
      const setupPrices = { start: '250€',  growth: '400€',   pro: '800€' };

      const { error: wrError } = await supabase
        .from('web_requests')
        .insert([{
          business_name: name || email,
          business_type: null,
          phone,
          email,
          description: `PAGO RECIBIDO — Plan ${planLabels[plan]} · Setup ${setupPrices[plan]}\nCliente registrado desde Stripe.\nActivar agente en el panel tras entregar la web.`,
          status: 'pending',
        }]);

      if (wrError) console.error('Error creando web_request:', wrError);
      else console.log(`Solicitud web creada para ${email} (${plan})`);
    }
  }

  // ── Suscripción cancelada ────────────────────────────────────────
  if (event.type === 'customer.subscription.deleted') {
    const sub      = event.data.object;
    const customer = await stripe.customers.retrieve(sub.customer);
    const email    = customer.email?.toLowerCase();

    if (email) {
      await supabase
        .from('clients')
        .update({ active: false })
        .eq('email', email);
      console.log(`Plan cancelado para ${email}`);
    }
  }

  return res.status(200).json({ received: true });
}
