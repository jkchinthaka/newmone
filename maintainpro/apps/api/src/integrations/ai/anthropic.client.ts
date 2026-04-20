import { env } from "../../config/env";

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
}

export const getMaintenanceSuggestion = async (prompt: string): Promise<string> => {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }]
    })
  });

  const data = (await response.json()) as AnthropicResponse;

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${JSON.stringify(data)}`);
  }

  const textChunk = data.content?.find((item) => item.type === "text" && item.text)?.text;

  return textChunk ?? "No suggestion available.";
};
