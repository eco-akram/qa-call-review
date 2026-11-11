# QA call review

A reviewer tool for checking AI-written collections-call summaries against their transcripts. Calls and review decisions are stored in Neon (PostgreSQL).

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL` to your Neon connection string.
2. Create the tables and load the calls:

   ```bash
   npm run db:setup
   ```

   This runs `db/schema.sql`, upserts `data/candidate-calls.json` into `calls`, and imports any decisions from the old file-based `data/reviews.json`. It is safe to re-run.

3. `npm run dev` and open http://localhost:3000.

## Importing calls

Use **Import calls** in the sidebar to upload a JSON file in the same format as `data/candidate-calls.json` (an array of `id`, `call_date`, `estimated_duration`, `transcript`, `summary`).

- Calls whose `id` already exists are **skipped and left unchanged**; the result lists them.
- If an `id` appears twice in the file, the first copy is used.
- If any record is invalid (missing field, impossible date, not JSON), nothing is imported and the problems are listed.
- Files up to 3.5 MB / 2,000 calls.

From the command line, `db:setup` can also load a file. Unlike the button, it **updates** existing calls whose content differs:

```bash
npm run db:setup -- path/to/more-calls.json
```

## Deploying to Vercel

- Add `DATABASE_URL` in the Vercel project's **Settings → Environment Variables** (the Neon integration for Vercel sets it automatically).
- Run `npm run db:setup` once against the production database from your machine. The deploy itself does not change the schema.

## Data model

- `calls`: one row per call.
- **Delete call** (top right of a call) permanently removes the call and all of its reviews, after a confirmation dialog.
- `reviews`: one row per decision (`approve`, `reject`, `needs_edit`) with a reason of up to 280 characters. Updating a review adds a row, so the history is kept; the app shows the latest decision per call.
