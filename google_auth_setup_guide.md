# How to Setup Google Login (Free)

This setup is **free** for testing and production up to 50,000 monthly active users on Supabase. Google Cloud is also free for OAuth usage.

You need two things: **Client ID** and **Client Secret**. Here is how to get them:

## Step 1: Get Google Credentials
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a **New Project** (name it "Tender Engine" or similar).
3. In the search bar at the top, type **"OAuth consent screen"** and select it.
   - Choose **External** for User Type.
   - Fill in the App Name, Support Email, and Developer Email.
   - Click "Save and Continue" through the scopes screens (defaults are fine).
4. Go to **Credentials** (left menu).
5. Click **+ CREATE CREDENTIALS** -> **OAuth client ID**.
6. Select **Web application**.
7. **Important**: Under **Authorized JavaScript origins**, add: `http://localhost:5173`
   - This allows your local app to talk to Google.
8. Under **Authorized redirect URIs**, add this URL (from your Supabase dashboard):
   - You need to find your Supabase Project URL first.
   - Usually looks like: `https://<project-id>.supabase.co/auth/v1/callback`
   - *Go to to Step 2 to find this URL, then come back here.*
8. Click **Create**.
9. Copy your **Client ID** and **Client Secret**.

## Step 2: Configure Supabase
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your project.
3. Go to **Authentication** (left sidebar icon that looks like users) -> **Providers**.
4. Select **Google**.
5. Turn **Enable Sign in with Google** to ON.
6. Paste the **Client ID** and **Client Secret** from Google.
7. Copy the **Callback URL (for OAuth)** shown here.
   - *Paste this back into your Google Cloud Console "Authorized redirect URIs" (Step 1.7).*
8. Click **Save**.

## Step 3: Test It
1. Restart your local app if needed.
2. Click "Sign in with Google".
3. It should redirect you to Google, then back to your Dashboard!
