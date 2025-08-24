import express from "express";
import fetch from "node-fetch"; // remove if Node 18+; native fetch is available
import cors from "cors";
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());

// Load OpenAI API key from environment variable
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY not set in .env");
  process.exit(1);
}

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage || userMessage.trim() === "") {
      return res.status(400).json({ reply: "Message cannot be empty" });
    }

    // Call OpenAI API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${'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'}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: userMessage }]
      })
    });

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      return res.status(500).json({ reply: "No response from OpenAI" });
    }

    res.json({ reply: data.choices[0].message.content });

  } catch (err) {
    console.error("Chatbot error:", err);
    res.status(500).json({ reply: "Server error" });
  }
});

app.listen(5000, () => console.log("✅ Chatbot server running on http://localhost:5000"));
