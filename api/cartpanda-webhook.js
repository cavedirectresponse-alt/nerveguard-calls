export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Método não permitido" });
  }

  try {
    // 1️⃣ Parse do corpo recebido
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    console.log("📩 Webhook recebido:", body);

    const d = body.data;

    // 2️⃣ Extrai nome, link e telefone do JSON da CartPanda
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

    // 3️⃣ Chama a API da Retell (domínio .com)
    const retellResponse = await fetch("https://api.retellai.com/v1/calls", {
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

    // 4️⃣ Trata o retorno da Retell
    const retellJson = await retellResponse.json();
    console.log("📞 Resposta da Retell:", retellJson);

    if (!retellResponse.ok) {
      return res.status(502).json({
        success: false,
        error: "Falha ao contatar Retell",
        retell: retellJson,
      });
    }

    // 5️⃣ Retorna sucesso para a CartPanda
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
