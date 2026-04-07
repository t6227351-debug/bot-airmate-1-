import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Mapeo: importe en céntimos → plan
// Solo Agente (recurrente)
// 29,99€ = 2999 | 39,99€ = 3999 | 69,99€ = 6999
// Mantenimiento web (recurrente)
// 39€ = 3900 | 59€ = 5900 | 99€ = 9900
// Setup web (único)
// 250€ = 25000 | 400€ = 40000 | 800€ = 80000
const AMOUNT_TO_PLAN = {
  2999:  'start',
  3999:  'growth',
  6999:  'pro',
  3900:  'start',
  5900:  'growth',
  9900:  'pro',
  25000: 'start',
  40000: 'growth',
  80000: 'pro',
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
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

  // ── Pago completado ──────────────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email  = session.customer_details?.email?.toLowerCase();
    const amount = session.amount_total;
    const plan   = AMOUNT_TO_PLAN[amount];

    console.log(`✅ Pago: email=${email} amount=${amount} plan=${plan}`);

    if (email && plan) {
      const { error } = await supabase
        .from('clients')
        .update({ active: true, plan })
        .eq('email', email);

      if (error) console.error('Supabase error:', error);
      else console.log(`✅ Plan ${plan} activado para ${email}`);
    }
  }

  // ── Suscripción cancelada ────────────────────────────────
  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    const customer = await stripe.customers.retrieve(sub.customer);
    const email = customer.email?.toLowerCase();

    if (email) {
      await supabase
        .from('clients')
        .update({ active: false })
        .eq('email', email);
      console.log(`❌ Plan cancelado para ${email}`);
    }
  }

  return res.status(200).json({ received: true });
}
