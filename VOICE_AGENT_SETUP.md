# xAI Voice Agent Setup Guide

This guide walks you through setting up the Grok Voice agent in xAI Voice Agent Builder.

## Prerequisites

- xAI account (sign up at https://x.ai)
- Deployed Cloudflare Worker (see main README for deployment instructions)
- Your Worker URL (e.g., `https://readiness.your-subdomain.workers.dev`)

## Step-by-Step Setup

### 1. Access xAI Voice Agent Builder

Go to https://x.ai/voice and sign in.

### 2. Create New Voice Agent

Click "Create New Agent" or similar option.

### 3. Basic Configuration

- **Name:** AI Readiness Assessment Consultant
- **Voice:** `eve` (select from dropdown)
- **Model:** `grok-voice-latest` (select from dropdown)

### 4. System Prompt / Instructions

Copy and paste the **entire contents** of `voice/instructions.md` into the system prompt field.

**Key points from the instructions:**
- Agent is a curious consultant, NOT a salesperson
- MUST verify 6-digit access code first using `verify_code` tool
- Never recommends specific tools by name
- Quantifies everything (hours, dollars, frequency)
- Saves answers after each substantial response
- Targets 18-28 minutes total call duration

### 5. Context / Knowledge Base

Upload or paste the contents of `voice/question-bank.md` as additional context.

This provides the agent with the complete question set organized by phase.

### 6. Configure Tools / Function Calling

Add three custom tools that make HTTP requests to your Worker:

#### Tool 1: verify_code

- **Name:** `verify_code`
- **Description:** "Verify a 6-digit access code at the beginning of the call. Must be called first before proceeding with assessment."
- **Method:** POST
- **URL:** `https://your-worker.workers.dev/api/verify-code`
- **Headers:** 
  - `Content-Type: application/json`
- **Request Body Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "code": {
        "type": "string",
        "description": "The 6-digit access code provided by the caller"
      }
    },
    "required": ["code"]
  }
  ```

#### Tool 2: save_answer

- **Name:** `save_answer`
- **Description:** "Save a customer's answer to a question. Call this after each substantial answer or cluster of related answers."
- **Method:** POST
- **URL:** `https://your-worker.workers.dev/api/save-answer`
- **Headers:**
  - `Content-Type: application/json`
- **Request Body Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "code": {
        "type": "string",
        "description": "The verified 6-digit access code"
      },
      "phase": {
        "type": "string",
        "description": "The phase of the assessment",
        "enum": [
          "Phase 1: Business DNA",
          "Phase 2: Customer Journey & Operations",
          "Phase 3: Hidden Labor",
          "Phase 4: Investment Lens",
          "Phase 5: Industry Probes"
        ]
      },
      "question": {
        "type": "string",
        "description": "The question that was asked"
      },
      "answer": {
        "type": "string",
        "description": "The customer's answer, captured verbatim or summarized accurately"
      }
    },
    "required": ["code", "phase", "question", "answer"]
  }
  ```

#### Tool 3: complete_assessment

- **Name:** `complete_assessment`
- **Description:** "Mark the assessment as complete. Call this at the very end after all questions have been answered and saved."
- **Method:** POST
- **URL:** `https://your-worker.workers.dev/api/complete`
- **Headers:**
  - `Content-Type: application/json`
- **Request Body Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "code": {
        "type": "string",
        "description": "The verified 6-digit access code"
      }
    },
    "required": ["code"]
  }
  ```

### 7. Voice Settings

- **Turn detection:** Server VAD
- **Threshold:** 0.5
- **Prefix padding:** 300ms
- **Silence duration:** 700ms
- **Temperature:** 0.7
- **Max output tokens:** 4096

See `voice/xai-session.json` for the full session configuration if xAI Voice Agent Builder supports JSON import.

### 8. Get Phone Number

After creating the agent, xAI Voice Agent Builder provides a free phone number for your agent.

**Copy this phone number** and set it as an environment variable:

```bash
wrangler secret put XAI_VOICE_NUMBER
# When prompted, paste the phone number (e.g., +61412345678)
```

For local development, add to `.dev.vars`:

```
XAI_VOICE_NUMBER=+61412345678
```

### 9. Test the Agent

Call the phone number from any phone. You should hear the agent greet you and ask for your 6-digit access code.

**To get a test code:**

1. Complete a Stripe checkout on your landing page (use Stripe test mode)
2. On the success page, copy the 6-digit code
3. Call the phone number and enter the code when prompted

**Expected flow:**

1. Agent greets and asks for code
2. You provide code
3. Agent verifies code via `verify_code` API
4. If valid, agent proceeds with Phase 1 questions
5. Agent saves your answers via `save_answer` API after each response
6. Agent completes all 5 phases in 18-28 minutes
7. Agent calls `complete_assessment` API at the end
8. Agent thanks you and ends the call

### 10. Verify API Calls

Check your Worker logs to confirm the agent is making API calls:

```bash
wrangler tail
```

You should see:
- `POST /api/verify-code` when the agent verifies the code
- Multiple `POST /api/save-answer` calls as the conversation progresses
- `POST /api/complete` when the assessment finishes

### 11. Retrieve Assessment Data

Query the assessment data via API:

```bash
curl -X POST https://your-worker.workers.dev/api/get-assessment \
  -H "Content-Type: application/json" \
  -d '{"code":"123456"}'
```

You should see the full JSON with all saved answers.

## Troubleshooting

### Agent doesn't call the tools

- Verify your Worker URL is correct in tool configurations
- Check that CORS headers are working (they should be enabled in worker.js)
- Look at Worker logs with `wrangler tail` to see if requests are arriving

### Agent says code is invalid

- Verify the code exists in your D1 database
- Test the `/api/verify-code` endpoint manually with curl
- Check Worker logs for errors

### Agent doesn't save answers

- Verify the `save_answer` tool URL is correct
- Check Worker logs to see if requests are arriving
- Test the `/api/save-answer` endpoint manually with curl

### Phone number not working

- Ensure you've copied the correct number from xAI Voice Agent Builder
- Verify the number is active and not in a testing/sandbox state
- Contact xAI support if the number isn't receiving calls

## xAI Voice Agent Builder Limitations

**Note:** xAI Voice Agent Builder is a relatively new platform. As of this writing:

- The free phone number is limited to one per agent
- All buyers share the same phone number and authenticate via their unique 6-digit code
- If you need dedicated phone numbers per buyer (DIDs), you'll need to integrate with a telephony provider (Twilio, Plivo, etc.) and use xAI's WebSocket API directly

## Next Steps

Once the voice agent is working:

1. Test the full flow end-to-end with a test purchase
2. Review a few test assessment transcripts to tune the questions
3. Update `voice/instructions.md` if you want to adjust the agent's behavior
4. Re-upload the instructions to xAI Voice Agent Builder after any changes

## Support

Questions about xAI Voice Agent Builder? Check their docs or support:
- https://x.ai/docs (if available)
- https://x.ai/support

Questions about this implementation? Email okeito.s@gmail.com
