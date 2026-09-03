# AI Readiness Assessment Question Bank

This document provides the complete set of questions for the AI Readiness Assessment, organized by phase. Use these as your guide, but adapt based on the conversation flow.

---

## Phase 1: Business DNA (3-5 minutes)

### Core Identity
- What's your name and what's your role in the business?
- Tell me what your business does. Who do you serve?
- How long have you been operating?
- Are you full-time in this business or part-time?

### Revenue Structure
- In a typical week, what are the 3 things that absolutely must happen for you to generate revenue?
- Are you solo or do you have a team?
  - If team: How many people? What do they do?
- What was your revenue last year?
- Are you profitable yet?

---

## Phase 2: Customer Journey & Operations (8-12 minutes)

### Lead Acquisition
- How do customers typically find you? (referrals, ads, word-of-mouth, organic search, etc.)
- Walk me through the first 5 minutes when a new lead contacts you.
- What happens in the first hour after initial contact?

### Lead Management
- How do you track "maybe later" leads? Where do they go?
- What's your rough conversion rate from inquiry to paying customer?
- How many hours per week do you spend following up with leads that ultimately go nowhere?

### Delivery & Fulfillment
- After someone pays, what are the steps to deliver your service or product?
- Where in that delivery process do things typically get stuck or delayed?
- How much of your delivery is repeatable vs. custom for each client?

### Customer Experience
- What do customers complain about most?
- If you got 10 new customers tomorrow, what part of your business would break first?

### Daily Operations
- What software or tools do you use daily that you absolutely couldn't live without?
- How do you handle scheduling? Invoicing? Payment reminders?
- How many hours per week do you spend on tasks that don't directly generate revenue?
- Do you still do anything by hand or on paper that you suspect should be automated?

### Business Intelligence
- How do you know if you're having a good month vs. a bad month?
- What numbers do you look at to make decisions?

---

## Phase 3: Hidden Labor Rapid-Fire (4-6 minutes)

Get rough hourly estimates for each:

### Time Drains
- How many hours per week do you spend coordinating things via email?
- Data entry? (spreadsheets, CRM, databases, etc.)
- Chasing down documents or payments from customers or vendors?
- Creating the same type of content from scratch over and over?
- Fixing errors or redoing work that wasn't done right the first time?

### The 3 AM Question
- If you had to wake up at 3 AM worried about your business, what question would be keeping you up?

### Math Moment
- "Let's do some quick math. You mentioned [X hours] per week on [activity]. If we value your time at $50 per hour, that's roughly $[calculated amount] per month in hidden labor costs. Does that feel accurate to you?"

---

## Phase 4: Investment Lens (3-5 minutes)

### Value of Time
- If I could magically buy back 10 hours per week for you, what would you do with that time?
- What do you value your own hour at? (What could you charge or earn in that hour?)

### Past Attempts
- Have you tried automation or new tools before?
  - If yes: What happened? Did it work? Why or why not?
- What's held you back from investing in systems or automation in the past?

### Budget & Willingness
- What's your current monthly budget for software and tools?
- If I showed you a concrete way to save $2,000 per month (or [customize based on their hidden labor math]), what would you be willing to invest to make that happen?

---

## Phase 5: Industry-Specific Probes (2-4 minutes)

Choose 1-2 questions based on their industry from Phase 1.

### Service Business
- How do you handle scope creep? How often do clients ask for "just one more thing"?
- How much time do you spend writing proposals or quotes that never convert?

### E-commerce
- How do you manage inventory tracking? Is it manual or automated?
- What's your process for handling returns?
- How do you deal with customer support tickets? What's the volume?

### Real Estate
- How much time do you spend showing properties that don't end up closing?
- How do you keep your CRM up to date? Is it manual data entry?
- How do you follow up with past clients for referrals or repeat business?

### Healthcare (Clinics, Practices)
- How do you handle insurance claims processing?
- What's your process for patient follow-ups and reminders?
- How often do you deal with appointment no-shows? What's the cost?

### SaaS / Tech
- How do you onboard new customers? Is it mostly manual or automated?
- What's your support ticket volume? How many hours per week does your team spend on support?
- Do you track churn? What causes customers to leave?

### Local Brick-and-Mortar
- How much time do you spend hiring and training new staff?
- How do you manage inventory counts?
- Do you have a loyalty program? How do you track repeat customers?

### Professional Services (Legal, Accounting, Consulting)
- How do you track billable hours?
- How much time do you spend on non-billable admin work?
- How do you manage client communication and document requests?

### Trades / Field Services (Plumbing, HVAC, Electricians)
- How do you schedule jobs and dispatch workers?
- How do you track job completion and invoicing?
- How much time do you spend driving between jobs?

---

## Question Adaptation Guidelines

### How to Adapt in Real-Time
- **If they give a vague answer:** Ask for a specific recent example.
- **If they give a detailed answer:** Probe for quantification (hours, dollars, frequency).
- **If they seem rushed:** Skip less critical questions and focus on high-value areas.
- **If they're very engaged:** Go deeper on areas where they're revealing pain points.

### Follow-Up Prompts
- "Can you give me a specific example of that from this past week?"
- "If you had to estimate, would you say that's closer to 2 hours or 10 hours per week?"
- "What does that cost you in terms of time or money?"
- "Have you tried to solve that before? What happened?"
- "If that were automated tomorrow, what would you do with that time?"

---

## Time Management

### Target Timing by Phase
- Phase 1 (Business DNA): 3-5 minutes
- Phase 2 (Customer Journey): 8-12 minutes
- Phase 3 (Hidden Labor): 4-6 minutes
- Phase 4 (Investment Lens): 3-5 minutes
- Phase 5 (Industry Probes): 2-4 minutes
- Opening & Closing: 2-4 minutes
- **Total Target: 18-28 minutes**

### Pacing Signals
- **If ahead of schedule (12 minutes in, only Phase 2 done):** Go deeper on investment questions and industry probes.
- **If behind schedule (15 minutes in, still in Phase 2):** Skip optional sub-questions and move faster through rapid-fire.

---

## Call Closing

### Final Statements
- "Thank you so much for being open with me. You've given me a really clear picture of where time and money are leaking in your business."
- "All of your answers have been saved. You'll receive the raw transcript in JSON format."
- "This assessment is now complete. If you have any questions, you can email okeito.s@gmail.com."
- "Take care, and best of luck with your business."

### After Closing
- Call the `complete_assessment` tool to mark the code as complete.
- End the call warmly.

---

## Notes for Voice Agent

- These questions are a guide. Conversational flow is more important than rigid adherence to order.
- Always save answers after each substantial response using the `save_answer` tool.
- Never recommend tools by name.
- Always quantify: hours, dollars, frequency.
- Stay curious, not prescriptive.
