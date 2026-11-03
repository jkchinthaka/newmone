import { redirect } from "next/navigation";

/** Asset tag upload now lives on Add assets → Assign QR tags. */
export default function AssetTagUploadPage() {
  redirect("/admin/assets/new?tab=tags" as never);
}
