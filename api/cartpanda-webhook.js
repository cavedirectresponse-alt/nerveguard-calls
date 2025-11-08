export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Método não permitido" });
  }

  try {
    // 1) Parse do corpo (JSON)
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    console.log("📩 Webhook recebido:", body);

    // 2) ⬇️ EXTRAÇÃO DOS DADOS DA CARTPANDA
    const evt = body.event; // ex.: 'abandoned.created'
    const d = body.data;

    // nome (tenta full_name; senão junta first+last)
    const name =
      d?.customer?.full_name ||
      [d?.customer?.first_name, d?.customer?.last_name].filter(Boolean).join(" ") ||
      "there";

    // URL do carrinho (usa cart_url; fallback para cart_token)
    const checkoutUrl =
      d?.cart_url ||
      (d?.cart_token ? `https://pay.getnerveguard.org/checkout/${d.cart_token}` : null);

    // telefone (tenta em vários lugares; normaliza para E.164)
    const rawPhone =
      d?.customer?.phone || d?.customer_info?.phone || d?.phone || null;

    // Se vier com +, mantém; se não, prefixa +1 e remove não-dígitos
    const normalizedPhone = rawPhone
      ? (/^\+/.test(rawPhone) ? rawPhone : `+1${rawPhone.replace(/\D/g, "")}`)
      : null;

    if (!normalizedPhone || !checkoutUrl) {
      return res.status(400).json({ success: false, error: "Faltam phone ou checkoutUrl" });
    }

    // 3) CHAMA A RETELL (liga automaticamente)
    const retellResp = await fetch("https://api.retell.ai/v1/call", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
      },
      body: JSON.stringify({
        agent_id: process.env.RETELL_AGENT_ID,
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
      return res.status(502).json({ success: false, error: "Retell não aceitou a chamada", retell: retellJson });
    }

    // 4) Resposta para a CartPanda
    return res.status(200).json({
      success: true,
      message: "Webhook recebido e enviado à Retell AI",
      name,
      checkoutUrl,
      normalizedPhone,
      retell: retellJson
    });

  } catch (error) {
    console.error("❌ Erro no webhook:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Erro desconhecido"
    });
  }
}
