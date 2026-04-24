// Estimates resale value of a vehicle using Lovable AI Gateway, calibrated to Indian used-car market.
// Body: { vehicle: { make, model, year, mileage, fuel_type }, condition }
//    or flat { make, model, year, mileage, fuel_type, condition }
// Returns the rich shape consumed by the Valuation page.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    // Accept both nested vehicle.{...} and flat shapes
    const v = body.vehicle ?? body;
    const make = v.make;
    const model = v.model;
    const year = v.year;
    const mileage = v.mileage;
    const fuel_type = v.fuel_type;
    const condition = body.condition ?? v.condition ?? "Good";

    if (!make || !model || !year) return json(400, { error: "make, model, year required" });

    const prompt = `Estimate the current 2025 resale value (in INR) of this car in the Indian used-car market (Gurugram/NCR):

- Make: ${make}
- Model: ${model}
- Year: ${year}
- Mileage: ${mileage ?? "unknown"} km
- Fuel: ${fuel_type ?? "Petrol"}
- Condition: ${condition}

Return STRICT JSON in this exact shape:
{
  "estimated_value": <integer rupees>,
  "base_value": <integer rupees, ex-showroom equivalent today>,
  "trend_pct": <number, recent 6-month price trend %, can be negative>,
  "confidence": <integer 0-100>,
  "insights": ["3 short positive market insights"],
  "warnings": ["1-2 short risks or caveats"],
  "depreciation": [
    { "months": 0, "value": <integer = estimated_value> },
    { "months": 6, "value": <integer> },
    { "months": 12, "value": <integer> },
    { "months": 24, "value": <integer> },
    { "months": 36, "value": <integer> }
  ]
}

Use realistic Indian used-car dealer prices (CarDekho / OLX / Cars24 averages). Be conservative.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an automotive valuation expert specialising in the Indian used-car market. Output valid JSON only, matching the requested schema exactly." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (aiRes.status === 429) return json(429, { error: "Rate limited" });
    if (aiRes.status === 402) return json(402, { error: "AI credits exhausted" });
    if (!aiRes.ok) {
      const text = await aiRes.text();
      console.error("AI error", aiRes.status, text);
      return json(500, { error: `AI error ${aiRes.status}` });
    }

    const data = await aiRes.json();
    const raw = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { return json(500, { error: "Invalid AI response" }); }

    // Coerce and provide safe defaults
    const estimated_value = Math.round(Number(parsed.estimated_value ?? parsed.estimated_value_inr ?? 0));
    const base_value = Math.round(Number(parsed.base_value ?? estimated_value * 1.05));
    const trend_pct = Number(parsed.trend_pct ?? 0);
    const confidence = Math.max(0, Math.min(100, Math.round(Number(parsed.confidence ?? 75))));
    const insights = Array.isArray(parsed.insights) ? parsed.insights.map(String) : Array.isArray(parsed.factors) ? parsed.factors.map(String) : [];
    const warnings = Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [];

    // Build depreciation, falling back to a smooth curve if AI omits it
    let depreciation: Array<{ months: number; value: number }> = [];
    if (Array.isArray(parsed.depreciation) && parsed.depreciation.length > 0) {
      depreciation = parsed.depreciation.map((d: any) => ({
        months: Math.max(0, Math.round(Number(d.months ?? 0))),
        value: Math.max(0, Math.round(Number(d.value ?? 0))),
      }));
    } else {
      const annualDep = 0.12; // 12% per year fallback
      depreciation = [0, 6, 12, 24, 36].map((m) => ({
        months: m,
        value: Math.round(estimated_value * Math.pow(1 - annualDep, m / 12)),
      }));
    }

    return json(200, { estimated_value, base_value, trend_pct, confidence, insights, warnings, depreciation });
  } catch (e) {
    console.error(e);
    return json(500, { error: String(e) });
  }
});

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
