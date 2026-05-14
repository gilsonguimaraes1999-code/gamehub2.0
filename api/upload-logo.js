const IMGBB_API_KEY = process.env.IMGBB_API_KEY || "fc7a049d22afc785b615ecde51392119";

function send(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
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

export default async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") return send(res, 200, { success: true });
    if (req.method !== "POST") return send(res, 405, { success: false, message: "Método não permitido." });

    const body = await readBody(req);
    const image = body.image;
    if (!image) return send(res, 400, { success: false, message: "Imagem não enviada." });

    const base64 = String(image).includes(",") ? String(image).split(",").pop() : String(image);
    const params = new URLSearchParams();
    params.append("key", IMGBB_API_KEY);
    params.append("image", base64);

    const response = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: params });
    const data = await response.json();
    if (!data.success) throw new Error(data.error?.message || "Falha no upload ImgBB.");

    return send(res, 200, { success: true, url: data.data.url, data: data.data });
  } catch (error) {
    return send(res, 500, { success: false, message: error.message || String(error) });
  }
}
