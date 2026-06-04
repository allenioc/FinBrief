/** Stable Unsplash photo URLs for mock article thumbnails (educational demo only). */

const unsplash = (photoId: string, w = 1200, h = 675) =>
  `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

export const ARTICLE_IMAGES = {
  aapl: {
    url: unsplash("photo-1511707171634-5f897ff02aa9"),
    alt: "Smartphone on a desk representing Apple and consumer technology",
  },
  tsla: {
    url: unsplash("photo-1560958089-b786066dfe85"),
    alt: "Electric vehicle charging, representing Tesla and the EV industry",
  },
  fed: {
    url: unsplash("photo-1529107386315-e1a2ecc61026"),
    alt: "Government and financial district buildings, representing Federal Reserve policy",
  },
  market: {
    url: unsplash("photo-1611974789855-9c2a0a7236a3"),
    alt: "Stock market chart on a display, representing broad market indexes",
  },
  aiChips: {
    url: unsplash("photo-1518770660439-4636190af475"),
    alt: "Computer circuit board and chips, representing semiconductors and AI infrastructure",
  },
  inflation: {
    url: unsplash("photo-1579621970795-87facc2f976d"),
    alt: "Consumer shopping and prices, representing inflation and CPI trends",
  },
  techSector: {
    url: unsplash("photo-1551288049-bebda4e38f71"),
    alt: "Analytics dashboard on a laptop, representing the technology sector",
  },
} as const;
