export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Static assets with env var injection for HTML pages
    if (path === '/' || path === '/index.html') {
      const response = await env.ASSETS.fetch(request);
      let html = await response.text();
      
      const stripeKey = env.STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder';
      html = html.replace('{{STRIPE_PUBLISHABLE_KEY}}', stripeKey);
      
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
        }
      });
    }
    if (path === '/success' || path === '/success.html') {
      const response = await env.ASSETS.fetch(new Request(url.origin + '/success.html'));
      let html = await response.text();
      
      const voiceNumber = env.XAI_VOICE_NUMBER || 'Number coming soon';
      html = html.replace('{{XAI_VOICE_NUMBER}}', voiceNumber);
      
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
        }
      });
    }
    if (path.startsWith('/static/')) {
      return env.ASSETS.fetch(request);
    }

    // API routes
    // CORS preflight for voice APIs
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        }
      });
    }

    if (path === '/api/health' && request.method === 'GET') {
      return new Response(JSON.stringify({ status: 'ok', timestamp: Date.now() }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/session' && request.method === 'GET') {
      return handleGetSession(request, env);
    }

    if (path === '/api/create-checkout-session' && request.method === 'POST') {
      return handleCreateCheckout(request, env);
    }

    if (path === '/api/webhook' && request.method === 'POST') {
      return handleWebhook(request, env);
    }

    if (path === '/api/verify-code' && request.method === 'POST') {
      return handleVerifyCode(request, env);
    }

    if (path === '/api/save-answer' && request.method === 'POST') {
      return handleSaveAnswer(request, env);
    }

    if (path === '/api/complete' && request.method === 'POST') {
      return handleComplete(request, env);
    }

    if (path === '/api/get-assessment' && request.method === 'POST') {
      return handleGetAssessment(request, env);
    }

    return new Response('Not Found', { status: 404 });
  }
};

