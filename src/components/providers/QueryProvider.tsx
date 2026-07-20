"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useOfflineSync } from "@/lib/offline/useOfflineSync";

// Lives inside the provider so it can use the query client. Renders nothing —
// it just drains the offline outbox whenever connectivity might be back.
function OfflineSyncRunner() {
  useOfflineSync();
  return null;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <OfflineSyncRunner />
      {children}
    </QueryClientProvider>
  );
}
