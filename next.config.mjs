// Origin of the private store of WhatsApp files (#182): scheme, host and port of WA_MEDIA_STORE_ENDPOINT, the same
// rule as storeOrigin() in src/lib/wa-media-storage.ts (https, or http only on this machine). Empty when unset, so
// the page policy stays as before. Signed links (5 minutes) are opened by <img>, <audio> and <video>.
const mediaStoreOrigin = (() => {
  try {
    const url = new URL((process.env.WA_MEDIA_STORE_ENDPOINT ?? "").trim());
    const local = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
    return url.protocol === "https:" || local ? url.origin : "";
  } catch {
    return "";
  }
})();
const withMediaStore = (directive) => (mediaStoreOrigin ? `${directive} ${mediaStoreOrigin}` : directive);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      // NOTE: placehold.co removed — third-party placeholder not for production
    ],
  },

  // A short directions link pasted next to a ")" or a period ("…/ubicacion)") still works: WhatsApp keeps the sign as
  // part of the link (ticket #116). Temporary redirect, so a later change of this rule is not cached by browsers.
  async redirects() {
    return [
      {
        source: "/ubicacion:tail((?:[\\).,;:!?]|%29)+)",
        destination: "/ubicacion",
        permanent: false,
      },
    ];
  },

  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), payment=(self)",
          },
          {
            // CSP: allow self + Cloudinary + Google + Conekta pay + trusted CDNs
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pay.conekta.com https://www.paypal.com https://www.sandbox.paypal.com https://www.googletagmanager.com https://js.stripe.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              withMediaStore("img-src 'self' data: blob: https://res.cloudinary.com https://lh3.googleusercontent.com https://www.paypal.com https://*.stripe.com"),
              withMediaStore("media-src 'self' blob:"),
              "frame-src https://pay.conekta.com https://www.paypal.com https://www.sandbox.paypal.com https://js.stripe.com https://hooks.stripe.com",
              "connect-src 'self' https://openrouter.ai https://api.anthropic.com https://api.conekta.io https://graph.facebook.com https://www.googleapis.com https://api.stripe.com",
              "worker-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;