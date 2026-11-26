# DreamBig

DreamBig is a simple motivational community. Create a DreamID without entering an email address, receive a unique CardID, and publish one motivational message every 24 hours.

## Stack
- React + TypeScript + Vite
- Supabase anonymous Auth + PostgreSQL + Row Level Security
- Responsive, minimal mobile-first UI

## Setup
1. Create or open the DreamBig Supabase project.
2. In Supabase SQL Editor, run `supabase/schema.sql`.
3. In Supabase Dashboard, open **Authentication → Sign In / Providers** and enable **Anonymous Sign-Ins**. Email/password sign-up and email confirmation are not used by this app.
4. Add these environment variables to Vercel (Production, Preview, and Development):
   - `VITE_SUPABASE_URL` — your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` — your Supabase anon/publishable key
5. Deploy, then open the site and create a DreamID.

For local development, copy `.env.example` to `.env`, set the same two values, then run:

```bash
npm install
npm run dev
```

## Account note
DreamBig uses a Supabase anonymous session so users do not need an email or confirmation code. The session is stored on the current device/browser. At present, there is no email-based account recovery or cross-device sign-in, so clearing browser data or changing devices can make the anonymous identity inaccessible.

## Privacy
Date of birth, surname, and gender are stored in the private `profiles` table. The public feed exposes only first name, username, CardID, and post content.

## Posting limit
The 24-hour posting restriction is enforced in PostgreSQL, not just in the browser.


## DreamID Card and privacy
- DreamID cards show profile fields selected by each member; CardID is intentionally excluded from the card face.
- Privacy preferences are stored on the private owner profile and mirrored into a non-exposed `private` schema for public reads.
- Public profile fields are returned with disabled fields set to `NULL`; the raw private profile mirror is not granted to `anon` or `authenticated`.
- Apply `supabase/migrations/20261126220000_dreamid_card_visibility.sql` to add the privacy fields and filtered public feed.
- Default visibility: first name, username, profile photo, bio and join date visible; surname, birth date, gender, country and city hidden.
