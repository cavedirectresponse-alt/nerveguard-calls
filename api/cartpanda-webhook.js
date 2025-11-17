import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Método não permitido" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    console.log("📩 Webhook CartPanda RECEBIDO:", body);

    // 🔥 1. Aceita somente abandono de carrinho
    if (body.event !== "order.abandoned") {
      console.log("⏭️ Ignorando evento — não é abandono.");
      return res.status(200).json({ success: true, skip: "not_abandoned" });
    }

    const d = body.data;

    // 🔥 2. IDs dos produtos que acionam ligação
    const TARGET_PRODUCTS = [26257257, 26257299, 26257332];

    const items = d?.items || [];

    const hasTarget = items.some((item) =>
      TARGET_PRODUCTS.includes(item.product_id)
    );

    if (!hasTarget) {
      console.log("⏭️ Abandono sem produtos alvo. Ignorado.");
      return res.status(200).json({ success: true, skip: "no_target_products" });
    }

    // 🔹 Extrai dados do cliente
    const name =
      d?.customer?.full_name ||
      [d?.customer?.first_name, d?.customer?.last_name].filter(Boolean).join(" ") ||
      "there";

    const checkoutUrl =
      d?.cart_url ||
      (d?.cart_token ? `https://pay.getnerveguard.org/checkout/${d.cart_token}` : null);

    const rawPhone =
      d?.customer?.phone ||
      d?.customer_info?.phone ||
      d?.phone ||
      null;

    // Normaliza telefone +1
    const normalizedPhone = rawPhone
      ? (/^\+/.test(rawPhone) ? rawPhone : `+1${rawPhone.replace(/\D/g, "")}`)
      : null;

    if (!normalizedPhone || !checkoutUrl) {
      console.log("❌ Faltam dados necessários (phone ou checkoutUrl).");
      return res.status(400).json({ success: false, error: "Faltam phone ou checkoutUrl" });
    }

    // 🔐 Variáveis da Retell
    const RETELL_API_KEY = process.env.RETELL_API_KEY;
    const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID;
    const RETELL_FROM_NUMBER = process.env.RETELL_FROM_NUMBER;

    // ☎️ 3. Primeira tentativa de ligação
    console.log("📞 Enviando ligação Retell (1ª tentativa)...");

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
          products: items,
        },
      }),
    });

    const retellJson = await retellResp.json();
    console.log("📞 Retell Response:", retellJson);

    // 🔁 4. Se falhar, registra no KV para retry
    const failed =
      retellJson.status === "error" ||
      ["no_answer", "failed", "busy", "voicemail", "call_failed", "unanswered"].includes(
        retellJson.call_status
      );

    if (failed) {
      console.log("⚠️ Ligação malsucedida. Salvando no KV para retry...");

      const existing = (await kv.get("calls_to_retry")) || [];

      existing.push({
        name,
        checkoutUrl,
        phone: normalizedPhone,
        attempt: 1,
        time: Date.now(),
        reason: retellJson.call_status || "unknown",
        products: items,
      });

      await kv.set("calls_to_retry", existing);
    }

    return res.status(200).json({
      success: true,
      triggered: true,
      first_call: retellJson,
    });

  } catch (error) {
    console.error("❌ ERRO no webhook CartPanda:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
