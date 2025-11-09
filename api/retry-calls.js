import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  console.log("🔁 Executando cron de retry...");

  const RETELL_API_KEY = process.env.RETELL_API_KEY;
  const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID;
  const RETELL_FROM_NUMBER = process.env.RETELL_FROM_NUMBER;

  const filePath = path.resolve("./calls-to-retry.json");

  if (!fs.existsSync(filePath)) {
    return res.status(200).json({ message: "Sem chamadas pendentes." });
  }

  let calls = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const remaining = [];

  for (const call of calls) {
    if (call.attempt >= 3) {
      console.log(`❌ Número ${call.phone} atingiu o limite de tentativas.`);
      continue;
    }

    console.log(`📞 Tentando novamente (${call.attempt + 1}) → ${call.phone}`);

    try {
      const resp = await fetch("https://api.retellai.com/v2/create-phone-call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RETELL_API_KEY}`,
        },
        body: JSON.stringify({
          agent_id: RETELL_AGENT_ID,
          from_number: RETELL_FROM_NUMBER,
          to_number: call.phone,
          variables: {
            name: call.name,
            checkout_url: call.checkoutUrl,
            attempt: call.attempt + 1,
          },
        }),
      });

      const data = await resp.json();
      console.log(`🔁 Resultado retry #${call.attempt + 1}:`, data);

      // 🧠 Nova lógica: só re-tenta se o motivo for "voicemail_reached", "dial_no_answer" ou "user_declined"
      const failed =
        data.status === "error" ||
        ["voicemail_reached", "dial_no_answer", "user_declined"].includes(
          data.end_reason || data.call_status
        );

      if (failed) {
        remaining.push({
          ...call,
          attempt: call.attempt + 1,
          time: Date.now(),
        });
      }
    } catch (err) {
      console.error("⚠️ Erro de rede:", err);
      remaining.push({
        ...call,
        attempt: call.attempt + 1,
        time: Date.now(),
      });
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(remaining, null, 2));

  res.status(200).json({
    message: "Retry concluído.",
    pending: remaining.length,
  });
}
