import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

const title = "CoreChain | Core logging and sample custody";
const description =
  "An offline-first field app and team workspace for core logging, sampling and chain of custody.";

// Link previews need absolute URLs. On Vercel the production address is
// provided by the platform; elsewhere the sign-in URL setting or localhost.
function siteUrl(): URL {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return new URL(`https://${vercel}`);
  return new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000");
}

// Open Graph and Twitter tags, so a pasted link shows a card with the
// picture from app/opengraph-image.tsx in messaging apps and social media.
export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title,
  description,
  openGraph: {
    type: "website",
    siteName: "CoreChain",
    title,
    description,
    url: "/",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
