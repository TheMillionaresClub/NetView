"use client";

import { useState } from "react";

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <button
      className="counter"
      type="button"
      onClick={() => setCount((c) => c + 1)}
    >
      Count is {count}
    </button>
  );
}
