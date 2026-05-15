# SolveAd Web

SolveAd is a game-inspired thesis web application built with Next.js, Tailwind CSS, and Supabase.

## Features Implemented

- Gmail login (Google OAuth) and manual registration/login (LRN + password)
- Registration fields: first name, last name, LRN, password
- First-time onboarding flow:
	- Profile icon selection
	- Confirmation prompt
	- Redirect to homepage after confirmation
- Homepage with map-style level selection using image-based level buttons
- Hover/click interaction effect for level buttons
- Top-right controls:
	- Sound toggle
	- Settings panel (language, accessibility, about)
	- Help/Info panel (how to use, game mechanics, login guide)

## Tech Stack

- Next.js (App Router, TypeScript)
- Tailwind CSS
- Supabase Auth + Postgres

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env.local
```

3. Fill `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=https://solvead.vercel.app
```

4. In Supabase SQL editor, run schema:

- `supabase/schema.sql`

5. Enable Google provider in Supabase:

- Authentication -> Providers -> Google
- Add your OAuth Client ID and Secret
- Add redirect URL: `https://solvead.vercel.app`

6. Start development server:

```bash
npm run dev
```

Open `https://solvead.vercel.app`.

## Android Install

When the site is deployed over HTTPS, Android users can install it directly from Chrome:

1. Open the site in Chrome on Android.
2. Wait for Chrome to show the install prompt, or open the browser menu and choose Install app / Add to Home screen.
3. Launch SolveAd from the home screen icon to use it like an app.

If the install option does not appear, the site usually needs a valid manifest, a service worker, and an HTTPS deployment.

## Notes

- Manual login uses an internal synthetic email format: `LRN@solvead.local`.
- Passwords are handled by Supabase Auth and are not stored directly in custom tables.
- Optional background music file can be added at: `public/assets/audio/bg-music.mp3`.
