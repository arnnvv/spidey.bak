export async function readRequestBody(request: Request): Promise<string> {
  const contentType = request.headers.get("content-type");
  if (contentType === null) {
    throw new Error("Content-Type doesn't exist");
  }
  if (contentType.includes("application/json")) {
    return JSON.stringify(await request.json());
  } else if (
    contentType.includes("application/text") ||
    contentType.includes("text/html")
  ) {
    return await request.text();
  } else if (contentType.includes("form")) {
    const formData = await request.formData();
    const body: Record<string, any> = {};
    for (const [key, value] of formData.entries()) {
      body[key] = value;
    }
    return JSON.stringify(body);
  } else {
    throw new Error("Content-Type not supported");
  }
}
