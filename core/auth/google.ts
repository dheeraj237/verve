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

  // create a fresh token client for the requested scopes
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const client = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: scopes,
    callback: (resp: any) => {},
    error_callback: (err: any) => {
      console.error("Google OAuth error callback:", err);
    },
  });

  return await new Promise((resolve, reject) => {
    let isResolved = false;
    const timeoutId = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        reject(new Error("Google OAuth timeout. Popup may have been blocked or closed."));
      }
    }, 60000); // 60 second timeout

    try {
      client.callback = (resp: any) => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timeoutId);
        if (resp && resp.access_token) {
          console.log("Successfully got access token");
          resolve(resp.access_token);
        } else if (resp && resp.error) {
          console.error("OAuth error response:", resp.error, resp.error_description);
          if (resp.error === "popup_closed") {
            reject(new Error("Popup window closed. Please try again."));
          } else {
            reject(new Error(`OAuth Error: ${resp.error} - ${resp.error_description || "Unknown error"}`));
          }
        } else {
          console.warn("No token in response");
          resolve(null);
        }
      };

      client.requestAccessToken({ prompt: interactive ? "consent" : "" });
    } catch (err) {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeoutId);
        console.error("Error requesting access token:", err);
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
 */
export async function getGoogleUserProfile(interactive = true): Promise<GoogleUserProfile | null> {
  try {
    const token = await requestAccessTokenForScopes(SCOPES, interactive);
    if (!token) {
      console.warn("No token available for profile fetch");
      return null;
    }

    const payload = parseJwt(token);
    if (!payload) {
      console.warn("Failed to parse JWT payload");
      return null;
    }

    return {
      id: payload.sub || payload.user_id || "",
      name: payload.name || null,
      email: payload.email || null,
      image: payload.picture || null,
    };
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
