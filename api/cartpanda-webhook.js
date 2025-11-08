export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Método não permitido" });
  }

  try {
    // Parse seguro do corpo
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    console.log("📩 Webhook recebido:", body);

    const evt = body.event;
    const d = body.data;

    // Nome
    const name =
      d?.customer?.full_name ||
      [d?.customer?.first_name, d?.customer?.last_name].filter(Boolean).join(" ") ||
      "there";

    // Link do carrinho
    const checkoutUrl =
      d?.cart_url ||
      (d?.cart_token ? `https://pay.getnerveguard.org/checkout/${d.cart_token}` : null);

    // Telefone
    const rawPhone =
      d?.customer?.phone || d?.customer_info?.phone || d?.phone || null;

    const normalizedPhone = rawPhone
      ? (/^\+/.test(rawPhone) ? rawPhone : `+1${rawPhone.replace(/\D/g, "")}`)
      : null;

    if (!normalizedPhone || !checkoutUrl) {
      return res
        .status(400)
        .json({ success: false, error: "Faltam phone ou checkoutUrl" });
    }

    // 🔐 Use variáveis de ambiente da Vercel para segurança
    const RETELL_API_KEY = process.env.RETELL_API_KEY;
    const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID;

    // 🚀 Faz a chamada para a Retell AI
    const retellResp = await fetch("https://api.retellai.com/v2/create-phone-call", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RETELL_API_KEY}`,
      },
      body: JSON.stringify({
        agent_id: RETELL_AGENT_ID,
        phone_number: normalizedPhone,
        variables: {
          name,
          checkout_link: checkoutUrl,
        },
      }),
    });

    const retellJson = await retellResp.json();
    console.log("📞 Retell response:", retellJson);

    if (!retellResp.ok) {
      return res.status(502).json({
        success: false,
        error: "Erro ao contatar Retell",
        retell: retellJson,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Webhook recebido e enviado à Retell AI com sucesso",
      name,
      checkoutUrl,
      phone: normalizedPhone,
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
