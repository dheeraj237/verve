# Google OAuth Setup Guide for Verve

This guide explains how to configure Google OAuth authentication for Verve.

## Prerequisites

- A Google Cloud Project
- The Google Drive API enabled
- OAuth 2.0 Client ID credentials

## Step-by-Step Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top
3. Click "NEW PROJECT"
4. Name your project (e.g., "Verve")
5. Click "CREATE"

### 2. Enable Google Drive API

1. In the Cloud Console, go to **APIs & Services > Enabled APIs & services**
2. Click **+ ENABLE APIS AND SERVICES**
3. Search for "Google Drive API"
4. Click on it and press **ENABLE**

### 3. Create OAuth 2.0 Client ID Credentials

1. Go to **APIs & Services > Credentials**
2. Click **+ CREATE CREDENTIALS > OAuth client ID**
3. Choose **Web application** as the application type
4. Under "Authorized JavaScript origins", add:
   - `http://localhost:3000` (for local development)
   - `http://localhost:5173` (for Vite dev server)
   - Your production domain (e.g., `https://verve.example.com`)
5. Click **CREATE**
6. Copy your **Client ID** (looks like: `xxx.apps.googleusercontent.com`)

### 4. Configure Environment Variables

Create a `.env` file in the project root:

```env
VITE_AUTH_APP_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Replace `your-client-id` with the actual Client ID from step 3.

### 5. Test the Setup

1. Start the development server:
   ```bash
   yarn dev
   ```

2. Visit http://localhost:3000

3. Click the **Login** button in the toolbar

4. You should see the Google OAuth consent screen

5. After approving, you should see a success message with your name

## Troubleshooting

### "Popup window closed" Error

This error occurs when the OAuth popup is closed before the flow completes.

**Solutions:**
- Ensure popups are not blocked in your browser settings
- Check that your JavaScript origins are correctly configured in Google Cloud Console
- Verify the Client ID is correct in `.env`

### "Invalid Client ID" Error

The Client ID is missing or incorrect.

**Solutions:**
- Verify `.env` file exists in the project root
- Check that `VITE_AUTH_APP_CLIENT_ID` is set correctly
- Ensure there are no extra spaces or quotes in the value

### "Cross-Origin-Opener-Policy" Warnings

These warnings in the browser console can occur due to security policies but shouldn't prevent login from working.

**Solutions:**
- If login still fails, check your authorized JavaScript origins in Google Cloud Console
- Clear browser cache and cookies
- Try in an incognito/private window

### OAuth Popup Blocked by Browser

Some browsers block popups by default.

**Solutions:**
- Allow popups for localhost in your browser settings
- Try a different browser
- Use incognito/private mode (often has relaxed popup restrictions)

## Required Scopes

The app requests the following OAuth scopes:

- `openid` - OpenID Connect
- `profile` - User's profile information
- `email` - User's email address
- `https://www.googleapis.com/auth/drive.file` - Access to Drive files (optional)

These scopes allow the app to:
- Authenticate the user
- Display their name and email
- Access files they've opened with the app or created in the app

## Production Deployment

For production deployment:

1. Add your production domain to **Authorized JavaScript origins** in Google Cloud Console
2. Set `VITE_AUTH_APP_CLIENT_ID` in your production environment
3. Ensure HTTPS is enabled on your domain

## Security Notes

- Never commit your `.env` file to version control
- The Client ID is public - it's safe to include in frontend code
- Short-lived access tokens are used and not persisted long-term
- Google handles all sensitive OAuth operations

## Reference

- [Google Identity Services Documentation](https://developers.google.com/identity)
- [Google Cloud Console](https://console.cloud.google.com/)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground)
