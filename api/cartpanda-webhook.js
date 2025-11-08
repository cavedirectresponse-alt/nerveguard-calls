export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Método não permitido" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    console.log("📩 Webhook recebido:", body);

    const d = body.data;
    if (!d) {
      return res.status(400).json({ success: false, error: "JSON sem campo data" });
    }

    // 🔹 Nome
    const name =
      d?.customer?.full_name ||
      [d?.customer?.first_name, d?.customer?.last_name].filter(Boolean).join(" ") ||
      "there";

    // 🔹 URL do carrinho
    const checkoutUrl =
      d?.cart_url ||
      (d?.cart_token ? `https://pay.getnerveguard.org/checkout/${d.cart_token}` : null);

    // 🔹 Telefone (normaliza)
    const rawPhone =
      d?.customer?.phone || d?.customer_info?.phone || d?.phone || null;

    const normalizedPhone = rawPhone
      ? (/^\+/.test(rawPhone) ? rawPhone : `+1${rawPhone.replace(/\D/g, "")}`)
      : null;

    if (!normalizedPhone || !checkoutUrl) {
      return res.status(400).json({ success: false, error: "Faltam phone ou checkoutUrl" });
    }

    // 🔐 Chave e agente da Retell
    const apiKey = process.env.RETELL_API_KEY;
    const agentId = process.env.RETELL_AGENT_ID;

    if (!apiKey || !agentId) {
      return res.status(500).json({ success: false, error: "Variáveis da Retell ausentes" });
    }

    // 🧠 Endpoint principal + fallback
    const endpoints = [
      "https://api.retellai.com/v1/calls",
      "https://api.retell.ai/v1/calls"
    ];

    let retellResp, retellJson, ok = false;

    for (const url of endpoints) {
      try {
        retellResp = await fetch(url, {
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

        retellJson = await retellResp.json();
        if (retellResp.ok) {
          ok = true;
          console.log("📞 Retell OK:", url);
          break;
        } else {
          console.log("⚠️ Retell retornou erro:", url, retellJson);
        }
      } catch (err) {
        console.log("❌ Erro tentando:", url, err.message);
      }
    }

    if (!ok) {
      return res.status(502).json({
        success: false,
        error: "Falha ao contatar Retell",
        details: retellJson,
      });
    }

    // ✅ Tudo certo
    return res.status(200).json({
      success: true,
      message: "Webhook recebido e enviado à Retell AI",
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
