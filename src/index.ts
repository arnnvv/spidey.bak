import { isValidHttpUrl } from "./validate";
import { readRequestBody } from "./bodyparse";
import { getDatabase } from "./db";
import { crawl } from "./crawller";

const BATCH_SIZE = 5;

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

  async scheduled(_controller, env, ctx): Promise<void> {
    console.log("Cron trigger received. Looking for pending URLs...");
    const pool = getDatabase(env.DB);
    try {
      const { rows } = await pool.query<{
        url: string;
      }>("SELECT url FROM urls WHERE status = 'pending' LIMIT $1", [
        BATCH_SIZE,
      ]);

      if (rows.length === 0) {
        console.log("No pending URLs to crawl.");
        return;
      }

      console.log(`Found ${rows.length} URLs to crawl.`);

      const crawlPromises = rows.map((row) => crawl(row.url, pool));
      ctx.waitUntil(Promise.all(crawlPromises));
    } catch (error) {
      console.error("Cron handler failed:", error);
    }
  },
} satisfies ExportedHandler<Env>;
