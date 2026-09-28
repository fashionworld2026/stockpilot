# StockPilot Elegant Edition

A refined, responsive PWA for cloud-synchronized inventory management.

## Includes
- Elegant responsive SaaS interface
- Supabase authentication
- Cloud inventory database
- Product image uploads
- Dashboard, inventory and insights
- CSV import/export
- PWA installation
- Mobile navigation
- Automatic signed image URLs
- GitHub Pages ready

## Existing Supabase project
This edition is configured for the StockPilot Supabase project used by the existing application.

## Publish
Replace the contents of your existing `~/stockpilot` project while preserving `.git`, then commit and push to GitHub Pages.

## Note
The browser-side Supabase publishable key is intentionally included. Keep Row Level Security enabled and never put a Supabase service-role/secret key in frontend code.


## Google login

The Elegant Edition includes a **Continue with Google** button using Supabase Auth.

Before using it:
1. In Supabase, open **Authentication → Providers → Google** and enable Google.
2. Add your Google OAuth Client ID and Client Secret.
3. In Supabase **Authentication → URL Configuration**, add your production redirect URL:
   `https://fashionworld2026.github.io/stockpilot/`
4. For local testing, also add:
   `http://localhost:8000/`

The frontend only contains the Supabase publishable key. Never place a Google client secret or Supabase service-role key in the frontend.


## Password reset

The login screen now includes **Forgot password?**. Users enter their account email and receive a Supabase password-reset email. The reset link returns to the StockPilot app, where they can choose a new password.

For Supabase, make sure the production URL is allowed under **Authentication → URL Configuration**:

`https://fashionworld2026.github.io/stockpilot/`

The same URL is used by the app as the password-reset redirect target.
