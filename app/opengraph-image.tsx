import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          background: "#020617",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 96, fontWeight: 600, letterSpacing: -2 }}>Sendvia</div>
        <div style={{ fontSize: 32, color: "#94a3b8" }}>
          Secure peer-to-peer file sharing between devices
        </div>
      </div>
    ),
    { ...size }
  );
}
