import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Método não permitido" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    console.log("📩 Webhook CartPanda recebido:", body);

    const d = body.data;

    // 🔹 Extrai dados do cliente
    const name =
      d?.customer?.full_name ||
      [d?.customer?.first_name, d?.customer?.last_name].filter(Boolean).join(" ") ||
      "there";

    const checkoutUrl =
      d?.cart_url ||
      (d?.cart_token ? `https://pay.getnerveguard.org/checkout/${d.cart_token}` : null);

    const rawPhone =
      d?.customer?.phone || d?.customer_info?.phone || d?.phone || null;

    const normalizedPhone = rawPhone
      ? (/^\+/.test(rawPhone) ? rawPhone : `+1${rawPhone.replace(/\D/g, "")}`)
      : null;

    if (!normalizedPhone || !checkoutUrl) {
      return res.status(400).json({ success: false, error: "Faltam phone ou checkoutUrl" });
    }

    // 🔐 Variáveis da Retell
    const RETELL_API_KEY = process.env.RETELL_API_KEY;
    const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID;
    const RETELL_FROM_NUMBER = process.env.RETELL_FROM_NUMBER;

    // ☎️ 1ª tentativa de ligação
    const retellResp = await fetch("https://api.retellai.com/v2/create-phone-call", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RETELL_API_KEY}`,
      },
      body: JSON.stringify({
        agent_id: RETELL_AGENT_ID,
        from_number: RETELL_FROM_NUMBER,
        to_number: normalizedPhone,
        variables: {
          name,
          checkout_url: checkoutUrl,
          attempt: 1,
        },
      }),
    });

    const retellJson = await retellResp.json();
    console.log("📞 Retell Response:", retellJson);

    const failed =
      retellJson.status === "error" ||
      ["no_answer", "failed", "busy", "voicemail", "call_failed", "unanswered"].includes(
        retellJson.call_status
      );

    // 💾 Se falhar, salva no arquivo de retry
    if (failed) {
      console.log("⚠️ Ligação malsucedida. Salvando para retry...");

      const filePath = path.resolve("./calls-to-retry.json");
      const oldData = fs.existsSync(filePath)
        ? JSON.parse(fs.readFileSync(filePath, "utf8"))
        : [];

      oldData.push({
        name,
        checkoutUrl,
        phone: normalizedPhone,
        attempt: 1,
        time: Date.now(),
        reason: retellJson.call_status,
      });

      fs.writeFileSync(filePath, JSON.stringify(oldData, null, 2));
    }

    return res.status(200).json({
      success: true,
      message: "Webhook processado. Ligação enviada à Retell.",
      first_call: retellJson,
    });
  } catch (error) {
    console.error("❌ Erro no webhook CartPanda:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
