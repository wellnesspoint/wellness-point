
## Razorpay webhook (required for reliable order completion)

If a customer pays and then closes the tab before the browser calls
`/api/payment/verify`, the order would stay "pending". The webhook completes it
server-to-server.

1. Razorpay Dashboard → Settings → Webhooks → Add new webhook
2. URL: `https://<your-domain>/api/payment/webhook`
3. Secret: any strong random string — set the same value as `RAZORPAY_WEBHOOK_SECRET`
4. Events: `payment.captured`, `order.paid`

## Scripts

- `npm run typecheck` — TypeScript
- `npm run lint` — ESLint
- `npm test` — Vitest unit tests (CI runs all three on every push/PR)
