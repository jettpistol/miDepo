import type { MetadataRoute } from "next";

/** Permite instalar miDepo en el teléfono como una app ("Agregar a pantalla de inicio"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "miDepo",
    short_name: "miDepo",
    description: "El depósito de libros, ordenado.",
    lang: "es-AR",
    start_url: "/",
    display: "standalone",
    background_color: "#002FA7",
    theme_color: "#002FA7",
    icons: [
      { src: "/icono-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icono-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icono-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
