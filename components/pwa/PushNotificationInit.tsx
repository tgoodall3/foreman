"use client";

import { useEffect } from "react";
import { initPushNotifications } from "@/lib/notifications";

export default function PushNotificationInit() {
  useEffect(() => {
    initPushNotifications();
  }, []);

  return null;
}
