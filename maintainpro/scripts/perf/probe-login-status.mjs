const response = await fetch("http://127.0.0.1:3016/api/backend/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "not-a-user@example.com", password: "wrong-pass-fixture" }),
  signal: AbortSignal.timeout(20000)
});
const text = await response.text();
const safe = /token|password|secret/i.test(text) ? "redacted" : text.slice(0, 400);
console.log(JSON.stringify({ status: response.status, body: safe }));
