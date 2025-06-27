import { isValidHttpUrl } from "./validate";
import { readRequestBody } from "./bodyparse";
import { getDatabase } from "./db";
import { crawl } from "./crawller";

export default {
  async fetch(request, env, ctx): Promise<Response> {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/") {
      return new Response("Not found", {
        status: 404,
      });
    }

    let body;
    try {
      const bodyString = await readRequestBody(request);
      body = JSON.parse(bodyString);
    } catch (e) {
      return new Response(
        JSON.stringify({
          error: "Invalid request body",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (!body.hasOwnProperty("url")) {
      return new Response(
        JSON.stringify({
          error: 'Missing "url" field in request body',
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const seedUrl = body.url;
    if (!isValidHttpUrl(seedUrl)) {
      return new Response(
        JSON.stringify({
          error: "Invalid URL provided",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }
    const pool = getDatabase(env.DB);

    try {
      await pool.query(
        "INSERT INTO urls (url, status) VALUES ($1, 'pending') ON CONFLICT (url) DO NOTHING",
        [seedUrl],
      );

      ctx.waitUntil(crawl(seedUrl, pool));

      return new Response(
        JSON.stringify({
          message: "URL accepted for crawling.",
          url: seedUrl,
        }),
        {
          status: 202,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    } catch (error) {
      console.error("Database or initial processing error:", error);
      return new Response(
        JSON.stringify({
          error: "Internal Server Error",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }
  },
} satisfies ExportedHandler<Env>;
