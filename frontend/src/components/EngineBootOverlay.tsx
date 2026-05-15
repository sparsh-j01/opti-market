"use client";

import { useEffect, useState } from "react";
import {
  BootStatus,
  initEngine,
  retryEngine,
  subscribeBootStatus,
} from "@/lib/api";

/**
 * Full-screen overlay shown while the in-browser Python engine boots.
 *
 * First load fetches ~10-25 MB of Pyodide + numpy/scipy/pandas (cached
 * after). This shows real progress instead of an opaque spinner, and — per
 * the failure-path plan — on boot failure shows a clear "needs a modern
 * browser, retry" message rather than an infinite spinner. There is no
 * server fallback by design (true $0).
 */
export default function EngineBootOverlay() {
  const [status, setStatus] = useState<BootStatus | null>(null);

  useEffect(() => {
    const unsub = subscribeBootStatus(setStatus);
    initEngine();
    return unsub;
  }, []);

  if (!status || status.phase === "ready") return null;

  const isError = status.phase === "error";
  const pct = Math.round(status.progress * 100);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-6"
      style={{ background: "var(--bg-primary)" }}
      role="status"
      aria-live="polite"
    >
      <div className="text-center max-w-md w-full">
        {isError ? (
          <>
            <div className="text-4xl mb-4" aria-hidden>
              ⚠️
            </div>
            <h2
              className="text-lg font-semibold mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              Couldn&apos;t start the in-browser engine
            </h2>
            <p
              className="text-sm mb-1"
              style={{ color: "var(--text-muted)" }}
            >
              OptiMarket runs entirely in your browser and needs a modern
              browser with WebAssembly. No data leaves your device.
            </p>
            {status.error && (
              <p
                className="text-xs mb-5 font-mono break-words"
                style={{ color: "var(--text-muted)", opacity: 0.7 }}
              >
                {status.error}
              </p>
            )}
            <button
              onClick={() => retryEngine()}
              className="px-5 py-2.5 rounded-lg text-white font-semibold text-sm"
              style={{ background: "var(--gradient-main)" }}
            >
              Retry
            </button>
          </>
        ) : (
          <>
            <div
              className="w-12 h-12 rounded-full mx-auto mb-5 animate-spin"
              style={{
                border: "3px solid var(--border-color)",
                borderTopColor: "var(--accent-primary)",
              }}
            />
            <p
              className="text-sm mb-4"
              style={{ color: "var(--text-primary)" }}
            >
              {status.detail}
            </p>
            <div
              className="w-full h-1.5 rounded-full overflow-hidden"
              style={{ background: "var(--border-color)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: "var(--gradient-main)",
                }}
              />
            </div>
            <p
              className="text-xs mt-3"
              style={{ color: "var(--text-muted)" }}
            >
              First visit downloads the engine once (~15 MB), then it&apos;s
              cached. Everything runs on your device — no server.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
