import type { Metadata, Viewport } from "next";
import { Caveat, Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { AuthDialog } from "@/components/auth-dialog";
import { AuthParamsListener } from "@/components/auth-params-listener";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { NavBar } from "@/components/nav-bar";
import { SideNav } from "@/components/side-nav";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const script = Caveat({ subsets: ["latin"], variable: "--font-script", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${SITE_NAME}: ${SITE_TAGLINE}`, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#050816",
};

// Runs before paint: dark is the default, light only if the visitor chose it.
const themeScript = `try{if(localStorage.getItem("avt:theme")==="light")document.documentElement.classList.remove("dark")}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${sans.variable} ${display.variable} ${script.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only z-50 rounded-full bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <SideNav />
        <div className="pb-16 lg:pb-0 lg:pl-20">
          <NavBar />
          <main id="main">{children}</main>
          <footer className="container border-t py-8 text-center text-sm text-muted-foreground">
            <p>
              {SITE_NAME} · Guided by Meta&apos;s Muse models · Maps & weather by Open-Meteo · Place
              summaries from Wikipedia
            </p>
          </footer>
        </div>
        <MobileTabBar />
        <AuthDialog />
        <Suspense fallback={null}>
          <AuthParamsListener />
        </Suspense>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "hsl(var(--card))",
              color: "hsl(var(--card-foreground))",
              border: "1px solid hsl(var(--border))",
            },
          }}
        />
      </body>
    </html>
  );
}
