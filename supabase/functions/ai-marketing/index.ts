import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const toolGuides: Record<string, string> = {
  content: "Create a 7-day social media content pack. Include a content calendar with platform, format, hook, caption, CTA, and relevant hashtags. Make every post distinct and practical.",
  ads: "Write ad copy variations for Meta, Google Search, and TikTok. Include primary text, headline, description where relevant, CTA, and 3 distinct angles. Respect platform policies and avoid unsupported claims.",
  strategy: "Create a practical marketing strategy: positioning, target audience, customer pain points, value proposition, channel mix, funnel, KPIs, 30-day priorities, and risks. Label assumptions clearly.",
  campaign: "Create a 30-day campaign plan with weekly objectives, channel, audience, content/ad deliverables, CTA, KPI, and a simple testing plan. Separate organic activities from paid media.",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token || token === authHeader) return json({ error: "Please sign in first." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    if (!supabaseUrl || !anonKey) return json({ error: "Supabase function configuration is incomplete." }, 500);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser(token);
    if (authError || !user) return json({ error: "Your session is invalid. Sign in again." }, 401);
    if (user.app_metadata?.role !== "admin") return json({ error: "Admin access required." }, 403);

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "AI is not configured yet. Add GEMINI_API_KEY in Supabase Edge Function Secrets." }, 503);

    const body = await req.json();
    const tool = String(body.tool || "");
    if (!toolGuides[tool]) return json({ error: "Unknown marketing tool." }, 400);

    const business = String(body.business || "").trim().slice(0, 180);
    const industry = String(body.industry || "").trim().slice(0, 120);
    const audience = String(body.audience || "").trim().slice(0, 500);
    const offer = String(body.offer || "").trim().slice(0, 500);
    const tone = String(body.tone || "Professional and engaging").slice(0, 100);
    const platform = String(body.platform || "Instagram, Facebook, TikTok, and Google").slice(0, 160);
    const language = String(body.language || "English").slice(0, 40);
    const goal = String(body.goal || "Increase qualified enquiries").trim().slice(0, 300);
    if (!business || !industry || !offer) return json({ error: "Business name, industry, and offer are required." }, 400);

    const prompt = `You are AdNova AI, a senior performance marketing strategist and creative director.
Create client-ready work, specific to the business below. Be commercially practical, original, clear, and truthful. Do not invent research, statistics, testimonials, guarantees, or performance results. Clearly label assumptions. Use readable headings and concise tables/lists where helpful.
TASK: ${toolGuides[tool]}
BUSINESS: ${business}
INDUSTRY: ${industry}
TARGET AUDIENCE: ${audience || "Suggest a likely audience and label it as an assumption."}
OFFER / PRODUCT: ${offer}
MARKETING GOAL: ${goal}
CHANNELS: ${platform}
BRAND TONE: ${tone}
OUTPUT LANGUAGE: ${language}
Include a short "Assumptions to validate" section at the end.`;

    const aiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ model: "gemini-3.8-flash", input: prompt }),
    });
    const aiData = await aiResponse.json();
    if (!aiResponse.ok) {
      console.error("Gemini request failed", aiResponse.status, aiData?.error?.status || "unknown");
      return json({ error: "The AI provider could not complete the request. Check the Gemini API key and quota, then try again." }, 502);
    }
    const output = (aiData.steps || [])
      .filter((step: any) => step.type === "model_output")
      .flatMap((step: any) => step.content || [])
      .filter((part: any) => part.type === "text" && typeof part.text === "string")
      .map((part: any) => part.text)
      .join("\n\n").trim();
    if (!output) return json({ error: "The AI returned an empty response. Please try again." }, 502);
    return json({ output, model: aiData.model || "gemini-3.8-flash" });
  } catch (error) {
    console.error("AI marketing error", error);
    return json({ error: "Something went wrong while generating your marketing content." }, 500);
  }
});