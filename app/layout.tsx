import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { AuthDialog } from "@/components/auth-dialog";
import { GuestSync } from "@/components/guest-sync";
import { AuthParamsListener } from "@/components/auth-params-listener";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { NavBar } from "@/components/nav-bar";
import { SideNav } from "@/components/side-nav";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import "./globals.css";


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
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef7f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1b21" },
  ],
};

// Runs before paint: dark is the default, light only if the visitor chose it.
const themeScript = `try{if(localStorage.getItem("avt:theme")==="light")document.documentElement.classList.remove("dark")}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* Fonts load in the browser, so a blocked or slow network never breaks dev or build. System fonts are the fallback. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* The root layout applies to every page, so the pages-router warning does not apply. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Inter:wght@400;500;600;700&family=Kalam:wght@400;700&display=swap"
        />
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
          <main id="main" tabIndex={-1} className="outline-none">{children}</main>
          <footer className="container border-t py-8 text-center text-sm text-muted-foreground">
            <p>
              {SITE_NAME} · Guided by Meta&apos;s Muse models · Maps & weather by Open-Meteo · Place
              summaries from Wikipedia
            </p>
          </footer>
        </div>
        <MobileTabBar />
        <AuthDialog />
        <GuestSync />
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
