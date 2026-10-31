import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import prisma from "../db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CORE_PAGES = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/products", priority: "0.9", changefreq: "weekly" },
  { path: "/partners", priority: "0.8", changefreq: "monthly" },
  { path: "/services", priority: "0.8", changefreq: "monthly" },
  { path: "/about", priority: "0.7", changefreq: "monthly" },
  { path: "/blogs", priority: "0.7", changefreq: "weekly" },
  { path: "/contact", priority: "0.8", changefreq: "monthly" },
];

export function escapeXml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function formatLastmod(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

export function generateSitemapXml(products, baseUrl = "https://iconelectromatic.com") {
  const origin = baseUrl.replace(/\/+$/, "");

  // Find latest active product update date to provide valid lastmod for catalog pages
  let latestProductDate = null;
  (products || []).forEach((p) => {
    if (p.updatedAt) {
      const d = p.updatedAt instanceof Date ? p.updatedAt : new Date(p.updatedAt);
      if (!isNaN(d.getTime()) && (!latestProductDate || d > latestProductDate)) {
        latestProductDate = d;
      }
    }
  });
  const catalogLastmod = formatLastmod(latestProductDate);

  const entries = [];

  // Core website pages
  CORE_PAGES.forEach((page) => {
    const loc = page.path === "/" ? `${origin}/` : `${origin}${page.path}`;
    // Assign real lastmod derived from catalog update if relevant, otherwise omit if unrecorded
    const lastmod = (page.path === "/" || page.path === "/products") ? catalogLastmod : null;
    entries.push({
      loc,
      lastmod,
      changefreq: page.changefreq,
      priority: page.priority,
    });
  });

  // Active products from PostgreSQL
  (products || []).forEach((prod) => {
    const loc = `${origin}/product/${encodeURIComponent(prod.id)}`;
    const lastmod = formatLastmod(prod.updatedAt);
    entries.push({
      loc,
      lastmod,
      changefreq: "monthly",
      priority: "0.6",
    });
  });

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];

  entries.forEach((e) => {
    lines.push("  <url>");
    lines.push(`    <loc>${escapeXml(e.loc)}</loc>`);
    if (e.lastmod) {
      lines.push(`    <lastmod>${escapeXml(e.lastmod)}</lastmod>`);
    }
    lines.push(`    <changefreq>${escapeXml(e.changefreq)}</changefreq>`);
    lines.push(`    <priority>${escapeXml(e.priority)}</priority>`);
    lines.push("  </url>");
  });

  lines.push("</urlset>");
  lines.push(""); // trailing newline

  return lines.join("\n");
}

export async function getActiveProducts(prismaClient = prisma) {
  return prismaClient.product.findMany({
    where: {
      visible: true,
      category: {
        visible: true,
        oem: {
          visible: true,
        },
      },
    },
    select: {
      id: true,
      updatedAt: true,
    },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
}

function findFallbackSitemap() {
  const candidatePaths = [
    path.resolve(__dirname, "../../public/sitemap.fallback.xml"),
    path.resolve(__dirname, "../../public/sitemap.xml"),
    path.resolve(__dirname, "../../dist/sitemap.fallback.xml"),
    path.resolve(__dirname, "../../dist/sitemap.xml"),
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function createSitemapHandler({
  prismaClient = prisma,
  baseUrl = process.env.SITE_ORIGIN || "https://iconelectromatic.com",
  fallbackPath = null,
} = {}) {
  return async (_req, res) => {
    try {
      const products = await getActiveProducts(prismaClient);
      const xml = generateSitemapXml(products, baseUrl);
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=600, s-maxage=600");
      return res.status(200).send(xml);
    } catch (error) {
      console.error("Dynamic sitemap database query failed:", error.message);
      const resolvedFallback = fallbackPath || findFallbackSitemap();
      if (resolvedFallback && fs.existsSync(resolvedFallback)) {
        const fallbackXml = fs.readFileSync(resolvedFallback, "utf-8");
        res.setHeader("Content-Type", "application/xml; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
        return res.status(200).send(fallbackXml);
      }

      return res.status(503).json({
        success: false,
        message: "Unable to generate sitemap.",
      });
    }
  };
}

export function createSitemapRouter(options = {}) {
  const router = Router();
  router.get("/", createSitemapHandler(options));
  return router;
}

const defaultRouter = createSitemapRouter();
export default defaultRouter;

