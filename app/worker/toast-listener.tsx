"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { useToast } from "@/components/ui/ToastContainer";

// Listens for assignment notifications on a per-tenant broadcast channel
export function ToastClientListener({ tenantId, workerId }: { tenantId: string; workerId: string }) {
  const { addToast } = useToast();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`assignments-${tenantId}`)
      .on(
        "broadcast",
        { event: "job-assigned" },
        (payload) => {
          if (!payload?.workerIds || !Array.isArray(payload.workerIds)) return;
          if (!payload.workerIds.includes(workerId)) return;
          addToast(`New job assigned: ${payload.title ?? "Job"}`, "info");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, workerId, addToast]);

  return null;
}
