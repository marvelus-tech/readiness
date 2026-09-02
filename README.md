# AI Readiness Assessment

**Owner:** O'keito S., Melbourne  
**Email:** okeito.s@gmail.com

## Product Overview

Businesses pay **$1,000 AUD** via Stripe Checkout for an AI Readiness Assessment. After payment, they receive:
- A phone number to call (via xAI Voice Agent)
- A unique 6-digit access code
- 18-28 minute consultation with a curious consultant (not a salesperson)

The Grok Voice agent (xAI) runs a structured questionnaire that maps where the business leaks time and money. All answers are stored as JSON; no $1,000 PDF report is generated.

---

## Architecture

- **Stack:** Cloudflare Worker + D1 database + static HTML/CSS/JS
- **Voice Agent:** xAI Grok Voice (`wss://api.x.ai/v1/realtime`, model `grok-voice-latest`, voice `eve`)
- **Payment:** Stripe Checkout Session (one-time $1,000 AUD)
  - Uses native fetch + Web Crypto (no Stripe SDK, fully Workers-compatible)
  - Webhook signature verification via Web Crypto HMAC-SHA256
- **Webhook:** `checkout.session.completed` mints a 6-digit code
- **Success page:** Polls `/api/session` for real code (webhook can lag)

---

## Directory Structure

```
/workspace
├── public/
│   ├── index.html          # Landing page
│   └── success.html        # Payment success page with code
├── src/
│   └── worker.js           # Cloudflare Worker (APIs + routing)
├── voice/
│   ├── instructions.md     # Voice agent system prompt (paste into xAI Voice Agent Builder)
│   ├── question-bank.md    # Full question set by phase
│   └── xai-session.json    # session.update config for xAI Voice Agent Builder
├── schema.sql              # D1 database schema
├── wrangler.jsonc          # Cloudflare Worker config
├── package.json            # Dependencies
└── README.md               # This file
```

---

## Environment Variables

### Required for Production
Set these in Cloudflare dashboard or via `wrangler secret put`:

```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
XAI_API_KEY=xai-...
XAI_VOICE_NUMBER=+1234567890  # Phone number from xAI Voice Agent Builder
```

**Important:** `XAI_VOICE_NUMBER` is displayed on the success page. If not set, displays "Number coming soon".

### Local Development (Test Mode)
Create a `.dev.vars` file in the project root:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
XAI_API_KEY=xai-...
XAI_VOICE_NUMBER=+1234567890
```

**Note:** If Stripe keys are missing or set to placeholders, the landing page will show an error explaining this is expected for local dev without keys.

---

## Setup Instructions

### 1. Clone and Install

```bash
git clone <repo-url>
cd workspace
npm install
```

### 2. Initialize D1 Database

**For local development:**

```bash
npm run db:init
```

This creates a local D1 database and applies the schema from `schema.sql`.

**For production:**

First, create the production database:

```bash
wrangler d1 create readiness-db
```

Copy the `database_id` from the output and update `wrangler.jsonc`:

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "readiness-db",
      "database_id": "<paste-your-production-database-id-here>"
    }
  ]
}
```

**Important:** Replace the `database_id: "local"` comment with the actual UUID from the wrangler output.

Then apply the schema:

```bash
wrangler d1 execute readiness-db --file=./schema.sql
```

### 3. Configure Stripe

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Get your API keys from **Developers > API keys**
3. Create a webhook endpoint pointing to `https://your-worker.workers.dev/api/webhook`
4. Select event: `checkout.session.completed`
5. Copy the webhook signing secret

Set the secrets:

```bash
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put STRIPE_PUBLISHABLE_KEY
```

Or add them to `.dev.vars` for local testing.

### 4. Configure xAI Voice Agent

**Live Agent Details:**
- **Name:** AI Readiness Assessment
- **Voice:** Eve
- **Phone Number:** +1 (662) 370-3094
- **HTTP Tools:** Will be configured after Worker deployment (see VOICE_AGENT_SETUP.md)

