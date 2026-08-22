import type { MetadataRoute } from "next";

const routes = [
  { path: "", priority: 1, changeFrequency: "daily" as const },
  { path: "/about", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/how-to-send-files-online", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" as const },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return routes.map(({ path, priority, changeFrequency }) => ({
    url: `https://sendvia.site${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
