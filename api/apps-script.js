const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || process.env.VITE_APPS_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbxMT1nBshxFoQgHL_u9y3khFovs9J5musUEAlzHJbj3rd5vpLFb9tMsAF_S3B2cUZIF/exec";

function send(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", chunk => data += chunk);
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
    });
  });
}

async function fetchAppsScript(url, options) {
  const response = await fetch(url, { redirect: "follow", ...options });
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json") || /^[\s\n\r]*[\{\[]/.test(text)) {
    try { return { ok: true, status: response.status, payload: JSON.parse(text), raw: text }; }
    catch { return { ok: false, status: response.status, raw: text, error: "Resposta JSON inválida do Apps Script." }; }
  }

  return { ok: false, status: response.status, raw: text, error: "O Apps Script retornou HTML em vez de JSON." };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return send(res, 200, { success: true });

  try {
    if (req.method === "GET") {
      const query = new URLSearchParams(req.query || {});
      query.set("_ts", String(Date.now()));
      const result = await fetchAppsScript(`${APPS_SCRIPT_URL}?${query.toString()}`, { method: "GET", cache: "no-store" });
      if (result.ok) return send(res, 200, result.payload);
      return send(res, 502, {
        success: false,
        message: `${result.error} Confira se o Web App foi implantado como: Executar como Você / Acesso: Qualquer pessoa.`,
        debug: { status: result.status, preview: String(result.raw || "").slice(0, 220) }
      });
    }

    const bodyObj = await readBody(req);

    let result = await fetchAppsScript(APPS_SCRIPT_URL, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(bodyObj),
    });
    if (result.ok) return send(res, 200, result.payload);

    const form = new URLSearchParams();
    Object.entries(bodyObj).forEach(([key, value]) => {
      form.append(key, typeof value === "object" ? JSON.stringify(value) : String(value ?? ""));
    });

    result = await fetchAppsScript(APPS_SCRIPT_URL, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body: form.toString(),
    });
    if (result.ok) return send(res, 200, result.payload);

    result = await fetchAppsScript(`${APPS_SCRIPT_URL}?${form.toString()}`, { method: "GET", cache: "no-store" });
    if (result.ok) return send(res, 200, result.payload);

    return send(res, 502, {
      success: false,
      message: `${result.error} Confira se o Web App foi implantado corretamente e se APPS_SCRIPT_URL está correta no Vercel.`,
      debug: { status: result.status, preview: String(result.raw || "").slice(0, 220) }
    });
  } catch (error) {
    return send(res, 500, { success: false, message: error.message || String(error) });
  }
}
