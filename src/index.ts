import { isValidHttpUrl } from "./validate";
import { readRequestBody } from "./bodyparse";
import { getDatabase } from "./db";

export default {
  async fetch(request, env, ctx): Promise<Response> {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/") {
      return new Response("Not found", {
        status: 404,
      });
    }
    const bodyString = await readRequestBody(request);

    const body = JSON.parse(bodyString);

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

    if (!isValidHttpUrl(body.url)) {
      return new Response("URL not valid");
    }
    const pool = getDatabase(env.DB);

    try {
      const existingUrl = await pool.query({
        text: "SELECT * FROM urls WHERE url = $1",
        values: [body.url],
      });

      if (existingUrl.rows.length > 0) {
        return new Response(
          JSON.stringify({
            message: "URL already exists",
            url: body.url,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }

      const insertResult = await pool.query({
        text: "INSERT INTO urls (url) VALUES ($1) RETURNING *",
        values: [body.url],
      });

      return new Response(
        JSON.stringify({
          message: "URL inserted successfully",
          data: insertResult.rows[0],
        }),
        {
          status: 201,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    } catch (error) {
      console.error("Database query failed:", error);

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
    } finally {
      ctx.waitUntil(pool.end());
    }
  },
} satisfies ExportedHandler<Env>;
