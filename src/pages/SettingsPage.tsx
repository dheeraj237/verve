import React, { useState, useEffect } from "react";
import { useUserStore } from "@/core/store/user-store";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { revokeAccessToken } from "@/core/auth/google";

export function SettingsPage() {
  const { profile, isLoggedIn, logout } = useUserStore();
  const navigate = useNavigate();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/");
    }
  }, [isLoggedIn, navigate]);

  const handleRevoke = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const ok = await revokeAccessToken();
      if (ok) {
        setStatus("Access revoked successfully. You have been logged out.");
        logout();
        // short delay for UX, then navigate home
        setTimeout(() => navigate("/"), 900);
      } else {
        setStatus("Failed to revoke access. Try again.");
      }
    } catch (err) {
      console.error(err);
      setStatus("An error occurred while revoking access.");
    } finally {
      setBusy(false);
    }
  };

  if (!isLoggedIn) return null;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Settings</h1>

      <section className="mb-6">
        <h2 className="text-lg font-medium">Profile</h2>
        <div className="mt-2 text-sm text-muted-foreground">
          <div><strong>Name:</strong> {profile?.name || "—"}</div>
          <div><strong>Email:</strong> {profile?.email || "—"}</div>
          <div className="mt-2">
            <img src={profile?.image || ""} alt={profile?.name || "User"} className="h-12 w-12 rounded-full object-cover" />
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-medium">Connected Accounts</h2>
        <div className="mt-3">
          <div className="mb-2 text-sm">Google Drive</div>
          <div className="flex items-center gap-3">
            <Button variant="destructive" onClick={handleRevoke} disabled={busy}>
              {busy ? "Revoking..." : "Revoke Google Drive Access"}
            </Button>
            <Button variant="ghost" onClick={() => navigate("/")}>Close</Button>
          </div>
          {status && <div className="mt-3 text-sm">{status}</div>}
        </div>
      </section>
    </div>
  );
}

export default SettingsPage;
