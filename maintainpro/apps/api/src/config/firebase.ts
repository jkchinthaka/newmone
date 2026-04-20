import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging, Messaging } from "firebase-admin/messaging";

import { env } from "./env";
import { logger } from "./logger";

let messaging: Messaging | null = null;

try {
  const app =
    getApps().length > 0
      ? getApp()
      : initializeApp({
          credential: cert({
            projectId: env.FIREBASE_PROJECT_ID,
            privateKey: env.FIREBASE_PRIVATE_KEY,
            clientEmail: env.FIREBASE_CLIENT_EMAIL
          })
        });

  messaging = getMessaging(app);
} catch (error) {
  logger.warn(`Firebase Admin initialization skipped: ${String(error)}`);
}

export const firebaseMessaging = messaging;
