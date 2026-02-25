"use client";
import React, { useEffect, useState } from 'react';
import { getSyncManager, SyncStatus } from '@/core/sync/sync-manager';

export function SyncIndicator() {
  const [status, setStatus] = useState<SyncStatus>(SyncStatus.IDLE);

  useEffect(() => {
    const sub = getSyncManager().status$().subscribe((s) => setStatus(s));
    return () => sub.unsubscribe();
  }, []);

  if (status === SyncStatus.IDLE || status === SyncStatus.ONLINE) return null;

  return (
    <div className="fixed right-4 bottom-4 z-[9999] flex items-center space-x-2">
      <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
      <div className="text-sm text-muted-foreground">Syncing...</div>
    </div>
  );
}

export default SyncIndicator;
