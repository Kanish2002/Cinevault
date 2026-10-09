import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CineVault — Your personal cinema",
    short_name: "CineVault",
    description:
      "A place for every story. Discover and save movies with voice or text.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#111210",
    theme_color: "#111210",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Quick movie capture", url: "/?capture=1" },
      { name: "My Watchlist", url: "/watchlist" },
    ],
    share_target: {
      action: "/capture",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  } as MetadataRoute.Manifest;
}
