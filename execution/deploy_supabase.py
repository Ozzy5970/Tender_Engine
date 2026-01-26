import subprocess
import os
import sys

def run_command(command, cwd=None):
    """Run a shell command and print output."""
    print(f"Running: {command}")
    try:
        result = subprocess.run(
            command,
            cwd=cwd,
            shell=True,
            check=True,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        print(result.stdout)
        if result.stderr:
            print(f"Stderr: {result.stderr}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {command}")
        print(f"Stdout: {e.stdout}")
        print(f"Stderr: {e.stderr}")
        return False

def main():
    # 1. Push Database Migrations
    print("--- 1. Pushing Database Migrations ---")
    # Using --linked implies we are pushing to the remote linked project
    # If not linked, this might fail or ask for link. 
    # Since config.toml has project_id, it should work.
    if not run_command("supabase db push"):
        print("Failed to push database migrations.")
        sys.exit(1)

    # 2. Set Secrets
    print("\n--- 2. Setting Secrets ---")
    if os.path.exists(".env"):
        if not run_command("supabase secrets set --env-file .env"):
             print("Warning: Failed to set secrets. Continuing...")
    else:
        print(".env file not found. Skipping secrets.")

    # 3. Deploy Functions
    print("\n--- 3. Deploying Edge Functions ---")
    # Deploy all functions
    if not run_command("supabase functions deploy --no-verify-jwt"):
        print("Failed to deploy functions.")
        sys.exit(1)
        
    print("\nSUCCESS: Setup and Deployment Complete.")

if __name__ == "__main__":
    main()
