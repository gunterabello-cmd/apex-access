# Apex Access
Vercel serves the animated storefront from public/ and Node functions from api/. Import this repository using the Other framework preset, project root '.', and the included vercel.json. No build or dependency install is needed.

## Accounts and orders
Use a dedicated Supabase project. Run db/schema.sql once in its SQL editor. Enable email/password and email confirmation. Set the Site URL in Authentication > URL Configuration to the production HTTPS origin. Configure a sending domain or SMTP suitable for customer confirmation emails. Customers verify their email, sign in and view their invoices under My orders.

## Crypto checkout
In the store owner's NOWPayments merchant account, configure the payout wallet and supported coins/networks. Generate an API key and an IPN secret. Set the variables listed in .env.example under Vercel Project Settings > Environment Variables. APP_ORIGIN must be the final HTTPS store origin. The webhook is /api/payment. Only SUPABASE_URL and SUPABASE_ANON_KEY are public. Use the legacy service_role key for the server. Never commit real credentials.

Review the 31 sample GBP prices in lib/catalogue.js (integer pence), product descriptions, plan durations and available stock. LIVE_SALES_ENABLED=true enables charges at these prices. Redeploy after environment changes. Orders are one-time payments for the described term. The merchant fulfils paid orders manually by setting delivery_note on that customer's order in Supabase. Display of delivery details requires sign-in and a paid status. Restocks and automatic supplier fulfilment are not integrated.

## Verification and recovery
Before launch, verify an email account, sign in, confirm the GBP subtotal, and exercise the hosted invoice and signed notification with a provider test environment. Production functions target api.nowpayments.io. For sandbox verification deploy a separate preview using the provider's sandbox endpoint and sandbox credentials. Do not test by sending funds to an unverified wallet.
If invoice creation is interrupted, check the logged order ID against the merchant dashboard before retrying. Reconcile a missing invoice ID/URL from that dashboard if necessary, then resend the provider notification. Returning from checkout does not confirm payment.
