# Verify System

## Goal
Verify that the deployed Supabase system is functioning correctly by interacting with the database and functions.

## Inputs
- Deployed Supabase project (URL/Key in `.env`).

## Tools
- Python script: `execution/verify_system.py`.

## Steps
1.  **Run Verification Script**: Execute `python execution/verify_system.py`.
    - This script should:
        - Connection Check: Query the `tenders` table.
        - Function Check: Invoke `audit-logger` with a test payload.
        - Validation: Check if the log was inserted into `audit_logs`.

## Expected Output
- "System Verification Passed" message.
- Details of the test run.

## Failure Modes
- **Connection Error**: Check `.env` and internet.
- **Function Error**: Check function logs via `supabase functions logs`.
- **Data mismatch**: Check schema definitions.
