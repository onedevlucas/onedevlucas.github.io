# BORail notification service

This Cloudflare Worker stores device-specific Web Push subscriptions in D1 and evaluates the same deterministic New York-time status engine used by the BORail Status page every minute.

It sends only these transition alerts:

- favorite line: unexpected no service, minor delays, major delays, and normal service resumed;
- favorite station: elevator outage reported and elevator fixed;
- system: Winter Emergency Service begins.

Scheduled overnight closure, ordinary gaps with no active train, future delays, arrivals, advertisements, and game messages never create push alerts.

## One-time owner setup

1. Run `npm install` in this directory.
2. Authenticate Wrangler with the Cloudflare account that will own the service.
3. Create the D1 database: `npx wrangler d1 create borail-notifications`.
4. Put its returned ID in `wrangler.jsonc`, then apply `schema.sql` remotely.
5. Generate a VAPID P-256 key pair. Put the private key in the Worker secret `VAPID_SERVER_PRIVATE_KEY`; configure `VAPID_SERVER_PUBLIC_KEY` and `VAPID_SUBJECT` as Worker secrets/variables. Never commit the private key.
6. Set an `ADMIN_TOKEN` Worker secret for protected service-status overrides.
7. Deploy, then place the resulting Worker URL in `assets/js/notification-config.js`.

The API accepts browser requests only from `https://rideborailmc.net` and local development origins. Each device receives its own random management token. There is no public arbitrary-message endpoint.
