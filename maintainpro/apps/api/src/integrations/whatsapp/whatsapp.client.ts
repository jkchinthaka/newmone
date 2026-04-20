import { env } from "../../config/env";

export interface WhatsAppMessageInput {
  to: string;
  text: string;
}

export const sendWhatsAppMessage = async (payload: WhatsAppMessageInput): Promise<Record<string, unknown>> => {
  const endpoint = `https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_ID}/messages`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.WHATSAPP_TOKEN}`
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: payload.to,
      type: "text",
      text: {
        body: payload.text
      }
    })
  });

  const body = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(`WhatsApp API error: ${JSON.stringify(body)}`);
  }

  return body;
};
