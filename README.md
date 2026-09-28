# StockPilot — Direct Start + Secure Login + Mobile Photo Upload Fix

Opens directly to the dashboard while retaining Supabase authentication and private inventory storage.

Mobile photo improvements:
- Camera / photo-library button
- Client-side compression for normal camera images
- Better handling of large phone photos
- Clear upload progress/error messages
- HEIC/HEIF files are kept when the browser cannot decode them
- Service-worker cache version bumped so the fix reaches phones


## Barcode & stock controls
- Scan a product barcode from the phone camera.
- Use SKU as the barcode value; no database migration is required.
- Create and save Code 128 barcodes from the SKU.
- Increase/decrease stock directly from the Inventory table.
- Use + / − controls in the Add Product form.
