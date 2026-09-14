const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface FieldContext {
  field_name: string;
  crop_type: string | null;
  soil_type: string | null;
  acres: number | null;
  soil_metrics: {
    ph: number | null;
    organic_matter_pct: number | null;
    soil_moisture_pct: number | null;
    tested_at: string | null;
  } | null;
  crop_history: { year: number; season: string; crop_type: string; status: string }[];
  weather: {
    condition: string;
    avgTempF: number;
    totalPrecipIn: number;
    maxTempF: number;
    minTempF: number;
    dryDays: number;
    heavyRainDays: number;
    heatWaveDays: number;
    detail: string;
  } | null;
  topography: {
    min_elevation_m: number;
    max_elevation_m: number;
    elevation_change_m: number;
    dominant_aspect: string | null;
  } | null;
}

interface DiagnosticRequest {
  field_context: FieldContext;
  symptom: string;
}

function buildSystemPrompt(ctx: FieldContext): string {
  return `You are a certified agronomist with expertise in soil science, plant pathology, crop nutrition, and integrated pest management. Your role is to diagnose crop and soil problems and provide actionable remediation guidance.

GROUND YOUR REASONING EXCLUSIVELY IN:
- Peer-reviewed agricultural science
- USDA NRCS soil data and crop nutrient guidelines
- Land-Grant University Extension research (e.g., University of Minnesota Extension, Iowa State University Extension, Purdue Extension)
- Established agronomic principles

ANALYTICAL FRAMEWORK:
1. Identify the most probable biochemical or environmental cause(s) of the described symptom, using the provided soil type, crop type, soil metrics (pH, organic matter, moisture), crop rotation history, and recent local weather.
2. Explicitly analyze how recent weather events — including dry spells, heatwaves, heavy rain, or an unfavorable precipitation-versus-evapotranspiration balance — interact with this field's specific soil type, drainage, and water-holding capacity.
3. Use the field's topography to evaluate runoff risk, erosion potential, aspect-driven microclimates, and where water may pool. Relate elevation change and dominant aspect to the field's soil and recent weather rather than treating them as generic terrain facts.
4. Explain the underlying biochemical or environmental mechanism — for example, how dry soil reduces nutrient mobility and uptake, how heat increases crop water demand, how heavy rain causes leaching or denitrification, how pH affects nutrient availability, or how poor drainage limits root respiration.
4. Provide 3–5 specific, actionable remediation steps ranked by priority. Include both immediate actions and long-term management changes.
5. Note any conditions that would require a professional field visit or lab test.

FIELD CONTEXT:
- Field name: ${ctx.field_name}
- Crop type: ${ctx.crop_type || "Not specified"}
- Soil type: ${ctx.soil_type || "Not identified"}
- Acreage: ${ctx.acres != null ? ctx.acres.toFixed(2) + " acres" : "Not specified"}
- Recent soil metrics: ${
    ctx.soil_metrics
      ? `pH ${ctx.soil_metrics.ph ?? "—"}, OM ${ctx.soil_metrics.organic_matter_pct ?? "—"}%, moisture ${ctx.soil_metrics.soil_moisture_pct ?? "—"}% (tested ${ctx.soil_metrics.tested_at ?? "—"})`
      : "No recent soil tests on file"
  }
- Crop rotation history: ${
    ctx.crop_history.length > 0
      ? ctx.crop_history.map((h) => `${h.year} ${h.season}: ${h.crop_type} (${h.status})`).join("; ")
      : "No rotation history recorded"
  }
  - Recent local weather (last 14 days): ${ctx.weather?.detail || "Weather data unavailable"}
  - Topographic summary: ${ctx.topography ? `${ctx.topography.min_elevation_m.toFixed(1)}–${ctx.topography.max_elevation_m.toFixed(1)} m elevation, ${ctx.topography.elevation_change_m.toFixed(1)} m total change, ${ctx.topography.dominant_aspect || "aspect unknown"}` : "Topographic data unavailable"}

Treat this weather summary as field-local evidence. Treat the topographic summary as field-specific evidence for runoff, erosion, microclimates, and water pooling. Explicitly connect precipitation, temperature, drought indicators, and evapotranspiration to the named soil type's drainage and water-holding behavior before making a diagnosis.

Format your response as structured markdown with these sections:
## Likely Cause
## Mechanism
## Remediation Steps
## When to Seek Professional Help

Be concise but thorough. Use plain language a farmer can act on.`;
}

