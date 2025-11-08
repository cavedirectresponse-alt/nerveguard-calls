export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Método não permitido" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    console.log("📩 Webhook recebido:", body);

    const d = body.data;

    // 🔹 Extrai informações da CartPanda
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
      ? /^\+/.test(rawPhone)
        ? rawPhone
        : `+1${rawPhone.replace(/\D/g, "")}`
      : null;

    if (!normalizedPhone || !checkoutUrl) {
      return res.status(400).json({
        success: false,
        error: "Faltam informações obrigatórias (phone ou checkoutUrl)",
      });
    }

    // 🔐 Chaves e endpoint corretos da Retell
    const apiKey = process.env.RETELL_API_KEY;
    const agentId = process.env.RETELL_AGENT_ID;

    if (!apiKey || !agentId) {
      return res.status(500).json({ success: false, error: "Variáveis da Retell ausentes" });
    }

    // 🧠 Chamada à API Retell (endpoint oficial)
    const retellResponse = await fetch("https://api.retellai.com/v1/calls", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        agent_id: agentId,
        phone_number: normalizedPhone,
        variables: {
          name,
          checkout_link: checkoutUrl,
        },
      }),
    });

    const retellJson = await retellResponse.json();
    console.log("📞 Resposta da Retell:", retellJson);

    if (!retellResponse.ok) {
      return res.status(502).json({
        success: false,
        error: "Falha ao contatar Retell",
        retell: retellJson,
      });
    }

    // ✅ Sucesso total
    return res.status(200).json({
      success: true,
      message: "Webhook recebido e enviado à Retell AI com sucesso",
      name,
      checkoutUrl,
      normalizedPhone,
      retell: retellJson,
    });
  } catch (error) {
    console.error("❌ Erro no webhook:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Erro desconhecido",
    });
  }
}
