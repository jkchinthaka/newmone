const apiBase = (
  process.env.MAINTAINPRO_API_URL ??
  process.env.STAGING_API_URL ??
  "https://newmone.onrender.com/api"
).replace(/\/+$/, "");

const password = process.env.MAINTAINPRO_SMOKE_PASSWORD ?? process.env.MAINTAINPRO_SEED_PASSWORD ?? "";

if (!password) {
  console.error("Set MAINTAINPRO_SMOKE_PASSWORD or MAINTAINPRO_SEED_PASSWORD in shell env.");
  process.exit(1);
}

const users = [
  { label: "admin", email: "admin@maintainpro.local", role: "ADMIN" },
  { label: "manager", email: "manager@maintainpro.local", role: "MANAGER" },
  { label: "technician", email: "tech@maintainpro.local", role: "TECHNICIAN" },
  { label: "security_officer", email: "security@maintainpro.local", role: "SECURITY_OFFICER" },
  { label: "store_keeper", email: "inventory@maintainpro.local", role: "INVENTORY_KEEPER" },
  { label: "superadmin", email: "superadmin@maintainpro.local", role: "SUPER_ADMIN" }
];

async function tryLogin(email) {
  const response = await fetch(`${apiBase}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: password.trim() })
  });
  const body = await response.json().catch(() => ({}));
  const role =
    body?.data?.user?.role?.name ??
    body?.data?.user?.role ??
    body?.data?.user?.roleName ??
    "unknown";
  return { status: response.status, ok: response.ok, role: typeof role === "string" ? role : String(role) };
}

console.log(`API=${apiBase}`);
for (const user of users) {
  try {
    const result = await tryLogin(user.email);
    console.log(`${user.label}:${result.ok ? "PASS" : "FAIL"} status=${result.status} role=${result.role}`);
  } catch (error) {
    console.log(`${user.label}:FAIL error=${error instanceof Error ? error.message : String(error)}`);
  }
}
