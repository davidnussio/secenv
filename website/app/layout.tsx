import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://envsec.dev";
const siteName = "envsec";
const siteDescription =
  "Cross-platform CLI for managing environment secrets using native OS credential stores. macOS Keychain, Linux Secret Service, Windows Credential Manager. Secrets never touch disk.";

export const metadata: Metadata = {
  title: {
    default: "envsec — Secrets that never touch disk",
    template: "%s | envsec",
  },
  description: siteDescription,
  keywords: [
    "secrets management",
    "environment variables",
    "CLI",
    "keychain",
    "credential store",
    "envsec",
    "dotenv",
    "env file",
    "macOS Keychain",
    "GNOME Keyring",
    "Windows Credential Manager",
    "secret-tool",
    "security CLI",
    "cross-platform",
    "Node.js",
    "npm",
  ],
  authors: [{ name: "David Nussio", url: "https://github.com/davidnussio" }],
  creator: "David Nussio",
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName,
    title: "envsec — Secrets that never touch disk",
    description: siteDescription,
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "envsec — Cross-platform CLI for managing environment secrets",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "envsec — Secrets that never touch disk",
    description: siteDescription,
    images: ["/og-image.svg"],
  },
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${inter.variable} ${jetbrainsMono.variable} dark h-full antialiased`}
      lang="en"
    >
      <head>
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
