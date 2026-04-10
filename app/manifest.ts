import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Foreman",
    short_name: "Foreman",
    description: "Field service management for contractors",
    start_url: "/",
    display: "standalone",
    background_color: "#f9f8f5",
    theme_color: "#0f1923",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "64x64",
        type: "image/x-icon",
      },
    ],
  };
}
