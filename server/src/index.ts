import { app } from "./app.js";

const PORT = process.env.PORT || 3001;

if (!process.env.OPENAI_API_KEY) {
  console.warn("WARNING: OPENAI_API_KEY is not set. AI assistant will not work.");
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
