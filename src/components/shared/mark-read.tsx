"use client";

import { useEffect, useRef } from "react";
import { markAllRead } from "@/lib/notifications/actions";

export function MarkRead({ circleId }: { circleId: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    markAllRead(circleId);
  }, [circleId]);
  return null;
}
