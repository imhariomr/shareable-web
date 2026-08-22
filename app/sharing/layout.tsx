import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sharing Session",
  description: "Connect two devices and share files directly, peer-to-peer.",
  robots: { index: false, follow: true },
}

export default function SharingLayout({ children }: { children: React.ReactNode }) {
  return children
}
