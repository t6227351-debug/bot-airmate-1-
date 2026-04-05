const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqb2Z4bWZ3ZHlia3Rwd2l1YW5jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQ3NTk0NiwiZXhwIjoyMDkwMDUxOTQ2fQ.08g-CtdJ0BvgE3U4v9JppA_114EN24KBs7iBpUaw9cs';
const SB_URL = 'https://vjofxmfwdybktpwiuanc.supabase.co';

async function sbFetch(path, opts = {}) {
  return fetch(`${SB_URL}${path}`, {
    ...opts,
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    }
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Secret guard — only allow calls from trusted origin
  const token = req.headers['x-migrate-token'] || req.query?.token;
  if (token !== 'airmate2026') return res.status(403).json({ error: 'Forbidden' });

  const results = [];

  // Step 1: Add columns to web_requests one by one (PostgREST doesn't support DDL,
  // so we use a custom RPC. We'll try inserting a test row to detect missing columns
  // and use PATCH workaround.)
  //
  // Real approach: use the Supabase pg connection via a direct SQL call.
  // Since that's not available via REST, we'll use the "supabase_migrations" workaround:
  // try inserting with all fields — if it fails, we know what to fix.

  const testPayload = {
    business_name: '__migrate_test__',
    business_type: 'test',
    instagram: null,
    google_maps: null,
    phone: '000',
    email: 'migrate@test.com',
    description: null,
    status: 'pending',
    notes: null
  };

  // Try inserting — this tells us if columns exist
  const insertRes = await sbFetch('/rest/v1/web_requests', {
    method: 'POST',
    headers: { 'Prefer': 'return=representation' },
    body: JSON.stringify([testPayload])
  });

  const insertBody = await insertRes.json();

  if (insertRes.ok) {
    // Insert worked — columns exist! Clean up test row
    const id = insertBody[0]?.id;
    if (id) {
      await sbFetch(`/rest/v1/web_requests?id=eq.${id}`, { method: 'DELETE' });
    }
    results.push({ step: 'web_requests insert', status: 'ok — columns exist' });
  } else {
    // Columns missing — need DDL. Report the error.
    results.push({ step: 'web_requests insert', status: 'failed', error: insertBody });
    // Attempt: create an exec_sql function via a schema-level operation
    // This is a known Supabase workaround: POST to /rest/v1/rpc/exec_sql
    // but we need to create it first — not possible without direct DB access.
    // Return instructions instead.
    return res.status(200).json({
      success: false,
      message: 'Columns missing. Run this SQL in Supabase Dashboard → SQL Editor:',
      sql: `ALTER TABLE web_requests ADD COLUMN IF NOT EXISTS business_name text, ADD COLUMN IF NOT EXISTS business_type text, ADD COLUMN IF NOT EXISTS instagram text, ADD COLUMN IF NOT EXISTS google_maps text, ADD COLUMN IF NOT EXISTS phone text, ADD COLUMN IF NOT EXISTS email text, ADD COLUMN IF NOT EXISTS description text, ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending', ADD COLUMN IF NOT EXISTS notes text; ALTER TABLE clients ADD COLUMN IF NOT EXISTS cancelled_at timestamptz; ALTER TABLE web_requests ENABLE ROW LEVEL SECURITY; DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='web_requests' AND policyname='anon_insert') THEN CREATE POLICY anon_insert ON web_requests FOR INSERT WITH CHECK (true); END IF; END $$; DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='web_requests' AND policyname='all_select') THEN CREATE POLICY all_select ON web_requests FOR SELECT USING (true); END IF; END $$; DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='web_requests' AND policyname='all_update') THEN CREATE POLICY all_update ON web_requests FOR UPDATE USING (true); END IF; END $$;`,
      results
    });
  }

  // Step 2: Check clients table for cancelled_at
  const clientTest = await sbFetch('/rest/v1/clients?select=cancelled_at&limit=1');
  if (clientTest.ok) {
    results.push({ step: 'clients.cancelled_at', status: 'ok — column exists' });
  } else {
    results.push({ step: 'clients.cancelled_at', status: 'missing', note: 'Run: ALTER TABLE clients ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;' });
  }

  return res.status(200).json({ success: true, results });
}
