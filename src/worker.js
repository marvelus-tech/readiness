import Stripe from 'stripe';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Static assets with Stripe key injection for index.html
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
      return env.ASSETS.fetch(new Request(url.origin + '/success.html'));
    }
    if (path.startsWith('/static/')) {
      return env.ASSETS.fetch(request);
    }

    // API routes
    if (path === '/api/health' && request.method === 'GET') {
      return new Response(JSON.stringify({ status: 'ok', timestamp: Date.now() }), {
        headers: { 'Content-Type': 'application/json' }
      });
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

    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
    });

    const origin = new URL(request.url).origin;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'aud',
            product_data: {
              name: 'AI Readiness Assessment',
              description: 'Complete AI readiness assessment with phone consultation (18-28 minutes)',
            },
            unit_amount: 100000, // $1,000 AUD in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: undefined,
      billing_address_collection: 'auto',
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/`,
      metadata: {
        product: 'ai_readiness_assessment'
      }
    });

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

    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
    });

    const signature = request.headers.get('stripe-signature');
    const body = await request.text();

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return new Response('Webhook signature verification failed', { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      
      // Generate unique 6-digit code
      const code = await generateUniqueCode(env.DB);
      const email = session.customer_email || session.customer_details?.email || 'unknown@example.com';
      
      // Store in database
      await env.DB.prepare(
        'INSERT INTO access_codes (code, email, checkout_session_id, paid_at, status) VALUES (?, ?, ?, ?, ?)'
      ).bind(code, email, session.id, Math.floor(Date.now() / 1000), 'unused').run();

      console.log(`Created access code ${code} for ${email}`);
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
