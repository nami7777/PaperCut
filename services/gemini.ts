export async function generateAiKeywords(prompt: string) {
  const res = await fetch("/.netlify/functions/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) {
    console.error("Gemini API error", await res.text());
    return [];
  }

  const data = await res.json();
  return data.keywords || [];
}
