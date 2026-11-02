import { useEffect, useRef } from "react";

const BACKEND_URL = "http://localhost:8000";

function EspEventListener({ onMuseumAudio }: { onMuseumAudio: (eventType: string, payload: any) => void }) {
  const lastEventRef = useRef<string>("");

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/get-latest-esp-event`);
        const data = await res.json();

        // Only react if event_type is new and valid
        if (
          data.event_type &&
          data.event_type !== lastEventRef.current &&
          ["proximity", "gone", "lift_state"].includes(data.event_type)
        ) {
          lastEventRef.current = data.event_type;
          onMuseumAudio(data.event_type, data.payload);
        }
      } catch (err) { /* ignore errors */ }
    }, 2000);

    return () => clearInterval(poll);
  }, [onMuseumAudio]);

  return null;
}

export default EspEventListener;