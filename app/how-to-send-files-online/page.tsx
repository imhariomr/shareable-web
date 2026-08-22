import type { Metadata } from "next"
import Script from "next/script"
import Navbar from "@/components/ui/navbar"
import Footer from "@/components/ui/footer"

export const metadata: Metadata = {
  title: "How to Send Files Online",
  description:
    "A step-by-step guide to sharing files instantly between devices with Sendvia's secure peer-to-peer transfer.",
  alternates: { canonical: "https://sendvia.site/how-to-send-files-online" },
}

const STEPS = [
  { title: "Start a Sharing Session", text: "Click Start Sharing or navigate to sendvia.site/sharing. This generates a unique connection code for your device." },
  { title: "Open Sendvia on the Other Device", text: "On the second device, open sendvia.site/sharing too. It gets its own unique code." },
  { title: "Connect the Devices", text: "On either device, enter the other device's code and click Connect. Make sure both devices have the sharing page open." },
  { title: "Devices Are Now Connected", text: "Once connected, both devices establish a direct peer-to-peer link and can send files to each other." },
  { title: "Select or Drag Your Files", text: "Drag and drop files into the share area on either device, then click Share to begin the transfer." },
  { title: "File Transfer Begins", text: "Sendvia transfers the files directly between the two connected devices, with no cloud upload." },
  { title: "Download the Received Files", text: "Each received file gets its own download button, so you can save files individually as soon as they arrive." },
]

export default function HowToSharePage() {
  return (
    <main className="min-h-screen bg-gray-50 text-slate-900 dark:bg-slate-950 dark:text-white transition-colors">
      <Script
        id="sendvia-howto-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "HowTo",
            name: "How to Send Files Online with Sendvia",
            step: STEPS.map((step) => ({
              "@type": "HowToStep",
              name: step.title,
              text: step.text,
            })),
          }),
        }}
      />

      <Navbar page="HowToSharePage" />

      <section className="py-20">
        <div className="mx-auto max-w-4xl px-6 space-y-12">

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-semibold">
              How to Share Files Online with SendVia
            </h1>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Last updated: {new Date().getFullYear()}
            </p>

            <p className="text-gray-600 dark:text-gray-300">
              SendVia allows you to share files instantly using secure
              peer-to-peer technology. Files transfer directly between
              devices without uploading them to any server. Follow the
              simple steps below to start sending files online.
            </p>
          </div>

          {STEPS.map((step, i) => (
            <TermBlock key={step.title} title={`Step ${i + 1} — ${step.title}`}>
              {step.text}
            </TermBlock>
          ))}

        </div>
      </section>

      <Footer />
    </main>
  )
}

function TermBlock({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
        {children}
      </p>
    </div>
  )
}