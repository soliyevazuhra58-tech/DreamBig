# DreamBig

DreamBig is a public motivational community. Create a DreamID, receive a unique CardID, and publish one motivational message every 24 hours.

## Stack
- React + TypeScript + Vite
- Supabase Auth + PostgreSQL + Row Level Security
- Responsive, mobile-first UI

## Setup
1. Create a Supabase project.
2. In Supabase SQL Editor, run `supabase/schema.sql`.
3. Copy `.env.example` to `.env` and add your Supabase project URL and anon/publishable key.
4. Run:

```bash
npm install
npm run dev
```

## Privacy
Date of birth and gender are stored in the private `profiles` table and are not exposed by the public profile view. Public profile fields are first name, username, CardID, and account creation date.

## Notes
The 24-hour posting restriction is enforced in PostgreSQL, not just in the browser, so it cannot be bypassed by changing the client.
