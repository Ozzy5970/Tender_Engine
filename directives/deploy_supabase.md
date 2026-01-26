# Deploy to Supabase

## Goal
Deploy the local Supabase configuration (migrations and functions) to the linked Supabase project.

## Inputs
- `supabase/migrations/*`: SQL migration files.
- `supabase/functions/*`: Edge Functions.
- `.env`: Contains `SUPABASE_URL` (to extract project ref) and other secrets.

## Tools
- `supabase` CLI (must be installed and authenticated).
- Python script: `execution/deploy_supabase.py`

## Steps
1.  **Link Project**: Ensure the local project is linked to the remote Supabase project using the ID from `SUPABASE_URL`.
2.  **Push Database**: Run `supabase db push` to apply migrations.
3.  **Deploy Functions**: Run `supabase functions deploy` to deploy all functions.
4.  **Set Secrets**: (Optional) If functions rely on `.env` vars, use `supabase secrets set`.

## Edge Cases
- **Not Logged In**: Script should fail gracefully if `supabase` CLI is not authenticated.
- **Link Failure**: If linking fails (e.g., wrong password), prompt user.
- **Migration Conflicts**: If the DB is out of sync, `db push` might fail.

## Outputs
- Deployment logs in stdout.
- Updated remote database schema.
- Deployed edge functions.
