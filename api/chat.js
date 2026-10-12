
const ALLOWED_METHOD = "POST";

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== ALLOWED_METHOD) {
    res.setHeader("Allow", ALLOWED_METHOD);
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const baseUrl = (
    process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
  ).replace(/\/+$/, "");

  if (!apiKey) {
    return res.status(500).json({
      error: "AI service is not configured. Set OPENAI_API_KEY in Vercel."
    });
  }

  try {
    const body = req.body;

    if (!body || typeof body !== "object") {
      return res.status(400).json({
        error: "Request body must be JSON."
      });
    }

    const messages = Array.isArray(body.messages)
      ? body.messages
      : typeof body.message === "string"
        ? [{ role: "user", content: body.message }]
        : [];

    if (messages.length === 0 || messages.length > 30) {
      return res.status(400).json({
        error: "Provide between 1 and 30 messages."
      });
    }

    const validMessages = messages.every((message) =>
      message &&
      ["user", "assistant"].includes(message.role) &&
      typeof message.content === "string" &&
      message.content.length > 0 &&
      message.content.length <= 12000
    );

    if (!validMessages) {
      return res.status(400).json({
        error: "Each message needs a valid role and text content."
      });
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are CodeVault AI, a helpful programming assistant. " +
              "Explain code clearly, help debug errors, and provide " +
              "secure, practical coding examples."
          },
          ...messages
        ],
        temperature: 0.4
      }),
      signal: AbortSignal.timeout(25000)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("AI provider error:", response.status);

      return res.status(502).json({
        error: "The AI provider request failed. Check your API configuration and quota."
      });
    }

    const answer = data.choices?.[0]?.message?.content;

    if (typeof answer !== "string") {
      return res.status(502).json({
        error: "The AI provider returned an unexpected response."
      });
    }

    return res.status(200).json({
      answer,
      reply: answer
    });
  } catch (error) {
    console.error("Chat endpoint error:", error.message);

    return res.status(502).json({
      error: "Unable to reach the AI service. Please try again."
    });
  }
};