/**
 * Comprehensive rule-based agronomist engine for offline diagnosis.
 * Uses field context and symptom keywords to produce a structured diagnosis
 * grounded in established agronomic science.
 */
function ruleBasedDiagnosis(ctx: FieldContext, symptom: string): string {
  const s = symptom.toLowerCase();
  const crop = ctx.crop_type?.toLowerCase() || "the crop";
  const ph = ctx.soil_metrics?.ph;
  const om = ctx.soil_metrics?.organic_matter_pct;
  const moisture = ctx.soil_metrics?.soil_moisture_pct;
  const soil = ctx.soil_type?.toLowerCase() || "";
  const weather = ctx.weather;
  const isDryWeather = weather != null && (weather.condition === "Dry" || weather.dryDays >= 10);
  const isWetWeather = weather != null && (weather.condition === "Wet" || weather.heavyRainDays >= 3);
  const isHotWeather = weather != null && (weather.condition === "Hot" || weather.heatWaveDays >= 3);
  const topography = ctx.topography;

  const causes: string[] = [];
  const mechanisms: string[] = [];
  const steps: string[] = [];

  // --- Yellowing leaves ---
  if (s.includes("yellow") || s.includes("chloros")) {
    if (s.includes("edge") || s.includes("margin") || s.includes("tip")) {
      // Marginal yellowing often indicates potassium deficiency
      causes.push("**Potassium (K) deficiency** — Marginal or tip yellowing (chlorosis) progressing inward is the classic symptom of K deficiency, especially in corn and soybeans.");
      mechanisms.push("Potassium is relatively immobile in dry soil. When soil moisture is low, K⁺ ions remain bound to clay exchange sites and root uptake drops sharply. Low organic matter further reduces the soil's K-supplying capacity. In corn, deficiency appears first on older leaf margins; in soybeans, it shows as yellowing at leaf edges that may progress to necrosis.");
      steps.push("**Apply potash (K₂O) fertilizer** — Broadcast 60–120 lb K₂O/acre based on soil test recommendations. For immediate effect, a banded application near the row is more efficient in dry conditions.");
      steps.push("**Irrigate if possible** — Even 0.5–1 inch of water will mobilize K in the soil solution and restore root uptake within days.");
      steps.push("**Sample for soil potassium** — Pull a composite soil sample (0–6 inches and 0–12 inches) and submit to a certified lab for K analysis to confirm deficiency and guide application rates.");
    } else if (s.includes("stripe") || s.includes("interveinal") || s.includes("between vein")) {
      // Interveinal chlorosis — magnesium or iron
      if (ph != null && ph >= 7.0) {
        causes.push("**Iron deficiency chlorosis (IDC)** — Interveinal yellowing on younger leaves with high soil pH is characteristic of iron chlorosis, common in soybeans on calcareous soils.");
        mechanisms.push(`At pH ${ph.toFixed(1)}, iron (Fe³⁺) precipitates as iron hydroxides and becomes essentially unavailable to plant roots. This is aggravated by high calcium carbonate levels and poor drainage. The plant cannot synthesize chlorophyll without iron, leading to interveinal yellowing on new growth.`);
        steps.push("**Apply an iron chelate (Fe-EDDHA) treatment** — A foliar spray of 0.5–1.0 lb Fe-EDDHA/acre can green up plants within 7–10 days. For soil application, 2–4 lb/acre in-furrow at planting is effective for next season.");
        steps.push("**Plant IDC-tolerant varieties** — For next season, select soybean varieties rated for iron chlorosis tolerance (scores of 1.0–2.0 on the IDC scale) for high-pH fields.");
        steps.push("**Improve drainage** — If the field has poor drainage or standing water, install tile or surface drains. Saturated conditions reduce root respiration and worsen iron uptake.");
      } else {
        causes.push("**Magnesium (Mg) deficiency** — Interveinal chlorosis on older leaves is a common sign of Mg deficiency, particularly in sandy or low-OM soils.");
        mechanisms.push("Magnesium is the central atom in the chlorophyll molecule. In soils with low cation exchange capacity (sandy, low-OM soils), Mg can be leached or outcompeted by high K⁺ or Ca²⁺ levels. Without adequate Mg, the plant cannot maintain chlorophyll production.");
        steps.push("**Apply dolomitic lime or Mg sulfate** — If pH is below 6.0, apply dolomitic lime (supplies both Ca and Mg). If pH is adequate, apply 20–40 lb Mg/acre as potassium-magnesium sulfate (K-Mag) or Epsom salts.");
        steps.push("**Verify with a soil test** — Check the base saturation ratio; Mg should be 10–15% of CEC. If below 10%, corrective fertilization is warranted.");
      }
    } else {
      // General yellowing — nitrogen
      causes.push("**Nitrogen (N) deficiency** — General yellowing (chlorosis) starting on older leaves and progressing upward is the hallmark of N deficiency.");
      if (moisture != null && moisture < 20) {
        mechanisms.push(`Nitrogen deficiency is likely compounded by low soil moisture (${moisture.toFixed(0)}%). In dry soil, mineralization of organic N slows dramatically, reducing the supply of plant-available nitrate (NO₃⁻) and ammonium (NH₄⁺). Additionally, ${om != null && om < 2 ? `low organic matter (${om.toFixed(1)}%) limits the soil's N mineralization potential. ` : ""}Without sufficient N, the plant breaks down chlorophyll in older leaves to remobilize N to new growth, causing the characteristic upward progression of yellowing.`);
      } else {
        mechanisms.push(`Nitrogen is the most limiting nutrient for non-legume crops. ${om != null && om < 2 ? `With organic matter at ${om.toFixed(1)}%, the soil's N mineralization capacity is limited, meaning less N is released from organic pools. ` : ""}The plant remobilizes N from older leaves to new growth, causing the characteristic upward-progression yellowing.`);
      }
      steps.push("**Apply nitrogen fertilizer** — For corn, side-dress 40–80 lb N/acre as urea-ammonium sulfate (UAN) or anhydrous ammonia. For small grains, a top-dress of 30–50 lb N/acre as ammonium nitrate or UAN is appropriate.");
      steps.push("**Use a urease inhibitor** — If applying urea-based N on the surface, use a urease inhibitor (e.g., NBPT) to reduce volatilization losses, especially in warm, dry conditions.");
      steps.push("**Soil test for N** — Submit a pre-sidedress nitrate test (PSNT) or late-spring soil nitrate test to confirm N status and fine-tune application rates.");
    }
  }

  // --- Wilting / drooping ---
  else if (s.includes("wilt") || s.includes("droop") || s.includes("limp")) {
    if (moisture != null && moisture < 25) {
      causes.push(`**Drought stress / soil moisture deficit** — Current soil moisture is ${moisture.toFixed(0)}%, which is below the critical threshold for most crops. Wilting is the plant's response to insufficient turgor pressure.`);
      mechanisms.push(`At ${moisture.toFixed(0)}% soil moisture, the water potential in the soil is lower than the water potential inside root cells, so water moves OUT of roots rather than IN. The plant loses turgor pressure in leaf cells, causing visible wilting. Prolonged drought also halts nutrient transport — nutrients move to roots primarily via mass flow and diffusion, both of which require water as a carrier.`);
      steps.push("**Irrigate immediately** — Apply 1–1.5 inches of water as soon as possible. Even a single irrigation event can restore turgor and restart nutrient uptake.");
      steps.push("**Apply a light mulch or residue cover** — Maintain crop residue or apply a light mulch to reduce evapotranspiration from the soil surface.");
      steps.push("**Avoid additional stress** — Delay any herbicide applications or cultivation until the crop recovers, as stressed plants are more susceptible to injury.");
    } else {
      causes.push("**Possible vascular wilt or root rot** — Wilting despite adequate soil moisture suggests a below-ground problem: root damage from disease, insects, or compaction.");
      mechanisms.push("Fungal pathogens such as Fusarium or Verticillium colonize the vascular tissue (xylem), blocking water transport to the leaves. Similarly, root rot pathogens (Pythium, Rhizoctonia) destroy the root system's ability to absorb water. Soil compaction can also restrict root growth so severely that the plant cannot access water even when it's present.");
      steps.push("**Dig up affected plants** — Examine roots for discoloration, lesions, or rot. Split stems lengthwise to check for vascular browning (indicative of Fusarium or Verticillium wilt).");
      steps.push("**Submit a plant sample to a diagnostic lab** — Send the whole plant (roots and lower stem) to your state's Extension plant diagnostic clinic for pathogen identification.");
      steps.push("**Improve soil drainage and aeration** — If compaction is suspected, consider deep ripping or tile drainage after harvest to prevent recurrence.");
    }
  }

  // --- Brown spots / lesions ---
  else if (s.includes("brown spot") || s.includes("lesion") || s.includes("blight") || s.includes("rust")) {
    causes.push("**Fungal leaf disease** — Brown spots, lesions, or rust pustules are indicative of a fungal pathogen. Common culprits include gray leaf spot, northern corn leaf blight, or soybean rust depending on crop and timing.");
    mechanisms.push("Fungal spores germinate on leaf surfaces when free moisture is available for 6–8 hours. The fungus penetrates the leaf cuticle and colonizes leaf tissue, disrupting photosynthesis. High humidity, dense canopy, and susceptible varieties increase disease pressure. The pathogen reduces the plant's photosynthetic capacity, leading to yield loss if left unchecked.");
    steps.push("**Submit a sample to a diagnostic lab** — Confirm the pathogen before applying fungicide. Misdiagnosis can lead to ineffective (and expensive) treatments.");
    steps.push("**Apply a foliar fungicide** — If the disease is confirmed and spreading, apply a triazole or strobilurin fungicide (e.g., azoxystrobin, propiconazole) at the labeled rate. Optimal timing is R1 (beginning flowering) for soybeans or VT–R1 (tasseling) for corn.");
    steps.push("**Improve air circulation** — If the canopy is dense, consider adjusting plant populations in future seasons to reduce humidity within the canopy.");
    steps.push("**Select resistant varieties next season** — Choose varieties with known resistance to the identified pathogen for future plantings on this field.");
  }

  // --- Stunted growth ---
  else if (s.includes("stunt") || s.includes("slow growth") || s.includes("short") || s.includes("small")) {
    if (ph != null && (ph < 5.5 || ph > 7.5)) {
      causes.push(`**Soil pH imbalance** — Current pH is ${ph.toFixed(1)}, which is ${ph < 5.5 ? "too acidic" : "too alkaline"} for optimal nutrient availability. Stunted growth is a common consequence.`);
      mechanisms.push(`At pH ${ph.toFixed(1)}, ${ph < 5.5 ? "aluminum and manganese become soluble at toxic levels, damaging root tips and reducing root growth. Phosphorus also becomes fixed by iron and aluminum oxides, making it unavailable" : "phosphorus precipitates as calcium phosphate, and several micronutrients (iron, zinc, manganese) become less available"}. The combined effect is restricted root development and reduced nutrient uptake, leading to stunted plants.`);
      steps.push(ph < 5.5
        ? "**Apply agricultural lime** — Based on the buffer pH, apply 1–3 tons/acre of calcitic or dolomitic lime to raise pH to the 6.0–6.5 range. Incorporate into the top 6 inches for fastest effect."
        : "**Apply elemental sulfur or acidifying amendment** — Apply 500–1000 lb/acre of elemental sulfur to lower pH over 1–2 growing seasons. For immediate but temporary correction, use ammonium sulfate as the N source.");
      steps.push("**Re-test soil pH in 12 months** — pH changes take time; re-test next season to verify correction and adjust management.");
    } else if (om != null && om < 2) {
      causes.push(`**Low organic matter and compaction** — Organic matter is ${om.toFixed(1)}%, which is very low. This limits nutrient- and water-holding capacity and can lead to soil compaction, all of which restrict root growth and cause stunting.`);
      mechanisms.push(`Soils with less than 2% organic matter have poor aggregate stability, low cation exchange capacity, and reduced water-holding capacity. Compaction layers restrict root penetration, forcing roots to grow shallow rather than deep. The plant cannot access nutrients or water beyond the compaction layer, resulting in stunted above-ground growth.`);
      steps.push("**Plant a cover crop** — Use a deep-rooted cover crop such as cereal rye, radish, or annual ryegrass after harvest to break up compaction and add organic matter.");
      steps.push("**Apply compost or manure** — Apply 10–20 tons/acre of well-composted manure to boost organic matter and improve soil structure over time.");
      steps.push("**Reduce tillage** — Switch to reduced-till or no-till to preserve existing organic matter and allow soil structure to rebuild.");
    } else {
      causes.push("**Nutrient deficiency or root restriction** — Stunted growth without a clear above-ground symptom often points to phosphorus deficiency, root-feeding insects, or soil compaction.");
      mechanisms.push("Phosphorus is essential for root development and energy transfer (ATP). In cool or dry soils, P availability drops because it moves to roots only by diffusion, which is extremely slow in cold or dry soil. Root-feeding insects (e.g., corn rootworm, grubs) can also prune the root system, reducing the plant's ability to access water and nutrients.");
      steps.push("**Apply starter phosphorus** — Band 20–30 lb P₂O₅/acre as a starter fertilizer near the row to support early root development.");
      steps.push("**Check for root-feeding insects** — Dig around the base of stunted plants and look for grubs, rootworms, or root damage. If present, consider an insecticide seed treatment or soil-applied insecticide for next season.");
      steps.push("**Soil test for phosphorus and compaction** — Submit a soil test for P and K, and use a penetrometer or probe to check for a compaction layer at 6–12 inches.");
    }
  }

  // --- Poor emergence / stand ---
  else if (s.includes("emergence") || s.includes("stand") || s.includes("germination") || s.includes("thin")) {
    causes.push("**Poor emergence** — Thin stands can result from planting into cold or wet soil, crusting, seedling disease, or improper planting depth.");
    mechanisms.push("Germination requires soil temperatures above 50°F for corn and 54°F for soybeans. Planting into cold soil delays emergence and increases vulnerability to seedling pathogens (Pythium, Fusarium). Soil crusting forms when rain breaks down surface aggregates, creating a hard layer that emerging seedlings cannot penetrate. Seedling diseases thrive in cool, wet soils and attack the seed or emerging radicle before the plant establishes.");
    steps.push("**Assess the stand** — Count plants per 1/1000 acre (17.5 ft of 30-inch rows). If the stand is below 50% of the target population, consider replanting if the calendar date still allows it.");
    steps.push("**Check planting depth and soil temperature** — Verify that seeds were planted at the correct depth (1.5–2 inches for corn, 1–1.5 inches for soybeans) and that soil temperature at planting depth was above the minimum threshold.");
    steps.push("**Use a seed treatment next season** — Apply a fungicide + insecticide seed treatment (e.g., metalaxyl + imidacloprid) to protect against seedling disease and early insect feeding.");
  }

  // --- General fallback ---
  else {
    causes.push("**Insufficient information for a specific diagnosis** — The symptom description does not match a clear diagnostic pattern. A site visit or photo would help narrow the cause.");
    mechanisms.push(`Based on the available field context (${crop} on ${ctx.soil_type || "unidentified soil"}, ${ph != null ? `pH ${ph.toFixed(1)}` : "pH unknown"}, ${moisture != null ? `moisture ${moisture.toFixed(0)}%` : "moisture unknown"}), the field's conditions should be evaluated for common stressors including nutrient deficiency, water stress, soil pH imbalance, and pest or disease pressure. A more detailed symptom description or photograph would enable a more precise diagnosis.`);
    steps.push("**Provide more detail** — Describe the specific symptoms: which leaves are affected (old vs. new), the pattern (spots, stripes, uniform), when it started, and how many plants are affected.");
    steps.push("**Take photos** — Capture close-up images of affected leaves and a wider shot showing the pattern across the field.");
    steps.push("**Submit a plant/soil sample** — Contact your local Extension office for guidance on submitting a sample to a diagnostic lab.");
    steps.push("**Schedule a field visit** — If the problem is spreading or affecting a large area, consult your local agronomist or Extension educator for an on-site assessment.");
  }

  if (topography && topography.elevation_change_m >= 3) {
    mechanisms.push(`The field spans ${topography.elevation_change_m.toFixed(1)} m of elevation change and is ${topography.dominant_aspect || "of mixed aspect"}. This relief can move heavy-rain runoff toward lower areas, concentrate erosion on steeper sections, and create different moisture and temperature conditions across the field.`);
    steps.push("**Scout by elevation zone** — Inspect upper slopes for soil loss and exposed roots, and lower areas for sediment deposits, ponding, and uneven crop growth. Use contour-aligned traffic and residue cover where runoff is concentrated.");
  }

  if (isDryWeather) {
    mechanisms.push(`Recent local weather was dry over the last 14 days (${weather?.dryDays} dry days, ${weather?.totalPrecipIn} inches of precipitation, and a ${weather?.detail.match(/Water balance \(precip − ET₀\): ([^.]*)/)?.[1] || "negative water balance"} inch water balance). On ${soil || "this soil"}, that pattern can reduce plant-available water, slow diffusion of phosphorus and potassium, and reduce microbial nutrient mineralization.`);
    steps.push("**Check soil moisture at root depth** — Probe several representative locations before applying additional fertilizer. Irrigate where practical, prioritizing the crop's active root zone.");
  } else if (isWetWeather) {
    mechanisms.push(`Recent local weather was unusually wet, with ${weather?.heavyRainDays} heavy-rain days and ${weather?.totalPrecipIn} inches of precipitation. On soils with slower drainage, saturation reduces root oxygen, increases denitrification, and can promote root and foliar disease.`);
    steps.push("**Inspect drainage and root-zone saturation** — Check low areas and dig roots for discoloration. Avoid traffic on saturated soil to prevent compaction.");
  }

  if (isHotWeather) {
    mechanisms.push(`The field experienced ${weather?.heatWaveDays} days at or above 90°F, with an average temperature of ${weather?.avgTempF}°F. Heat raises crop evapotranspiration demand and can intensify drought stress even when recent rainfall appears adequate.`);
    steps.push("**Reduce heat and water stress** — Maintain residue, avoid unnecessary tillage, and irrigate based on root-zone depletion rather than surface appearance.");
  }

  // Add soil-moisture context if relevant
  if (moisture != null && moisture < 20 && !s.includes("wilt")) {
    steps.push("**Address soil moisture** — Current moisture is very low. Nutrient uptake, microbial activity, and root growth are all impaired in dry soil. Irrigate if possible, or plan for drought-tolerant management practices.");
  }

  // Add pH context if relevant
  if (ph != null && (ph < 5.5 || ph > 7.5) && !s.includes("stunt")) {
    steps.push(`**Correct soil pH** — Current pH (${ph.toFixed(1)}) is outside the optimal range. Addressing pH will improve overall nutrient availability and should be a long-term priority.`);
  }

  let result = `## Likely Cause\n\n${causes.join("\n\n")}\n\n## Mechanism\n\n${mechanisms.join("\n\n")}\n\n## Remediation Steps\n\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n## When to Seek Professional Help\n\nIf symptoms persist after implementing the above steps, or if the problem is spreading rapidly across the field, contact your local Extension office or a certified crop advisor for an on-site diagnosis. A laboratory soil test and/or plant tissue analysis can confirm nutrient deficiencies and rule out disease.`;

  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { field_context, symptom } = (await req.json()) as DiagnosticRequest;

    if (!symptom || !symptom.trim()) {
      return new Response(
        JSON.stringify({ error: "A symptom description is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!field_context) {
      return new Response(
        JSON.stringify({ error: "Field context is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // If an OpenAI-compatible API key is configured, use the LLM
    const llmApiKey = Deno.env.get("OPENAI_API_KEY");
    if (llmApiKey) {
      try {
        const systemPrompt = buildSystemPrompt(field_context);
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${llmApiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: symptom },
            ],
            temperature: 0.4,
            max_tokens: 1200,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const content = data?.choices?.[0]?.message?.content;
          if (content) {
            return new Response(
              JSON.stringify({ diagnosis: content, source: "LLM (GPT-4o)" }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
        }
      } catch {
        // Fall through to rule-based
      }
    }

    // Rule-based agronomist engine fallback
    const diagnosis = ruleBasedDiagnosis(field_context, symptom);
    return new Response(
      JSON.stringify({ diagnosis, source: "Rule-based agronomist engine" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
