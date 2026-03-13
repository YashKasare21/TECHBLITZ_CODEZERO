---
name: WhatsApp Chat UI
overview: "Replace the basic WhatsApp admin page with a full chat UI: a two-panel layout with a conversation/patient list on the left and a real message thread on the right, including patient cross-referencing and one-click \"Chat\" from the patients list."
todos:
  - id: rewrite-page
    content: Complete rewrite of app/receptionist/whatsapp/page.tsx into two-panel chat UI with conversation list, patient tab, and message thread
    status: completed
  - id: increase-log-cap
    content: Increase message log cap in bot/whatsapp.ts from 50 to 300 for better chat history
    status: completed
  - id: lint-check
    content: Run bun run lint to verify no type or lint errors introduced
    status: completed
isProject: false
---

# WhatsApp Chat UI Redesign

## What exists today

- `[app/receptionist/whatsapp/page.tsx](app/receptionist/whatsapp/page.tsx)`: a QR card + basic send form + flat message log
- Bot exposes `/status`, `/messages` (last 50 across all JIDs), `/send`
- Patients stored in Supabase with nullable `phone` field
- No per-JID grouping; no patient ↔ JID matching

## New UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Header: WhatsApp  [● Status Badge]  [Refresh]               │
│ [QR banner — compact, only shown when not connected]        │
├──────────────────────┬──────────────────────────────────────┤
│  Left panel (320px)  │  Right panel (flex-1)                │
│  ─────────────────── │  ──────────────────────────────────  │
│  Tabs: Chats | People│  [Chat header: name + phone]         │
│  [Search input]      │  [Message bubbles (ScrollArea)]      │
│  [Thread list OR     │  [Textarea + Send button]            │
│   Patient list]      │                                      │
└──────────────────────┴──────────────────────────────────────┘
```

## Key Design Decisions

**Conversation threading**

- Group flat `BotMessage[]` from `/api/whatsapp/messages` by JID client-side
- Each thread shows: name (if matched to patient), phone, last message preview, time

**Patient ↔ JID matching**

- Fetch all patients from Supabase (`patients` table, `phone` field)
- Normalize both phone sources by stripping non-digits before comparing
- JID `919876543210@s.whatsapp.net` → `919876543210` matches patient phone `919876543210`

**People tab**

- Lists all patients, sorted by those with a phone number first
- Patients with phone: green WhatsApp icon + "Chat" button → opens right panel pre-selected to their JID
- Patients without phone: greyed out, no action

**QR code**

- Compact banner/alert strip under the header instead of half-page card
- Disappears once connected

**Sending messages**

- Input at the bottom of the right panel (not a separate card)
- Pressing Enter or clicking Send calls `/api/whatsapp/send`
- Optimistic message append → refetch after 1s

## Files to Change

`**[app/receptionist/whatsapp/page.tsx](app/receptionist/whatsapp/page.tsx)`** — complete rewrite

- New state: `patients`, `selectedJid`, `leftTab`, `inputText`, `patientSearch`
- Derived state: `conversations` (grouped & sorted), `patientMap` (phone → Patient), `activeMessages`
- Full two-panel layout with left sidebar tabs and right chat window

`**[bot/whatsapp.ts](bot/whatsapp.ts)**` — minor change

- Increase in-memory message log cap from `slice(-50)` to `slice(-300)` so the chat UI has useful history

## What stays unchanged

- All 3 API proxy routes (`/api/whatsapp/*`) — no changes needed
- `bot/index.ts` — no new endpoints needed (client-side filtering is sufficient)
- Patient schema and Supabase queries