1. Go to [xAI Voice Agent Builder](https://x.ai/voice)
2. Create a new agent
3. Copy and paste the contents of `voice/instructions.md` into the system prompt
4. Upload or reference `voice/question-bank.md` as context
5. Use `voice/xai-session.json` for session configuration
6. Set voice to `eve` and model to `grok-voice-latest`
7. Configure the agent to make HTTP requests to your Worker:
   - **verify_code:** `POST https://your-worker.workers.dev/api/verify-code`
   - **save_answer:** `POST https://your-worker.workers.dev/api/save-answer`
   - **complete_assessment:** `POST https://your-worker.workers.dev/api/complete`
8. Get the phone number from xAI Voice Agent Builder (included free)
9. Set the phone number as an environment variable:

```bash
wrangler secret put XAI_VOICE_NUMBER
```

### 5. Run Locally

```bash
npm run dev
```

Visit `http://localhost:8787` to see the landing page.

### 6. Deploy to Production

```bash
npm run deploy
```

Your Worker will be live at `https://readiness.<your-subdomain>.workers.dev`.

---

## Testing Locally

### Test Stripe Checkout (without keys)

If you don't have Stripe keys configured, the landing page will show:

> "Stripe is not configured. Please set STRIPE_PUBLISHABLE_KEY environment variable. This is expected for local development without keys."

This is intentional. The product is functional; you just need to add test keys to complete a checkout.

### Test Stripe Checkout (with test keys)

1. Set `STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` in `.dev.vars`
2. Run `npm run dev`
3. Click "Buy the assessment"
4. Use Stripe test card: `4242 4242 4242 4242`, any future expiry, any CVC
5. Complete checkout
6. You'll be redirected to `/success?session_id=...`

### Test Webhook Locally

Use the Stripe CLI to forward webhooks:

```bash
stripe listen --forward-to localhost:8787/api/webhook
```

Copy the webhook signing secret and add to `.dev.vars`:

```
STRIPE_WEBHOOK_SECRET=whsec_...
```

Trigger a test webhook:

```bash
stripe trigger checkout.session.completed
```

Check the terminal logs. You should see a 6-digit code generated and stored.

### Test APIs

**Health check:**

```bash
curl http://localhost:8787/api/health
```

**Verify a code:**

```bash
curl -X POST http://localhost:8787/api/verify-code \
  -H "Content-Type: application/json" \
  -d '{"code":"123456"}'
```

**Save an answer:**

```bash
curl -X POST http://localhost:8787/api/save-answer \
  -H "Content-Type: application/json" \
  -d '{
    "code": "123456",
    "phase": "Phase 1: Business DNA",
    "question": "What does your business do?",
    "answer": "We run a consulting firm."
  }'
```

**Complete assessment:**

```bash
curl -X POST http://localhost:8787/api/complete \
  -H "Content-Type: application/json" \
  -d '{"code":"123456"}'
```

**Get assessment data:**

```bash
curl -X POST http://localhost:8787/api/get-assessment \
  -H "Content-Type: application/json" \
  -d '{"code":"123456"}'
```

---

## Production Deployment Checklist

- [ ] D1 database created and schema applied
- [ ] Stripe production keys set as secrets
- [ ] Stripe webhook endpoint created for production URL
- [ ] xAI Voice Agent configured and phone number obtained
- [ ] `XAI_VOICE_NUMBER` set as secret
- [ ] Worker deployed via `npm run deploy`
- [ ] Landing page loads at production URL
- [ ] Stripe Checkout works with production keys
- [ ] Webhook receives events and mints codes
- [ ] Success page displays phone number and code
- [ ] Voice agent can verify codes via API
- [ ] Voice agent can save answers via API
- [ ] Voice agent can complete assessments via API

---

## Design Specifications

### Colors
- **Background:** `#14110e`
- **Ink (text):** `#f3ece3`
- **Muted text:** `#9a9186`
- **Accent:** `#c45c26`

### Fonts
- **Headings:** Fraunces (serif, 700 weight)
- **Body:** IBM Plex Sans (sans-serif, 400-600 weights)

### Tone
Curious consultant, not salesperson. Professional but conversational. Focus on quantifying where the business leaks time and money.

---

## Voice Agent Instructions Summary

The voice agent (Grok, voice `eve`) follows this flow:

1. **Verify code** using `verify_code` tool (required first step)
2. **Phase 1:** Business DNA (3-5 min)
3. **Phase 2:** Customer journey and operations (8-12 min)
4. **Phase 3:** Hidden labor rapid-fire (4-6 min)
5. **Phase 4:** Investment lens (3-5 min)
6. **Phase 5:** Industry-specific probes (2-4 min)
7. **Complete** using `complete_assessment` tool

**Critical rules:**
- Never recommend specific tools by name
- Quantify everything (hours, dollars, frequency)
- Save answers after each substantial response using `save_answer` tool
- Target 18-28 minutes total
- Be curious, not prescriptive

See `voice/instructions.md` and `voice/question-bank.md` for full details.

---

## API Reference

### `POST /api/create-checkout-session`

Creates a Stripe Checkout Session for $1,000 AUD. Uses native fetch (no Stripe SDK).

**Response:**

```json
{
  "sessionId": "cs_test_..."
}
```

### `POST /api/webhook`

Stripe webhook endpoint. Listens for `checkout.session.completed` events and mints 6-digit access codes. Verifies webhook signature using Web Crypto HMAC-SHA256.

### `GET /api/session?session_id=cs_...`

Looks up access code by Stripe checkout session ID. Used by success page to poll for the real code after payment (webhook can lag up to ~20 seconds).

**Security:** Requires `session_id` parameter to start with `cs_` to prevent email leakage to random guessers.

**Request:**

```
GET /api/session?session_id=cs_test_abc123
```

**Response (found):**

```json
{
  "code": "123456",
  "email": "customer@example.com",
  "status": "unused"
}
```

**Response (not found - webhook still processing):**

```json
{
  "error": "Session not found",
  "message": "Webhook may still be processing. Please wait a moment and refresh."
}
```

### `POST /api/verify-code`

Verifies a 6-digit access code. Updates status from `unused` to `in_progress`.

**Request:**

```json
{
  "code": "123456"
}
```

**Response (valid):**

```json
{
  "valid": true,
  "email": "customer@example.com",
  "status": "in_progress"
}
```

**Response (invalid):**

```json
{
  "valid": false,
  "error": "Code not found"
}
```

### `POST /api/save-answer`

Saves a customer's answer to a question.

**Request:**

```json
{
  "code": "123456",
  "phase": "Phase 1: Business DNA",
  "question": "What does your business do?",
  "answer": "We run a consulting firm specializing in operations."
}
```

**Response:**

```json
{
  "success": true
}
```

### `POST /api/complete`

Marks an assessment as complete. Updates status to `complete`.

**Request:**

```json
{
  "code": "123456"
}
```

**Response:**

```json
{
  "success": true
}
```

### `POST /api/get-assessment`

Retrieves the full assessment data for a given code (for internal use or customer portal).

**Request:**

```json
{
  "code": "123456"
}
```

**Response:**

```json
{
  "code": "123456",
  "email": "customer@example.com",
  "status": "complete",
  "paid_at": 1693526400,
  "answers": [
    {
      "phase": "Phase 1: Business DNA",
      "question": "What does your business do?",
      "answer": "We run a consulting firm.",
      "created_at": 1693526500
    }
  ]
}
```

### `GET /api/health`

Health check endpoint.

**Response:**

```json
{
  "status": "ok",
  "timestamp": 1693526400000
}
```

---

## Database Schema

### `access_codes` Table

| Column              | Type    | Description                              |
| ------------------- | ------- | ---------------------------------------- |
| id                  | INTEGER | Primary key                              |
| code                | TEXT    | Unique 6-digit access code               |
| email               | TEXT    | Customer email from checkout             |
| checkout_session_id | TEXT    | Stripe checkout session ID (unique)      |
| paid_at             | INTEGER | Unix timestamp of payment                |
| status              | TEXT    | `unused`, `in_progress`, or `complete`   |
| created_at          | INTEGER | Unix timestamp of record creation        |
| updated_at          | INTEGER | Unix timestamp of last update            |

### `answers` Table

| Column     | Type    | Description                           |
| ---------- | ------- | ------------------------------------- |
| id         | INTEGER | Primary key                           |
| code       | TEXT    | Foreign key to `access_codes.code`    |
| phase      | TEXT    | Assessment phase name                 |
| question   | TEXT    | The question asked                    |
| answer     | TEXT    | The customer's answer                 |
| created_at | INTEGER | Unix timestamp of answer save         |

---

## Troubleshooting

### Success page shows "Processing Your Payment"

The webhook may take a few seconds to process. The success page polls `/api/session` for up to 20 seconds. If the code still doesn't appear:

1. Check that the webhook endpoint is configured in Stripe Dashboard
2. Verify `STRIPE_WEBHOOK_SECRET` is set correctly
3. Check Worker logs: `wrangler tail`
4. Confirm the webhook event was sent (check Stripe Dashboard > Developers > Webhooks > Events)

### Stripe Checkout not working

1. Check that `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` are set correctly
2. Verify you're using test keys (`sk_test_...` and `pk_test_...`) for local dev
3. Check browser console for errors (likely missing or invalid publishable key)

### Webhook not triggering

1. Ensure webhook endpoint is set to `https://your-worker.workers.dev/api/webhook`
2. Verify `STRIPE_WEBHOOK_SECRET` is set correctly
3. Use Stripe CLI to test: `stripe listen --forward-to localhost:8787/api/webhook`
4. Check Worker logs: `wrangler tail`

### Voice agent can't verify codes

1. Ensure the Worker is deployed and accessible at the configured URL
2. Test the API manually with `curl` to confirm it's working
3. Check that the voice agent is sending the correct JSON payload
4. Verify CORS headers are allowing xAI Voice Agent requests (already configured in worker.js)

### D1 database errors

1. Run `npm run db:init` to initialize local database
2. For production, ensure you've created the database with `wrangler d1 create readiness-db` and updated `wrangler.jsonc` with the real `database_id` (not "local")
3. Check database binding name in `wrangler.jsonc` matches `DB`

---

## License

Proprietary. Owner: O'keito S., Melbourne.

---

## Support

Email: okeito.s@gmail.com
