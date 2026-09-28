# StockPilot — Elegant Edition (Direct Start + Secure Login)

StockPilot now **opens directly to the elegant dashboard** instead of showing a full-screen login page.

Authentication is still enabled in Supabase and the existing Row Level Security rules remain in place.

## How it works
- If a valid Supabase session already exists, StockPilot loads the user's private cloud inventory automatically.
- If no session exists, the dashboard opens normally, but cloud inventory actions require sign-in.
- Click **Sign in to sync** in the sidebar or open **Settings** to sign in.
- Email/password, Google login, account creation, and password reset remain available in a small sign-in modal.
- Signing out returns the app to the dashboard rather than a login page.
- No public/anonymous database policies are required.
- No changes to your existing Supabase RLS or storage security are required.

## Important
This edition does **not** make your inventory public. Keep the existing authenticated RLS policies and private `product-images` bucket.

## Publish
Replace the contents of your existing `~/stockpilot` project while preserving `.git`, then commit and push to GitHub Pages.

The browser-side Supabase publishable key is included intentionally. Never put a Supabase service-role/secret key or database password in frontend code.
