# StockPilot — Direct Start + Secure Login + Mobile Photo Upload Fix

Opens directly to the dashboard while retaining Supabase authentication and private inventory storage.

Mobile photo improvements:
- Camera / photo-library button
- Client-side compression for normal camera images
- Better handling of large phone photos
- Clear upload progress/error messages
- HEIC/HEIF files are kept when the browser cannot decode them
- Service-worker cache version bumped so the fix reaches phones


- Increase/decrease stock directly from the Inventory table.
- Use + / − controls in the Add Product form.


Edit form fix: existing product names are preserved and loaded from the inventory record, with compatibility fallbacks for older name fields.
