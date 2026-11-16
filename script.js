/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = document.getElementById("sendBtn");
const latestQuestion = document.getElementById("latestQuestion");

// The address of YOUR deployed Cloudflare Worker.
// Replace this with the URL Cloudflare gives you after you deploy.
// Note: there is no API key in this file. The key lives in Cloudflare.
const WORKER_URL = "https://loreal-chatbot.mateoriosusa.workers.dev/";

// The system prompt tells the AI who it is and what it may talk about.
const systemPrompt = `You are the L'Oréal Beauty Advisor, a friendly and professional assistant that helps people discover and understand L'Oréal products (makeup, skincare, haircare, and fragrance) and build personalized routines and recommendations.

Rules:
- Only answer questions about L'Oréal products, beauty routines, product recommendations, and closely related beauty topics such as ingredients, skin or hair types, and application tips.
- If a question is unrelated to these topics, politely decline in one or two sentences and invite the user to ask about L'Oréal products or beauty routines instead.
- When you need more detail to recommend something, ask a short question first (for example skin type, hair type, concerns, or budget).
- Do not invent product names or claims. If you are not sure a product exists, say so and suggest checking loreal.com.
- Do not give medical advice. For skin or scalp conditions, suggest seeing a dermatologist.
- Remember details the user shares during the conversation, such as their name, skin or hair type, concerns, budget, and what they asked earlier. Use them naturally in later answers, and address the user by name once you know it.
- Keep answers short (under about 120 words) and use plain text without markdown symbols.`;

// This array remembers the whole conversation. It starts with the system prompt.
// We send the entire array every time so the AI remembers earlier messages
// (like the user's name and past questions).
const messages = [{ role: "system", content: systemPrompt }];

// To keep requests small, we only send the most recent messages.
// 20 messages is about 10 back-and-forth turns.
const MAX_HISTORY = 20;

// Remove the oldest messages if the history gets too long.
// Index 0 is the system prompt, so we always keep it.
function trimHistory() {
  while (messages.length > MAX_HISTORY + 1) {
    messages.splice(1, 1); // remove the oldest non-system message
  }
}

/* Add a message bubble to the chat window.
   sender is "user" or "ai". Returns the new element. */
function addMessage(sender, text) {
  const msg = document.createElement("div");
  msg.className = `msg ${sender}`;
  msg.textContent = text; // textContent is safe: it never runs HTML
  chatWindow.appendChild(msg);

  // Scroll down so the newest message is visible
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return msg;
}

// Set the initial greeting (shown only, not sent to the AI)
addMessage(
  "ai",
  "👋 Hello! I'm your L'Oréal Beauty Advisor. Ask me about makeup, skincare, haircare, or fragrance, or tell me about your skin or hair and I'll suggest a routine.",
);

/* Handle form submit */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault(); // stop the page from reloading

  // 1. Capture what the user typed
  const text = userInput.value.trim();
  if (text === "") return;

  // 2. Show it in the chat and add it to the conversation history
  addMessage("user", text);
  messages.push({ role: "user", content: text });
  trimHistory();
  userInput.value = "";

  // Show the latest question above the chat (replaces the previous one)
  latestQuestion.innerHTML = "<span>You asked:</span> ";
  latestQuestion.append(text); // append() adds plain text, so it is safe
  latestQuestion.hidden = false;

  // 3. Show a temporary "Thinking…" message and block double-sending
  const thinking = addMessage("ai", "Thinking…");
  thinking.classList.add("thinking");
  sendBtn.disabled = true;

  try {
    // 4. Send the conversation to our Cloudflare Worker (which calls OpenAI)
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messages }),
    });

    const data = await response.json();

    // If OpenAI sent back an error, show it clearly
    if (!response.ok || data.error) {
      throw new Error(data.error?.message || `Request failed (${response.status})`);
    }

    // 5. Read the reply and show it
    const reply = data.choices[0].message.content;
    thinking.remove();
    addMessage("ai", reply);

    // 6. Save the reply so the AI remembers it next time
    messages.push({ role: "assistant", content: reply });
  } catch (error) {
    console.error(error);
    thinking.remove();
    addMessage("ai", "Sorry, something went wrong. Please try again in a moment.");

    // Remove the failed user message so the history stays clean
    messages.pop();
  } finally {
    sendBtn.disabled = false;
    userInput.focus();
  }
});