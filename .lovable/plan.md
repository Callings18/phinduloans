## What's happening (the diagnosis)

Your repayment SMS are being sent multiple times. I traced it in the live data and found three compounding causes:

### 1. Two identical "send" robots are running at the same time
There are **two duplicate scheduled jobs** both draining the SMS queue every 5 minutes:
- `process-notification-queue` (job 1)
- `process-notification-queue-5min` (job 11)

Both wake up at the same moment, both grab the *same* batch of pending messages, and both send them — so every message goes out **at least twice**. (There are also two duplicate payment-reminder jobs both set to 11:00.)

### 2. No "lock" while sending
The queue processor reads up to 50 "pending" messages, then sends them one by one. Because nothing marks a message as "being worked on", the two robots above (and overlapping runs) both see the same rows as still "pending" and re-send them. This is why the logs show bursts of 16–47 SMS rows every 5 minutes for the same payment.

### 3. Failed messages get re-sent forever
When the SMS provider returns an ambiguous/failed response (e.g. "credits exceeded"), the message often **was still delivered** to the phone, but our system marks it failed and leaves it "pending", so the next cycle sends it again. The SMS edge function also logs a brand-new row each attempt instead of updating the original, so nothing ties the attempts together.

Net effect: one repayment → many real SMS to the borrower, and clients call in complaining.

## The fix

### Step 1 — Remove the duplicate scheduled jobs
- Unschedule the redundant `process-notification-queue-5min` job, keeping a single queue drainer.
- Collapse the two payment-reminder jobs that both fire at 11:00 down to one.

### Step 2 — Make sending atomic (one message = one send)
- Add a database function that **claims** pending messages using row locking (`FOR UPDATE SKIP LOCKED`) and flips them to a `processing` state in the same step, before any send happens.
- Update the queue processor to call this claim function instead of a plain `SELECT ... WHERE status='pending'`. This guarantees that even if two runs overlap, a message can only ever be picked up once.

### Step 3 — Stop re-sending delivered/failed messages
- After a send attempt, always move the message out of the re-send pool: mark it `sent` on success and `failed` on a real failure — never leave it `pending` to be retried blindly.
- Treat provider "soft failures" (like credit limits) as terminal so they are not re-dispatched. Genuine transient errors keep the existing capped retry count, but the row is held in `processing`/`failed`, not `pending`, between attempts.
- Stop the SMS function from inserting a fresh log row per attempt; instead update the existing queued row so each message has exactly one record.

### Step 4 — Add a safety dedup guard
- Add a uniqueness guard (on the existing idempotency key, plus a short time window per recipient+message) so the same payment notification cannot be queued or sent twice even if a repayment is processed more than once.

### Step 5 — Clean up the current backlog
- Cancel any messages still stuck in `pending` so the fix doesn't release the existing backlog as a final burst.

## Technical notes
- Cron changes run via the data/insert tool (`cron.unschedule`), not a schema migration, since the commands contain the project URL and key.
- The claim function and any dedup constraint go in via a migration.
- Edge functions affected: `process-notification-queue` (claim + terminal status handling) and the SMS sender (`excite-sms` / `send-notification`) to update rather than insert.
- No UI changes; this is entirely backend/notification-pipeline work.
- After deploying, I'll do a live repayment test and confirm in the logs that exactly one SMS row is created and sent per event.
