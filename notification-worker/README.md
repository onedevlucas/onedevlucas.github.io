# BORail notification service

This Cloudflare Worker stores device-specific Web Push subscriptions in D1 and evaluates the same deterministic New York-time status engine used by the BORail Status page every minute.

It sends these service transition alerts:

- favorite line: unexpected no service, minor delays, major delays, and normal service resumed;
- favorite station: elevator outage reported and elevator fixed;
- system: Winter Emergency Service begins.

Line-wide delays require exactly three delayed active trains for minor, or four or more for major, per local or express service.

On a device with notifications enabled, a rider can save up to five planner itineraries. The Worker sends a reminder about 20 minutes before boarding and can alert about known delays, at-risk transfers, or a timetable change that requires replanning. Future searches use the usual service patterns; Winter Emergency service first affects saved trips on the actual day in Eastern Time. Saved trips are removed when canceled, completed, expired, or their subscription is deleted.

Scheduled overnight closure, ordinary gaps with no active train, unobserved future delays, advertisements, and game messages do not create push alerts.

To upgrade an existing database, run `wrangler d1 migrations apply borail-notifications --remote` before deploying the Worker.

## One-time owner setup

1. Run `npm install` in this directory.
2. Authenticate Wrangler with the Cloudflare account that will own the service.
3. Create the D1 database: `npx wrangler d1 create borail-notifications`.
4. Put its returned ID in `wrangler.jsonc`, apply `schema.sql` remotely, and then apply the D1 migrations.
5. Generate a VAPID P-256 key pair. Put the private key in the Worker secret `VAPID_SERVER_PRIVATE_KEY`; configure `VAPID_SERVER_PUBLIC_KEY` and `VAPID_SUBJECT` as Worker secrets/variables. Never commit the private key.
6. Set an `ADMIN_TOKEN` Worker secret for protected service-status overrides.
7. Deploy, then place the resulting Worker URL in `assets/js/notification-config.js`.

The API accepts browser requests only from `https://rideborailmc.net` and local development origins. Each device receives its own random management token. There is no public arbitrary-message endpoint.
