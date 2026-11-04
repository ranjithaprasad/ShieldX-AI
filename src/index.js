const SYSTEM_PROMPT = `
You are a friendly cybersecurity learning assistant.
Help users understand cybersecurity concepts in clear,
beginner-friendly English only.

You may explain Kali Linux, Linux commands, networking,
Nmap, Burp Suite, OWASP, VAPT, vulnerability assessment,
SQL injection, XSS, authentication, secure coding and
defensive security.

Keep all practical testing within systems the user owns
or has explicit permission to assess, or intentionally
vulnerable training labs such as DVWA and Metasploitable.
For real targets, do not provide instructions to break in,
steal credentials, deploy malware, evade detection, or
damage systems. Redirect such requests to safe lab
demonstrations, detection, remediation and prevention.

When explaining a tool or command, state what it does,
when it is used, explain important options, and include
a safe example where appropriate. Do not pretend that
a scan or test has actually been performed.
`;

const MAX_MESSAGE_LENGTH = 4000;
const recentRequests = new Map();

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function allowedByRateLimit(request) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 12;
  const entry = recentRequests.get(ip);

  if (!entry || now - entry.start > windowMs) {
    recentRequests.set(ip, { start: now, count: 1 });
    return true;
  }

  if (entry.count >= maxRequests) return false;
  entry.count += 1;
  return true;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health" && request.method === "GET") {
      return json({ ok: true, service: "cybersecurity-assistant" });
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      if (!allowedByRateLimit(request)) {
        return json({ error: "Too many requests. Please wait one minute." }, 429);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Request body must be valid JSON." }, 400);
      }

      const message = typeof body.message === "string"
        ? body.message.trim()
        : "";

      if (!message) {
        return json({ error: "Please enter a question." }, 400);
      }

      if (message.length > MAX_MESSAGE_LENGTH) {
        return json({ error: "Message is too long. Limit: 4000 characters." }, 413);
      }

      if (!env.AI) {
        return json({ error: "AI binding is missing. Check wrangler.jsonc." }, 500);
      }

      try {
        const result = await env.AI.run(
          "@cf/google/gemma-4-26b-a4b-it",
          {
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: message }
            ],
            chat_template_kwargs: { enable_thinking: false }
          }
        );

        const answer =
          result?.response ||
          result?.choices?.[0]?.message?.content ||
          result?.message ||
          "";

        if (!answer) {
          return json({ error: "The AI returned an empty response. Try again." }, 502);
        }

        return json({ answer });
      } catch (error) {
        console.error("Workers AI error:", error);
        return json({
          error: "AI service request failed. Check Workers AI availability and logs."
        }, 502);
      }
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "API endpoint not found." }, 404);
    }

    return env.ASSETS.fetch(request);
  }
};