async function handleCreateCheckout(request, env) {
  try {
    if (!env.STRIPE_SECRET_KEY) {
      return new Response(JSON.stringify({ 
        error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const origin = new URL(request.url).origin;

    // Create Stripe Checkout Session using fetch (no SDK needed)
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'mode': 'payment',
        'line_items[0][price_data][currency]': 'aud',
        'line_items[0][price_data][product_data][name]': 'AI Readiness Assessment',
        'line_items[0][price_data][product_data][description]': 'Complete AI readiness assessment with phone consultation (18-28 minutes)',
        'line_items[0][price_data][unit_amount]': '100000',
        'line_items[0][quantity]': '1',
        'payment_method_types[0]': 'card',
        'billing_address_collection': 'auto',
        'success_url': `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
        'cancel_url': `${origin}/`,
        'metadata[product]': 'ai_readiness_assessment',
      }).toString()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Stripe API error: ${error}`);
    }

    const session = await response.json();

    return new Response(JSON.stringify({ sessionId: session.id }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleWebhook(request, env) {
  try {
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
      console.error('Stripe webhook not configured');
      return new Response('Webhook not configured', { status: 500 });
    }

    const signature = request.headers.get('stripe-signature');
    const body = await request.text();

    // Verify webhook signature using Web Crypto
    const verified = await verifyStripeSignature(body, signature, env.STRIPE_WEBHOOK_SECRET);
    if (!verified) {
      console.error('Webhook signature verification failed');
      return new Response('Webhook signature verification failed', { status: 400 });
    }

    const event = JSON.parse(body);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      
      // Generate unique 6-digit code
      const code = await generateUniqueCode(env.DB);
      const email = session.customer_email || session.customer_details?.email || 'unknown@example.com';
      
      // Store in database
      await env.DB.prepare(
        'INSERT INTO access_codes (code, email, checkout_session_id, paid_at, status) VALUES (?, ?, ?, ?, ?)'
      ).bind(code, email, session.id, Math.floor(Date.now() / 1000), 'unused').run();

      console.log(`Created access code ${code} for ${email} (session ${session.id})`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Verify Stripe webhook signature using Web Crypto API (Workers-compatible)
async function verifyStripeSignature(payload, signatureHeader, secret) {
  const encoder = new TextEncoder();
  
  // Parse signature header (format: t=timestamp,v1=signature)
  const signatures = signatureHeader.split(',').reduce((acc, part) => {
    const [key, value] = part.split('=');
    acc[key] = value;
    return acc;
  }, {});

  const timestamp = signatures.t;
  const expectedSignature = signatures.v1;

  if (!timestamp || !expectedSignature) {
    return false;
  }

  // Create signed payload: timestamp.payload
  const signedPayload = `${timestamp}.${payload}`;

  // Import secret as crypto key
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Generate signature
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signedPayload)
  );

  // Convert to hex string
  const computedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time comparison
  return computedSignature === expectedSignature;
}

async function generateUniqueCode(db) {
  let attempts = 0;
  while (attempts < 100) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    const existing = await db.prepare('SELECT code FROM access_codes WHERE code = ?').bind(code).first();
    
    if (!existing) {
      return code;
    }
    attempts++;
  }
  throw new Error('Failed to generate unique code');
}

async function handleVerifyCode(request, env) {
  try {
    const { code } = await request.json();

    if (!code || !/^\d{6}$/.test(code)) {
      return new Response(JSON.stringify({ valid: false, error: 'Invalid code format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const result = await env.DB.prepare(
      'SELECT code, email, status FROM access_codes WHERE code = ?'
    ).bind(code).first();

    if (!result) {
      return new Response(JSON.stringify({ valid: false, error: 'Code not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Update status to in_progress if unused
    if (result.status === 'unused') {
      await env.DB.prepare(
        'UPDATE access_codes SET status = ?, updated_at = ? WHERE code = ?'
      ).bind('in_progress', Math.floor(Date.now() / 1000), code).run();
    }

    return new Response(JSON.stringify({ 
      valid: true, 
      email: result.email,
      status: result.status === 'unused' ? 'in_progress' : result.status
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (error) {
    console.error('Verify code error:', error);
    return new Response(JSON.stringify({ valid: false, error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

async function handleSaveAnswer(request, env) {
  try {
    const { code, phase, question, answer } = await request.json();

    if (!code || !phase || !question || !answer) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Verify code exists
    const codeExists = await env.DB.prepare(
      'SELECT code FROM access_codes WHERE code = ?'
    ).bind(code).first();

    if (!codeExists) {
      return new Response(JSON.stringify({ error: 'Invalid code' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    await env.DB.prepare(
      'INSERT INTO answers (code, phase, question, answer) VALUES (?, ?, ?, ?)'
    ).bind(code, phase, question, answer).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (error) {
    console.error('Save answer error:', error);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

async function handleComplete(request, env) {
  try {
    const { code } = await request.json();

    if (!code) {
      return new Response(JSON.stringify({ error: 'Missing code' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    await env.DB.prepare(
      'UPDATE access_codes SET status = ?, updated_at = ? WHERE code = ?'
    ).bind('complete', Math.floor(Date.now() / 1000), code).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (error) {
    console.error('Complete error:', error);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

async function handleGetSession(request, env) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('session_id');

    // Require cs_ session id format to prevent leaking emails to random guessers
    if (!sessionId || !sessionId.startsWith('cs_')) {
      return new Response(JSON.stringify({ error: 'Invalid session_id format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await env.DB.prepare(
      'SELECT code, email, status FROM access_codes WHERE checkout_session_id = ?'
    ).bind(sessionId).first();

    if (!result) {
      return new Response(JSON.stringify({ 
        error: 'Session not found',
        message: 'Webhook may still be processing. Please wait a moment and refresh.'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      code: result.code,
      email: result.email,
      status: result.status
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Get session error:', error);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleGetAssessment(request, env) {
  try {
    const { code } = await request.json();

    if (!code) {
      return new Response(JSON.stringify({ error: 'Missing code' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const codeData = await env.DB.prepare(
      'SELECT * FROM access_codes WHERE code = ?'
    ).bind(code).first();

    if (!codeData) {
      return new Response(JSON.stringify({ error: 'Code not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const answers = await env.DB.prepare(
      'SELECT phase, question, answer, created_at FROM answers WHERE code = ? ORDER BY created_at ASC'
    ).bind(code).all();

    return new Response(JSON.stringify({
      code: codeData.code,
      email: codeData.email,
      status: codeData.status,
      paid_at: codeData.paid_at,
      answers: answers.results || []
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (error) {
    console.error('Get assessment error:', error);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
