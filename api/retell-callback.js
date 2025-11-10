import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    console.log("📞 Retell callback recebido:", body);

    const reason = body.end_reason || body.call_end_reason || "";
    const callId = body.call_id || body.id;
    const phone = body.to_number || body.variables?.phone;
    const name = body.variables?.name || "there";
    const checkoutUrl = body.variables?.checkout_url || "";

    const RETRY_REASONS = [
      "voicemail_reached",
      "dial_no_answer",
      "user_declined",
      "call_failed",
      "no_answer",
      "busy",
      "unanswered",
    ];

    const IGNORE_REASONS = [
      "agent_hangup",
      "user_hangup",
      "completed",
      "success",
    ];

    const filePath = path.resolve("./calls-to-retry.json");
    const oldData = fs.existsSync(filePath)
      ? JSON.parse(fs.readFileSync(filePath, "utf8"))
      : [];

    if (RETRY_REASONS.includes(reason)) {
      const exists = oldData.some((c) => c.call_id === callId);

      if (!exists) {
        oldData.push({
          call_id: callId,
          name,
          phone,
          checkoutUrl,
          attempt: 1,
          time: Date.now(),
          reason,
        });

        fs.writeFileSync(filePath, JSON.stringify(oldData, null, 2));
        console.log(`🔁 Ligação malsucedida (${reason}) salva para retry.`);
      } else {
        console.log(`⚠️ Ligação já registrada para retry (${phone}).`);
      }
    } else if (IGNORE_REASONS.includes(reason)) {
      console.log(`✅ Ligação finalizada normalmente (${reason}). Nenhum retry necessário.`);
    } else {
      console.log(`ℹ️ End reason não reconhecido (${reason}). Ignorado.`);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Erro no callback Retell:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
