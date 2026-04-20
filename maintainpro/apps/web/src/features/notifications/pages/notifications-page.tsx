import { useState } from "react";

import toast from "react-hot-toast";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";

type NotificationChannel = "email" | "push" | "whatsapp";

export const NotificationsPage = () => {
  const [channel, setChannel] = useState<NotificationChannel>("email");
  const [recipient, setRecipient] = useState("ops@maintainpro.local");
  const [title, setTitle] = useState("MaintainPro Alert");
  const [message, setMessage] = useState("Critical work order is nearing SLA breach.");

  const submit = async () => {
    try {
      await apiClient.post("/notifications/send", {
        channel,
        recipient,
        title,
        message
      });

      toast.success("Notification processed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send notification");
    }
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Dispatch maintenance alerts to email, push notifications, or WhatsApp channels."
      />

      <Card className="max-w-2xl">
        <div className="grid gap-4">
          <label className="text-sm font-medium text-slate-700">
            Channel
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={channel}
              onChange={(event) => setChannel(event.target.value as NotificationChannel)}
            >
              <option value="email">Email</option>
              <option value="push">Push</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            Recipient
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Title
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Message
            <textarea
              className="mt-1 h-28 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </label>

          <div>
            <Button onClick={() => void submit()}>Send Notification</Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
