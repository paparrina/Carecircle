"use client";

import { useEffect, useRef } from "react";
import { markNotificationsRead } from "@/lib/notifications/actions";

/** `ids` debe ser exactamente el conjunto de avisos que la página ha renderizado. */
export function MarkRead({ circleId, ids }: { circleId: string; ids: string[] }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    markNotificationsRead(circleId, ids);
  }, [circleId, ids]);
  return null;
}
