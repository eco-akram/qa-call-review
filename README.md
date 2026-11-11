# QA call review

A reviewer tool for checking AI-written collections-call summaries against their transcripts. Calls and review decisions are stored in Neon (PostgreSQL).

## What the app does

An AI writes a short summary of each debt-collection call. A QA reviewer uses this app to check whether each summary is faithful to what was actually said, and records a decision.

### Reviewing a call

- **Sidebar:** every call with its date, length and review status (Pending, Approved, Rejected, Needs edit), plus a progress bar. A red number next to a call shows how many facts in its summary were automatically flagged, so reviewers can prioritise those.
- **Transcript (left):** the call split into turns, each with its turn ID (`T01`, `T02`…), timestamp and speaker. Turn IDs are what reviewers cite as evidence.
- **Summary (right):** the AI summary split into numbered sentences (`S1`, `S2`…).
- **Decision:** **Approve**, **Reject** or **Needs edit**, with a short reason (up to 280 characters; required for Reject and Needs edit). Changing a decision later keeps the earlier ones as history.

### Finding the evidence

Clicking a summary sentence highlights the transcript turns most likely to support it and scrolls to the best match. The words the sentence and turn have in common are marked. Matching is based on word overlap, with rarer words counting for more. It also understands that, for example, "five hundred pounds" means "£500" and "the twenty-third of October" means "23 October".

### Flagging inconsistencies

The app compares the **amounts, dates, times and durations** in each summary with those spoken in the transcript and flags:

- **Possible wrong values**: e.g. the summary says "14 December" but the transcript says "the fourth of December" (T13). The wrong value is underlined in red and the conflicting transcript wording is shown with a link to its turn.
- **Unsupported values**: the summary gives an amount, date, time or duration of a kind the transcript never mentions.

Relative dates such as "Friday" or "tomorrow" are resolved from the call date.

If a reviewer tries to **approve** a summary that has flagged issues, the app asks them to confirm first ("This summary has 1 flagged issue. Approve anyway?"), with a shortcut to show the issues.

> The checks are an aid, not a verdict. They catch numeric mistakes reliably, but they do **not** detect non-numeric errors (for example, a summary saying the customer called in when the agent placed the call) or breaches of the summary-writing rules (`data/summary-rules.txt`). Reviewers still need to read each summary.

### Managing calls

- **Import calls** (sidebar): upload a JSON file of calls. Existing calls are never changed (see [Importing calls](#importing-calls)).
- **Delete call** (top right of a call): permanently removes the call and all of its reviews, after a confirmation that states how many reviews will go.

### Accessibility

The decision buttons, warnings and highlights meet WCAG AA contrast in light and dark mode, and the selected decision is shown by an outline as well as colour. The decision buttons work as a radio group (arrow keys, one Tab stop), and dialogs and status messages are announced to screen readers. Press <kbd>d</kbd> to toggle dark mode and <kbd>Esc</kbd> to clear a sentence highlight.

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL` to your Neon connection string.
2. Create the tables and load the calls:

   ```bash
   npm run db:setup
   ```

   This runs `db/schema.sql`, upserts `data/candidate-calls.json` into `calls`, and imports any decisions from the old file-based `data/reviews.json`. It is safe to re-run.

3. `npm run dev` and open http://localhost:3000.

## Sample data

- `data/candidate-calls.json`: the 20 synthetic calls supplied with the brief (see `data/candidate-readme.md`).
- `data/mock-calls.json`: 5 extra fictional calls (`CALL-021` to `CALL-025`) for trying the import button. Two contain deliberate errors the checker should flag: a wrong date in `CALL-022` and a wrong amount in `CALL-023`.
- `data/mock-calls-2.json`: 10 more fictional calls (`CALL-026` to `CALL-035`) covering the less common call types in the summary rules. Four summaries contain deliberate errors:

  | Call | Scenario | Summary | Flagged by the app? |
  |---|---|---|---|
  | `CALL-026` | Wrong number | Accurate | – |
  | `CALL-027` | Voicemail, no message left | Accurate | – |
  | `CALL-028` | Internal agent consultation | Accurate | – |
  | `CALL-029` | Incomplete call (one line) | Accurate | – |
  | `CALL-030` | I&E refused, risk of further action warning | **Wrong time:** "after 5 pm", transcript says "after four" (T19) | Yes |
  | `CALL-031` | Third party without Authority to Act | **Wrong claims:** says Authority to Act was verified and arrears were discussed; the agent refused to discuss the account (T03, T05) | **No:** non-numeric errors are not detected |
  | `CALL-032` | Card payment declined, then promise to pay | Accurate | – |
  | `CALL-033` | New Direct Debit, with an ASR hallucination block (T08) to ignore | Accurate | – |
  | `CALL-034` | Redundancy, consent, 30-day hold | **Wrong referral:** "National Debtline", transcript says Citizens Advice (T11) | Yes, as a name not in the transcript |
  | `CALL-035` | Debt management company with a letter of authority | **Wrong date:** "1 January", transcript says "the first of December" (T08) | Yes |

  `CALL-031` deliberately shows the checker's limit: a reviewer has to catch it by reading.

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

> There is no login yet: anyone with the URL can view calls, save reviews, import and delete calls. Add authentication before using real customer data.

## Data model

- `calls`: one row per call.
- `reviews`: one row per decision (`approve`, `reject`, `needs_edit`) with a reason of up to 280 characters. Updating a review adds a row, so the history is kept; the app shows the latest decision per call. Deleting a call deletes its reviews.
