"use client";

import { useState, useEffect } from "react";

export function MemberCount({ realmId, initial }: { realmId: string; initial: number }) {
  const [count, setCount] = useState(initial);

  useEffect(() => {
    function fetchCount() {
      fetch(`/api/v1/realms/${realmId}/members`)
        .then((res) => res.json())
        .then((data) => {
          if (data.totalMembers !== undefined) setCount(data.totalMembers);
        })
        .catch(() => {});
    }
    const interval = setInterval(fetchCount, 4000);
    return () => clearInterval(interval);
  }, [realmId]);

  return <>{count}</>;
}
