import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SocketProvider } from "./context/socket-context";
import { FilesProvider } from "./context/files-context";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://sendvia.site"),

  title: {
    default: "Sendvia | Fast & Secure File Transfer App",
    template: "%s | Sendvia",
  },

  description:
    "Sendvia lets you securely share large files instantly. Fast, private, encrypted, and easy file transfer platform for teams and individuals.",

  keywords: [
    "file sharing",
    "secure file transfer",
    "send large files",
    "encrypted file sharing",
    "temporary file sharing",
    "fast file transfer",
    "share files online",
    "Sendvia",
  ],

  authors: [
    {
      name: "Sendvia",
      url: "https://sendvia.site",
    },
  ],

  creator: "Sendvia",
  publisher: "Sendvia",

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  alternates: {
    canonical: "https://sendvia.site",
  },

  openGraph: {
    type: "website",
    url: "https://sendvia.site",
    title: "Sendvia | Fast & Secure File Transfer App",
    description:
      "Securely share large files instantly with Sendvia. Fast, encrypted, and simple file transfers.",
    siteName: "Sendvia",
  },

  twitter: {
    card: "summary_large_image",
    title: "Sendvia | Fast & Secure File Transfer App",
    description:
      "Secure file sharing platform for sending large files instantly.",
  },

  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <FilesProvider>
          <SocketProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <TooltipProvider>
                {children}
                <Toaster />
              </TooltipProvider>
            </ThemeProvider>
          </SocketProvider>
        </FilesProvider>
      </body>
    </html>
  );
}