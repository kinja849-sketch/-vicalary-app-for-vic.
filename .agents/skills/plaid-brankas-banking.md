# Plaid & Brankas Banking Skill

## Architecture
- **Plaid Integration**: Used for international bank account linking, token exchange (`/api/banking/plaid/*`), and balance/transaction syncing.
- **Brankas Integration**: Used for Indonesian bank linking and transaction retrieval (`/api/banking/brankas/*`).

## Security & Data Integrity
- Access tokens (`access_token`, `item_id`, secret keys) MUST NEVER be sent to the browser or stored unencrypted.
- Bank authentication and token exchange must happen securely inside Next.js server API routes.
- Sync bank transactions into `budget_transactions` table linked strictly to an active `user_budgets` record and `user_id`.
- Never expose service secrets in responses or logs.
