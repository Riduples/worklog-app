import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WORKLOG",
    short_name: "WORKLOG",
    description: "Bookkeeping for South African small and informal businesses",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0C4A6E",
    theme_color: "#0C4A6E",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
