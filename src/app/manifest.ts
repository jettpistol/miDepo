import type { MetadataRoute } from "next";

/** Lets miDepo be installed on the phone as an app ("Add to Home Screen"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "miDepo",
    short_name: "miDepo",
    description: "El depósito, en orden.",
    lang: "es-AR",
    start_url: "/",
    display: "standalone",
    background_color: "#002FA7",
    theme_color: "#002FA7",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
