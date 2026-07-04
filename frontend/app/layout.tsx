import Link from "next/link";

export const metadata = {
  title: "VitalLink",
  description: "Real-time blood & organ donor matching",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
        <style>{`
          @keyframes blink { 0%,100%{opacity:1;} 50%{opacity:0.25;} }
          @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
          @keyframes spin { 0%{transform:rotate(0deg);} 100%{transform:rotate(360deg);} }
          @media(max-width:860px) {
            .live-main-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </head>
      <body style={{ margin: 0, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", backgroundColor: "#EDF1EF", color: "#14231F", WebkitFontSmoothing: "antialiased" }}>
        {children}
      </body>
    </html>
  );
}
