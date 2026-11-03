from flask import Flask, render_template, request, jsonify
import os
import requests

app = Flask(_name_)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    try:
        message = request.json.get("message", "").strip()

        if not message:
            return jsonify({"error": "Please enter a message"}), 400

        api_key = os.environ.get("GROQ_API_KEY")

        if not api_key:
            return jsonify({"error": "AI service is not configured"}), 500

        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are ShieldX AI, a helpful cybersecurity learning assistant."
                    },
                    {"role": "user", "content": message}
                ],
                "temperature": 0.7
            },
            timeout=30
        )

        response.raise_for_status()
        answer = response.json()["choices"][0]["message"]["content"]

        return jsonify({"reply": answer})

    except requests.RequestException:
        return jsonify({"error": "AI service request failed"}), 502
    except Exception:
        return jsonify({"error": "Something went wrong"}), 500

if _name_ == "_main_":
    app.run()
