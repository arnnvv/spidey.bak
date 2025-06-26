import { isValidHttpUrl } from "./validate";
import { readRequestBody } from "./bodyparse";
import { getDatabase } from "./db";

export default {
  async fetch(request, env, _ctx): Promise<Response> {
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

    try {
      const db = getDatabase(env.DB);

      const result = await db`select * from urls;`;

      return new Response(JSON.stringify(result));
    } catch (error) {
      console.error("Database query failed:", error);

      return new Response("Internal Server Error", {
        status: 500,
      });
    }
  },
} satisfies ExportedHandler<Env>;
