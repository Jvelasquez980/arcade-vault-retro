"use client";

export default function Error({ retry }: { error: Error; retry: () => void }) {
  return (
    <div style={{ textAlign: "center", padding: "80px 16px" }}>
      <div
        className="pixel"
        style={{ fontSize: 14, color: "var(--magenta)", marginBottom: 12 }}
      >
        ALGO SALIÓ MAL
      </div>
      <div style={{ color: "var(--ink-faint)", marginBottom: 24 }}>
        No pudimos cargar los datos. Inténtalo de nuevo.
      </div>
      <button className="btn" onClick={() => retry()}>
        REINTENTAR
      </button>
    </div>
  );
}
