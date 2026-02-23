let gisLoaded = false;
let tokenClient: any = null;

const CLIENT_ID = import.meta.env.VITE_AUTH_APP_CLIENT_ID || import.meta.env.VITE_FIREBASE_API_KEY;
// Use only the per-file Drive scope to avoid branding/verification requirements.
// `drive.file` allows read/write access to files the app created or that the
// user explicitly opened with the Picker. It cannot list or access arbitrary
// Drive files owned by the user without additional scopes that may require
// OAuth verification.
const SCOPES = "https://www.googleapis.com/auth/drive.file openid profile email";

export async function ensureGisLoaded(): Promise<void> {
  if (gisLoaded) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-gis]');
    if (existing) {
      gisLoaded = true;
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.setAttribute("data-gis", "1");
    s.async = true;
    s.onload = () => {
      gisLoaded = true;
      resolve();
    };
    s.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(s);
  });
}

async function initTokenClient() {
  if (tokenClient) return tokenClient;
  // `google` will be available after loading gis client
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
    throw new Error("Google Identity Services not initialized");
  }
  // Note: we create token clients per-request to allow varying scopes.
  tokenClient = null;
  return tokenClient;
}

/**
 * Request an access token for Drive. If `interactive` is true, the user will be shown a consent prompt when needed.
 */
export async function requestAccessTokenForScopes(scopes: string, interactive = true): Promise<string | null> {
  await ensureGisLoaded();

  if (!CLIENT_ID) {
    throw new Error("Google Client ID is not configured. Set VITE_AUTH_APP_CLIENT_ID in your .env files.");
  }

  return await new Promise<string | null>((resolve, reject) => {
    let isResolved = false;
    let hasToken = false;

    const clearPromise = () => {
      isResolved = true;
    };

    const handleTimeout = () => {
      if (!isResolved) {
        isResolved = true;
        reject(new Error("Google OAuth timeout. Popup may have been blocked or closed."));
      }
    };

    const timeoutId = setTimeout(handleTimeout, 60000); // 60 second timeout

    try {
      // Create a token client with integrated callbacks
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: scopes,
        callback: (response: any) => {
          clearTimeout(timeoutId);
          if (isResolved) return;

          if (response.access_token) {
            hasToken = true;
            clearPromise();
            console.log("OAuth: Successfully obtained access token");
            resolve(response.access_token);
          } else if (response.error) {
            clearPromise();
            const errorMsg = response.error_description || response.error || "Unknown error";
            console.error("OAuth: Token request error:", errorMsg);
            reject(new Error(`OAuth Error: ${errorMsg}`));
          }
        },
        error_callback: (error: any) => {
          clearTimeout(timeoutId);
          // Only reject if we haven't already gotten a token
          // Popup closing after successful auth is normal and shouldn't error
          if (!isResolved && !hasToken) {
            clearPromise();
            console.error("OAuth: Error callback triggered:", error);
            const errorMsg = error?.message || JSON.stringify(error);
            if (errorMsg.includes("popup_closed") || errorMsg.includes("cancelled")) {
              reject(new Error("Login cancelled. Please try again."));
            } else {
              reject(new Error(`OAuth Error: ${errorMsg}`));
            }
          } else {
            console.warn("OAuth: Ignoring error callback after successful token", error);
          }
        },
      });

      // Request the token
      client.requestAccessToken({
        prompt: interactive ? "consent" : "",
      });
    } catch (err) {
      clearTimeout(timeoutId);
      if (!isResolved) {
        isResolved = true;
        console.error("OAuth: Exception during token request:", err);
        reject(err);
      }
    }
  });
}

export async function requestDriveAccessToken(interactive = true): Promise<string | null> {
  return requestAccessTokenForScopes(SCOPES, interactive);
}

let gapiLoaded = false;
/** Load Google API JS (gapi) and Picker library */
export async function ensureGapiPickerLoaded(): Promise<void> {
  if (gapiLoaded) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-gapi]');
    if (existing) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (window.gapi && (window as any).google && (window as any).google.picker) {
        gapiLoaded = true;
        resolve();
        return;
      }
    }
    const s = document.createElement('script');
    s.src = 'https://apis.google.com/js/api.js';
    s.setAttribute('data-gapi', '1');
    s.async = true;
    s.onload = () => {
      // Load the picker library
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      window.gapi.load('picker', () => {
        gapiLoaded = true;
        resolve();
      });
    };
    s.onerror = () => reject(new Error('Failed to load Google API (gapi)'));
    document.head.appendChild(s);
  });
}

/**
 * Parse JWT without verification (only safe for client-side user info from Google)
 */
function parseJwt(token: string): Record<string, any> | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.error("Failed to parse JWT", err);
    return null;
  }
}

export interface GoogleUserProfile {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

/**
 * Get user profile from Google OAuth token
 * @param token - Optional token to parse. If not provided, will request a new one
 * @param interactive - If true and token is not provided, will show OAuth consent screen
 */
export async function getGoogleUserProfile(token?: string, interactive = true): Promise<GoogleUserProfile | null> {
  try {
    let accessToken = token;

    // Only request a new token if one wasn't provided
    if (!accessToken) {
      accessToken = await requestAccessTokenForScopes(SCOPES, interactive);
      if (!accessToken) {
        console.warn("No token available for profile fetch");
        return null;
      }
    }

    // Use the Google UserInfo endpoint to retrieve profile data from the access token.
    // Access tokens are not guaranteed to be JWTs, so don't attempt to parse them directly.
    try {
      const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (response.ok) {
        const userInfo = await response.json();
        return {
          id: userInfo.id || userInfo.sub || "",
          name: userInfo.name || null,
          email: userInfo.email || null,
          image: userInfo.picture || null,
        };
      } else {
        console.warn("UserInfo response not ok:", response.status, response.statusText);
      }
    } catch (err) {
      console.warn("Failed to fetch from UserInfo API:", err);
    }

    // Fallback: if the token looks like a JWT, try to parse it
    const maybePayload = parseJwt(accessToken);
    if (maybePayload) {
      return {
        id: maybePayload.sub || maybePayload.user_id || "",
        name: maybePayload.name || null,
        email: maybePayload.email || null,
        image: maybePayload.picture || null,
      };
    }

    return null;
  } catch (err) {
    console.error("Failed to get user profile", err);
    return null;
  }
}

export function clearTokens() {
  // nothing persisted long-term; tokens are short lived
}

export default {
  ensureGisLoaded,
  requestDriveAccessToken,
  clearTokens,
};
