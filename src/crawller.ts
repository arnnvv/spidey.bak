import { Pool } from "@neondatabase/serverless";
import { isValidHttpUrl } from "./validate";

class TextHandler {
  accumulatedText: string = "";
  textChunks: string[] = [];

  text(textChunk: Text) {
    this.accumulatedText += textChunk.text;

    if (textChunk.lastInTextNode) {
      const trimmed = this.accumulatedText.trim().replace(/\s+/g, " ");
      if (trimmed.length > 0) {
        this.textChunks.push(trimmed);
      }
      this.accumulatedText = "";
    }
  }

  getExtractedText(): string {
    return this.textChunks.join("\n");
  }
}

class LinkHandler {
  links: Set<string> = new Set();
  baseUrl: URL;

  constructor(baseUrl: string) {
    this.baseUrl = new URL(baseUrl);
  }

  element(element: Element) {
    const href = element.getAttribute("href");
    if (href) {
      try {
        const absoluteUrl = new URL(href, this.baseUrl.href).href;
        this.links.add(absoluteUrl);
      } catch (e) {
        console.error(e);
      }
    }
  }
}

export async function crawl(url: string, pool: Pool) {
  try {
    await pool.query(
      "UPDATE urls SET status = 'crawling', error_message = NULL WHERE url = $1",
      [url],
    );

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Spidermini-Crawler/1.0 (Cloudflare Worker)",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch URL: ${response.status} ${response.statusText}`,
      );
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("text/html")) {
      throw new Error("Content is not HTML");
    }

    const textHandler = new TextHandler();
    const linkHandler = new LinkHandler(url);

    const rewriter = new HTMLRewriter()
      .on(
        "p, div, span, a, h1, h2, h3, h4, h5, h6, li, th, td, article, main, section, pre",
        textHandler,
      )
      .on("a[href]", linkHandler);

    await rewriter.transform(response).arrayBuffer();

    const extractedText = textHandler.getExtractedText();
    const validNewLinks = [...linkHandler.links].filter(isValidHttpUrl);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        "UPDATE urls SET status = 'crawled', content = $2, crawled_at = NOW() WHERE url = $1",
        [url, extractedText],
      );

      if (validNewLinks.length > 0) {
        for (const newUrl of validNewLinks) {
          await client.query(
            "INSERT INTO urls (url, status) VALUES ($1, 'pending') ON CONFLICT (url) DO NOTHING",
            [newUrl],
          );
        }
      }

      await client.query("COMMIT");
    } catch (dbError) {
      await client.query("ROLLBACK");
      throw dbError;
    } finally {
      client.release();
    }

    console.log(`Successfully crawled: ${url}`);
  } catch (error: any) {
    console.error(`Failed to crawl ${url}:`, error.message);
    await pool.query(
      "UPDATE urls SET status = 'failed', error_message = $2, crawled_at = NOW() WHERE url = $1",
      [url, error.message],
    );
  }
}
