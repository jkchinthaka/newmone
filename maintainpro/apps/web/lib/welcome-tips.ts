import type { RoleHomeProfileKey } from "@/lib/role-home";

export type WelcomeGuide = { title: string; tips: string[] };

const GUIDES: Record<RoleHomeProfileKey, WelcomeGuide> = {
  REQUESTER: {
    title: "Welcome. Here is how to report a problem",
    tips: [
      "Tap Report issue, say what is wrong and press Send now. Add more details only if you want to.",
      "Open My requests to see where your report is. You get a message when it is fixed.",
      "No signal? Your report is saved on this phone and sent when you are back online."
    ]
  },
  TECHNICIAN: {
    title: "Welcome. Your day in three steps",
    tips: [
      "Open My jobs. Your assigned jobs are there, newest first.",
      "Press Start, take the before photo, do the work, then press Finish job and take the after photo.",
      "Parts used and notes go on the job. If you must stop, press Hold and pick a reason."
    ]
  },
  SUPERVISOR: {
    title: "Welcome. Your checks and follow-ups",
    tips: [
      "Jobs waiting for your check are on the Jobs page. Open one, look at the photos, then verify or send it back with a reason.",
      "Use the Requests page to see new reports and who is working on them.",
      "Anything overdue shows on your home page first."
    ]
  },
  FLEET: {
    title: "Welcome. Vehicles at a glance",
    tips: [
      "Fleet shows every vehicle with its service and document dates.",
      "Report issue raises a problem for a vehicle. Pick the vehicle, say what is wrong, Send now.",
      "Compliance shows licence, insurance and emission dates that are due soon."
    ]
  },
  MANAGER: {
    title: "Welcome. What needs you first",
    tips: [
      "The home page shows Approvals, unassigned jobs and overdue jobs. Each card opens the exact list.",
      "Approvals can be approved one by one or several at once.",
      "Compliance lists equipment certificates and vehicle documents that are due or expired."
    ]
  },
  MANAGEMENT_VIEWER: {
    title: "Welcome. Your reports",
    tips: [
      "Reports opens the operational reports. You can look but not change anything.",
      "Management Intelligence gives the headline numbers.",
      "Use the search box at the top to jump to any page."
    ]
  },
  PROCUREMENT: {
    title: "Welcome. Buying and stock",
    tips: [
      "Buying shows purchase requests waiting for you.",
      "Vendors holds supplier records and how they performed.",
      "Inventory shows low stock so you can order before a job is held up."
    ]
  }
};

const STORE_GUIDE: WelcomeGuide = {
  title: "Welcome. Your store in three steps",
  tips: [
    "Inventory shows stock and low-stock parts. Check it before a job is held up for parts.",
    "Part requests from jobs are issued from the store. Open the request, give the parts and confirm.",
    "Parts that arrive are booked in with Goods in, so the stock count stays right."
  ]
};

/** Store staff get their own guide; every other role follows its Role Home profile. */
export function welcomeGuideForRole(roleName: string | null | undefined, roleKey: RoleHomeProfileKey): WelcomeGuide {
  const role = String(roleName ?? "").toUpperCase().trim();
  if (role === "INVENTORY_KEEPER" || role === "STOREKEEPER") return STORE_GUIDE;
  // Gate staff only report and follow requests, so they get the report guide, not the fleet one.
  if (role === "SECURITY_OFFICER") return GUIDES.REQUESTER;
  return welcomeGuideFor(roleKey);
}

export function welcomeGuideFor(roleKey: RoleHomeProfileKey): WelcomeGuide {
  return GUIDES[roleKey] ?? GUIDES.REQUESTER;
}
