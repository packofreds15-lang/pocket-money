// Entry point when Pocket Money is deployed as a Cloudflare Worker (Workers & Pages → Import repository).
// /api/... goes to the API; everything else is served from the public/ folder.
import { handleApi } from "./server/api.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return handleApi(request, env, ctx);
    return env.ASSETS.fetch(request);
  },
};
