import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "About Sendvia",
  description:
    "Sendvia is a simple, fast, and secure way to share files directly between devices with no uploads and no cloud storage.",
  alternates: { canonical: "https://sendvia.site/about" },
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children
}
