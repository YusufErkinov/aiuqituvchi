// api/generate-pptx.js
// Vercel Serverless Function: Hybrid PPTX image router with Imagen fallback chain
// POST /api/generate-pptx
//
// Body:
// {
//   "title": "Taqdimot nomi",
//   "slides": [
//     {
//       "title": "Ona plata",
//       "body": "Ona plata kompyuterning asosiy platasi...",
//       "bullets": ["Protsessor ulanadi", "RAM ulanadi"]
//     }
//   ]
// }
//
// ENV:
// GEMINI_API_KEY=...
// GEMINI_MODEL=gemini-3.1-flash-lite-preview
// IMAGEN_MODEL_FAST=imagen-4.0-fast-generate-001
// IMAGEN_MODEL_STANDARD=imagen-4.0-generate-001
// IMAGEN_MODEL_ULTRA=imagen-4.0-ultra-generate-001
// PEXELS_API_KEY=...              // ixtiyoriy
// UNSPLASH_ACCESS_KEY=...         // ixtiyoriy

import fs from "fs/promises";
import path from "path";
import os from "os";
import PptxGenJS from "pptxgenjs";

export const config = {
  maxDuration: 60
};

const ROUTER_SYSTEM_PROMPT = `
You are an image-routing classifier for an automated PPTX slide generator.

Analyze one slide and choose the best image route:

FACTUAL:
Use when the slide is about a concrete, real-world, visually identifiable subject:
hardware, computer components, devices, tools, machines, people, places, real objects.
Return a short English search query for Pexels/Unsplash.

ABSTRACT:
Use when the slide is about concepts, processes, logic, cybersecurity, AI, software ideas,
future scenarios, invisible systems, innovation, or anything better shown as a generated concept image.
Return a detailed English image generation prompt.

STRICT OUTPUT:
Return ONLY valid JSON. No markdown. No explanation. No extra keys.

FACTUAL schema:
{
  "image_type": "FACTUAL",
  "search_query": "english query here"
}

ABSTRACT schema:
{
  "image_type": "ABSTRACT",
  "image_prompt": "english image prompt here"
}

Rules:
- Output strings must be English.
- FACTUAL search_query: 3-8 words, search optimized, main visual object first.
- ABSTRACT image_prompt: modern educational presentation style, wide 16:9, no text in image.
- Physical object/device = prefer FACTUAL.
- Concept/workflow/future idea = prefer ABSTRACT.
`;
const SLIDE_PLAN_SYSTEM_PROMPT = `
You are an expert Uzbek presentation planner for school teachers.

Task:
Create a concise presentation outline in Uzbek based on:
- subject
- grade
- topic

Return ONLY valid JSON.
No markdown.
No explanation.

Rules:
- Return 5 to 8 content slides.
- Do NOT create a cover/title slide. The cover is already generated separately.
- Each slide must have:
  - title
  - body
  - bullets (2 to 5 items)
- Use simple, school-friendly Uzbek language.
- Make the presentation clear and educational.
- Avoid repeating the same point across slides.
- Keep text presentation-friendly, not too long.

JSON schema:
{
  "slides": [
    {
      "title": "string",
      "body": "string",
      "bullets": ["string", "string", "string"]
    }
  ]
}
`;
const defaultSlides = [
  {
    title: "Ona plata",
    body: "Ona plata kompyuterning asosiy platasi bo‘lib, protsessor, RAM va boshqa qurilmalarni bog‘laydi.",
    bullets: ["Komponentlarni ulaydi", "Protsessor va RAM shu plataga o‘rnatiladi", "Portlar va chipset orqali boshqaradi"]
  },
  {
    title: "Kiberxavfsizlik",
    body: "Kiberxavfsizlik axborot tizimlari va ma’lumotlarni raqamli tahdidlardan himoya qilishga qaratilgan.",
    bullets: ["Parollarni himoyalash", "Zararli dasturlardan saqlanish", "Shaxsiy ma’lumotlarni xavfsiz saqlash"]
  }
];

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST method allowed" });
  }

  try {
    const body = parseBody(req.body);
    const title =
  body.title ||
  `${body.subject || "Fan"} - ${body.topic || "Taqdimot"}`;

let slides = normalizeSlides(body.slides || []);

if (!slides.length) {
  if (body.topic) {
    slides = await generateSlidesFromTopic({
      subject: body.subject,
      grade: body.grade,
      topic: body.topic,
      slidesCount: body.slidesCount || 7
    });
  } else {
    slides = defaultSlides;
  }
}

    if (!slides.length) {
      return res.status(400).json({ ok: false, error: "slides ro‘yxati bo‘sh" });
    }
    const pptxBuffer = await createPresentation(slides, title, body.subject, body.grade);
    // const pptxBuffer = await createPresentation(slides, title);
    const fileName = makeFileName(title);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Cache-Control", "no-store");

    return res.status(200).send(pptxBuffer);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      mode: "pptx_error",
      error: error.message || "Unknown PPTX error"
    });
  }
}

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function parseBody(body) {
  if (!body) return {};
  if (typeof body === "string") {
    try { return JSON.parse(body); } catch { return {}; }
  }
  return body;
}

function normalizeSlides(slides) {
  if (!Array.isArray(slides)) return [];

  return slides
    .map(slide => ({
      title: String(slide.title || "Slayd").trim(),
      body: String(slide.body || "").trim(),
      bullets: Array.isArray(slide.bullets)
        ? slide.bullets.map(x => String(x || "").trim()).filter(Boolean).slice(0, 6)
        : []
    }))
    .filter(slide => slide.title || slide.body || slide.bullets.length)
    .slice(0, 10);
}

function makeFileName(title) {
  const safe = String(title || "presentation")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "presentation";

  return safe + ".pptx";
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function clean(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function safeJsonParse(text) {
  const cleaned = String(text || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {}

  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);

  throw new Error("Classifier JSON parse failed: " + cleaned);
}

function slideText(slide) {
  return [slide.title, slide.body, ...(slide.bullets || [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function heuristicRoute(slide) {
  const t = slideText(slide);

  const factual = [
    ["ona plata", "computer motherboard close up"],
    ["motherboard", "computer motherboard close up"],
    ["ram", "computer RAM memory module"],
    ["xotira", "computer RAM memory module"],
    ["protsessor", "computer processor CPU close up"],
    ["cpu", "computer processor CPU close up"],
    ["monitor", "computer monitor on desk"],
    ["klaviatura", "computer keyboard close up"],
    ["keyboard", "computer keyboard close up"],
    ["sichqoncha", "computer mouse close up"],
    ["printer", "office printer close up"],
    ["skaner", "document scanner device"],
    ["router", "wifi router device"],
    ["server", "server rack data center"],
    ["ssd", "solid state drive close up"],
    ["video karta", "graphics card GPU close up"],
    ["gpu", "graphics card GPU close up"]
  ];

  for (const [key, query] of factual) {
    if (t.includes(key)) {
      return { image_type: "FACTUAL", search_query: query };
    }
  }

  return {
    image_type: "ABSTRACT",
    image_prompt:
      `Clean modern educational presentation illustration about "${slide.title}", ` +
      `professional EdTech style, wide 16:9 composition, soft gradients, no text`
  };
}

async function callGeminiClassifier(payload) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");

  const models = unique([
    process.env.GEMINI_MODEL,
    process.env.GEMINI_TEXT_MODEL,
    "gemini-3.1-flash-lite-preview",
    "gemini-3-flash-preview",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash"
  ]);

  let lastError = "";

  for (const model of models) {
    try {
      const url =
        "https://generativelanguage.googleapis.com/v1beta/models/" +
        model +
        ":generateContent?key=" +
        apiKey;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: ROUTER_SYSTEM_PROMPT }]
          },
          contents: [
            {
              role: "user",
              parts: [{ text: JSON.stringify(payload) }]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            topP: 0.8,
            maxOutputTokens: 512,
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        lastError = `${model}: ${errorText}`;

        if (response.status === 429 || response.status === 503) {
          await sleep(700);
          continue;
        }

        throw new Error(lastError);
      }

      const data = await response.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (err) {
      lastError = err.message;

      if (
        String(err.message).includes("429") ||
        String(err.message).includes("503") ||
        String(err.message).includes("UNAVAILABLE") ||
        String(err.message).includes("RESOURCE_EXHAUSTED")
      ) {
        await sleep(700);
        continue;
      }

      throw err;
    }
  }

  throw new Error("All Gemini classifier models failed: " + lastError);
}
async function callGeminiJson(systemPrompt, payload) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");

  const models = unique([
    process.env.GEMINI_MODEL,
    process.env.GEMINI_TEXT_MODEL,
    "gemini-3.1-flash-lite-preview",
    "gemini-3-flash-preview",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash"
  ]);

  let lastError = "";

  for (const model of models) {
    try {
      const url =
        "https://generativelanguage.googleapis.com/v1beta/models/" +
        model +
        ":generateContent?key=" +
        apiKey;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          contents: [
            {
              role: "user",
              parts: [{ text: JSON.stringify(payload) }]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            topP: 0.9,
            maxOutputTokens: 4096,
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        lastError = `${model}: ${errorText}`;

        if (response.status === 429 || response.status === 503) {
          await sleep(700);
          continue;
        }

        throw new Error(lastError);
      }

      const data = await response.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (err) {
      lastError = err.message;

      if (
        String(err.message).includes("429") ||
        String(err.message).includes("503") ||
        String(err.message).includes("UNAVAILABLE") ||
        String(err.message).includes("RESOURCE_EXHAUSTED")
      ) {
        await sleep(700);
        continue;
      }

      throw err;
    }
  }

  throw new Error("All Gemini JSON models failed: " + lastError);
}
// async function classifySlide(slide) {
//   const payload = {
//     slide_title: slide.title || "",
//     slide_body: slide.body || "",
//     bullet_points: slide.bullets || []
//   };

//   try {
//     const raw = await callGeminiClassifier(payload);
//     const parsed = safeJsonParse(raw);

//     if (parsed.image_type === "FACTUAL" && parsed.search_query) {
//       return { image_type: "FACTUAL", search_query: clean(parsed.search_query) };
//     }

//     if (parsed.image_type === "ABSTRACT" && parsed.image_prompt) {
//       return { image_type: "ABSTRACT", image_prompt: clean(parsed.image_prompt) };
//     }

//     throw new Error("Invalid classifier result: " + raw);
//   } catch (err) {
//     console.warn("[Classifier fallback]", slide.title, "-", err.message);
//     return heuristicRoute(slide);
//   }
// }
async function classifySlide(slide) {
  return heuristicRoute(slide);
}
async function generateSlidesFromTopic({ subject, grade, topic, slidesCount = 7 }) {
  const payload = {
    subject: subject || "Informatika",
    grade: grade || "7-sinf",
    topic: topic || "Mavzu kiritilmagan",
    slides_count: slidesCount
  };

  const raw = await callGeminiJson(SLIDE_PLAN_SYSTEM_PROMPT, payload);
  const parsed = safeJsonParse(raw);

  const slides = normalizeSlides(parsed?.slides || []);

  if (!slides.length) {
    throw new Error("AI slide plan bo‘sh qaytdi");
  }

  return slides;
}
async function downloadTemp(url, ext = "jpg") {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Image download failed: " + url);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const file = path.join(
    os.tmpdir(),
    `slide-img-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  );

  await fs.writeFile(file, buffer);
  return file;
}

async function pexelsImage(query) {
  if (!process.env.PEXELS_API_KEY) {
    throw new Error("PEXELS_API_KEY missing");
  }

  const url =
    "https://api.pexels.com/v1/search?query=" +
    encodeURIComponent(query) +
    "&per_page=1&orientation=landscape";

  const response = await fetch(url, {
    headers: {
      Authorization: process.env.PEXELS_API_KEY
    }
  });

  if (!response.ok) {
    throw new Error("Pexels error: " + await response.text());
  }

  const data = await response.json();
  const photo = data?.photos?.[0];

  if (!photo) {
    throw new Error("No Pexels result");
  }

  const imageUrl = photo.src.large2x || photo.src.large || photo.src.original;

  return {
    kind: "path",
    value: await downloadTemp(imageUrl, "jpg"),
    source: "pexels",
    query
  };
}

async function unsplashImage(query) {
  if (!process.env.UNSPLASH_ACCESS_KEY) {
    throw new Error("UNSPLASH_ACCESS_KEY missing");
  }

  const url =
    "https://api.unsplash.com/search/photos?query=" +
    encodeURIComponent(query) +
    "&per_page=1&orientation=landscape";

  const response = await fetch(url, {
    headers: {
      Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`
    }
  });

  if (!response.ok) {
    throw new Error("Unsplash error: " + await response.text());
  }

  const data = await response.json();
  const photo = data?.results?.[0];

  if (!photo) {
    throw new Error("No Unsplash result");
  }

  const imageUrl = photo.urls.regular || photo.urls.full;

  return {
    kind: "path",
    value: await downloadTemp(imageUrl, "jpg"),
    source: "unsplash",
    query
  };
}

async function factualImage(query) {
  const errors = [];

  if (process.env.PEXELS_API_KEY) {
    try {
      return await pexelsImage(query);
    } catch (err) {
      errors.push("Pexels: " + err.message);
    }
  }

  if (process.env.UNSPLASH_ACCESS_KEY) {
    try {
      return await unsplashImage(query);
    } catch (err) {
      errors.push("Unsplash: " + err.message);
    }
  }

  throw new Error(errors.join(" | ") || "No factual image API key");
}

function extractImagenBase64(data) {
  return (
    data?.predictions?.[0]?.bytesBase64Encoded ||
    data?.predictions?.[0]?.image?.bytesBase64Encoded ||
    data?.predictions?.[0]?.content?.bytesBase64Encoded ||
    data?.images?.[0]?.bytesBase64Encoded ||
    data?.generatedImages?.[0]?.image?.imageBytes ||
    data?.generatedImages?.[0]?.imageBytes ||
    ""
  );
}

async function imagenImage(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY missing");
  }

  const models = unique([
    process.env.IMAGEN_MODEL_FAST || "imagen-4.0-fast-generate-001",
    process.env.IMAGEN_MODEL_STANDARD || "imagen-4.0-generate-001",
    process.env.IMAGEN_MODEL_ULTRA || "imagen-4.0-ultra-generate-001"
  ]);

  let lastError = "";

  for (const model of models) {
    try {
      const url =
        "https://generativelanguage.googleapis.com/v1beta/models/" +
        model +
        ":predict?key=" +
        apiKey;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          instances: [
            {
              prompt
            }
          ],
          parameters: {
            sampleCount: 1,
            aspectRatio: "16:9"
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        lastError = `${model}: ${errorText}`;

        if (response.status === 429 || response.status === 503) {
          console.warn(`[Imagen fallback] ${model} failed, trying next model...`);
          await sleep(700);
          continue;
        }

        throw new Error(lastError);
      }

      const data = await response.json();
      const b64 = extractImagenBase64(data);

      if (!b64) {
        throw new Error(`No image data returned from ${model}`);
      }

      const file = path.join(
        os.tmpdir(),
        `imagen-${Date.now()}-${Math.random().toString(36).slice(2)}.png`
      );

      await fs.writeFile(file, Buffer.from(b64, "base64"));

      return {
        kind: "path",
        value: file,
        source: model,
        prompt
      };
    } catch (err) {
      lastError = err.message;

      if (
        String(err.message).includes("429") ||
        String(err.message).includes("503") ||
        String(err.message).includes("RESOURCE_EXHAUSTED") ||
        String(err.message).includes("UNAVAILABLE") ||
        String(err.message).toLowerCase().includes("quota")
      ) {
        console.warn(`[Imagen fallback] trying next model after failure: ${model}`);
        await sleep(700);
        continue;
      }

      throw err;
    }
  }

  throw new Error("All Imagen models failed: " + lastError);
}

function svgData(slide, mode = "abstract") {
  const factual = mode === "factual";
  const c1 = factual ? "#dbeafe" : "#eef2ff";
  const c2 = factual ? "#67e8f9" : "#a78bfa";
  const c3 = factual ? "#2563eb" : "#22d3ee";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024" viewBox="0 0 1536 1024">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/>
      <stop offset=".55" stop-color="${c2}"/>
      <stop offset="1" stop-color="${c3}"/>
    </linearGradient>
    <filter id="b"><feGaussianBlur stdDeviation="35"/></filter>
  </defs>
  <rect width="1536" height="1024" fill="url(#g)"/>
  <circle cx="280" cy="240" r="170" fill="rgba(255,255,255,.34)" filter="url(#b)"/>
  <circle cx="1200" cy="760" r="260" fill="rgba(255,255,255,.22)" filter="url(#b)"/>
  <rect x="260" y="210" width="1016" height="604" rx="70" fill="rgba(255,255,255,.26)" stroke="rgba(255,255,255,.55)" stroke-width="3"/>
  <path d="M410 655 C560 490,690 560,800 390 C940 170,1090 330,1160 245" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="22" stroke-linecap="round"/>
  <circle cx="410" cy="655" r="38" fill="rgba(255,255,255,.9)"/>
  <circle cx="800" cy="390" r="38" fill="rgba(255,255,255,.9)"/>
  <circle cx="1160" cy="245" r="38" fill="rgba(255,255,255,.9)"/>
  </svg>`;

  return {
    kind: "data",
    value: "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64"),
    source: "local-svg",
    prompt: slide.title || ""
  };
}

async function abstractImage(prompt, slide) {
  try {
    return await imagenImage(prompt);
  } catch (err) {
    console.warn("[Abstract fallback]", slide.title, "-", err.message);
    return svgData(slide, "abstract");
  }
}

function fallbackPrompt(slide) {
  return (
    `Clean modern educational presentation illustration about "${slide.title}", ` +
    `professional EdTech style, wide 16:9 composition, soft gradients, no text`
  );
}

async function resolveImage(slide) {
  const route = await classifySlide(slide);

  if (route.image_type === "FACTUAL") {
    try {
      return { ...route, image: await factualImage(route.search_query) };
    } catch (err) {
      console.warn("[Factual fallback]", slide.title, "-", err.message);
      const prompt = fallbackPrompt(slide);
      return {
        image_type: "ABSTRACT",
        image_prompt: prompt,
        fallback_from: "FACTUAL",
        image: await abstractImage(prompt, slide)
      };
    }
  }

  const prompt = route.image_prompt || fallbackPrompt(slide);

  return {
    ...route,
    image: await abstractImage(prompt, slide)
  };
}

function addImage(slide, img, opts) {
  if (!img) return;

  if (img.kind === "path") {
    slide.addImage({ path: img.value, ...opts });
  }

  if (img.kind === "data") {
    slide.addImage({ data: img.value, ...opts });
  }
}

function addCover(pptx, slides, title) {
  const slide = pptx.addSlide();

  slide.background = { color: "07101D" };

  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: 13.333,
    h: 7.5,
    fill: { color: "07101D" },
    line: { color: "07101D" }
  });

  slide.addShape("arc", {
    x: -1.3,
    y: -1.0,
    w: 5.4,
    h: 5.4,
    fill: { color: "5B7CFF", transparency: 35 },
    line: { color: "5B7CFF", transparency: 100 }
  });

  slide.addShape("arc", {
    x: 9.4,
    y: 4.0,
    w: 5.2,
    h: 5.2,
    fill: { color: "22D3EE", transparency: 35 },
    line: { color: "22D3EE", transparency: 100 }
  });

  slide.addText(title || "O‘qituvchi AI", {
    x: 0.8,
    y: 1.45,
    w: 11.8,
    h: 0.75,
    fontFace: "Aptos Display",
    fontSize: 38,
    bold: true,
    color: "FFFFFF",
    fit: "shrink"
  });

  slide.addText("Hybrid Image Router bilan avtomatik PPTX", {
    x: 0.85,
    y: 2.35,
    w: 11.2,
    h: 0.48,
    fontFace: "Aptos",
    fontSize: 20,
    color: "CFE8FF"
  });

  slide.addText(
    "FAKTIK slaydlar uchun real photo search • ABSTRAKT slaydlar uchun Imagen fallback chain",
    {
      x: 0.85,
      y: 3.05,
      w: 11.2,
      h: 0.38,
      fontFace: "Aptos",
      fontSize: 14,
      color: "A8B5CB"
    }
  );

  slide.addText(`${slides.length} ta slayd`, {
    x: 0.85,
    y: 5.85,
    w: 4.0,
    h: 0.3,
    fontFace: "Aptos",
    fontSize: 14,
    bold: true,
    color: "22D3EE"
  });
}

function addContent(slide, data, routed, idx, total) {
  slide.background = { color: "F8FAFC" };

  slide.addShape("rect", {
    x: 0.35,
    y: 0.22,
    w: 12.63,
    h: 7.06,
    rectRadius: 0.18,
    fill: { color: "FFFFFF" },
    line: { color: "E2E8F0", transparency: 10 }
  });

  slide.addText(data.title || "", {
    x: 0.55,
    y: 0.35,
    w: 12.2,
    h: 0.55,
    fontFace: "Aptos Display",
    fontSize: 25,
    bold: true,
    color: "0F172A",
    fit: "shrink"
  });

  const body = clean(data.body || "");

  if (body) {
    slide.addText(body, {
      x: 0.72,
      y: 1.15,
      w: 5.85,
      h: 1.15,
      fontFace: "Aptos",
      fontSize: 16,
      color: "334155",
      valign: "mid",
      fit: "shrink",
      margin: 0.04
    });
  }

  const bullets = (data.bullets || []).slice(0, 6);

  if (bullets.length) {
    const runs = bullets.map(item => ({
      text: clean(item),
      options: {
        bullet: { type: "bullet" },
        hanging: 4
      }
    }));

    slide.addText(runs, {
      x: 0.85,
      y: body ? 2.55 : 1.3,
      w: 5.65,
      h: body ? 3.25 : 4.45,
      fontFace: "Aptos",
      fontSize: 15,
      color: "1E293B",
      fit: "shrink",
      paraSpaceAfterPt: 8,
      margin: 0.06
    });
  }

  addImage(slide, routed?.image, {
    x: 7.0,
    y: 1.2,
    w: 5.55,
    h: 4.75,
    sizing: {
      type: "cover",
      x: 7.0,
      y: 1.2,
      w: 5.55,
      h: 4.75
    }
  });

  const factual = routed?.image_type === "FACTUAL";

  slide.addShape("rect", {
    x: 7.0,
    y: 6.05,
    w: 5.55,
    h: 0.42,
    rectRadius: 0.08,
    fill: { color: factual ? "DBEAFE" : "F3E8FF" },
    line: { color: factual ? "BFDBFE" : "E9D5FF" }
  });

  slide.addText(
    factual
      ? `FACTUAL • ${routed.search_query || ""}`
      : `ABSTRACT • ${routed?.image?.source || "generated / fallback"}`,
    {
      x: 7.15,
      y: 6.16,
      w: 5.25,
      h: 0.18,
      fontFace: "Aptos",
      fontSize: 8,
      color: factual ? "1D4ED8" : "7E22CE",
      fit: "shrink"
    }
  );

  slide.addText(`O‘qituvchi AI • ${idx}/${total}`, {
    x: 0.55,
    y: 7.05,
    w: 12.2,
    h: 0.25,
    fontFace: "Aptos",
    fontSize: 9,
    color: "64748B",
    align: "right"
  });
}
// const THEMES = [
//   { bg: "0F172A", accent: "0EA5E9", accent2: "38BDF8", text: "FFFFFF", sub: "94A3B8", card: "1E293B" },
//   { bg: "0D1F12", accent: "22C55E", accent2: "86EFAC", text: "FFFFFF", sub: "86EFAC", card: "14532D" },
//   { bg: "1A0A2E", accent: "A855F7", accent2: "D8B4FE", text: "FFFFFF", sub: "C4B5FD", card: "2D1B69" },
//   { bg: "1C0A00", accent: "F97316", accent2: "FED7AA", text: "FFFFFF", sub: "FED7AA", card: "431407" },
//   { bg: "0A1628", accent: "06B6D4", accent2: "67E8F9", text: "FFFFFF", sub: "A5F3FC", card: "164E63" },
// ];
// function getTheme(index) { return THEMES[index % THEMES.length]; }
// function addCoverSlide(pres, title, subject, grade) {
//   const T = THEMES[0]; const s = pres.addSlide(); s.background = { color: T.bg };
//   s.addShape(pres.shapes.RECTANGLE, { x: 6.5, y: 0, w: 3.5, h: 5.625, fill: { color: T.card }, line: { color: T.card } });
//   s.addShape(pres.shapes.RECTANGLE, { x: 6.5, y: 0, w: 0.12, h: 5.625, fill: { color: T.accent }, line: { color: T.accent } });
//   s.addShape(pres.shapes.OVAL, { x: 7.2, y: 0.3, w: 2.2, h: 2.2, fill: { color: T.accent, transparency: 85 }, line: { color: T.accent, transparency: 70 } });
//   s.addShape(pres.shapes.OVAL, { x: 7.8, y: 2.8, w: 1.4, h: 1.4, fill: { color: T.accent2, transparency: 80 }, line: { color: T.accent2, transparency: 60 } });
//   s.addText("TAQDIMOT", { x: 6.6, y: 0.35, w: 3.2, h: 0.4, fontSize: 10, color: T.accent, bold: true, charSpacing: 4, align: "center" });
//   s.addText(subject || "Fan", { x: 6.6, y: 0.85, w: 3.2, h: 0.4, fontSize: 13, color: T.text, align: "center" });
//   s.addText(grade || "", { x: 6.6, y: 1.25, w: 3.2, h: 0.35, fontSize: 12, color: T.sub, align: "center" });
//   s.addText(title, { x: 0.45, y: 1.4, w: 5.8, h: 2.4, fontSize: 36, color: T.text, bold: true, align: "left", valign: "middle" });
//   s.addShape(pres.shapes.RECTANGLE, { x: 0.45, y: 4.6, w: 5.8, h: 0.06, fill: { color: T.accent }, line: { color: T.accent } });
//   s.addText("O'qituvchi AI  ·  aiuqituvchi.vercel.app", { x: 0.45, y: 4.75, w: 5.8, h: 0.4, fontSize: 10, color: T.sub, align: "left" });
// }
// function addSideAccentSlide(pres, slide, themeIdx) {
//   const T = getTheme(themeIdx); const s = pres.addSlide(); s.background = { color: T.bg };
//   s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.5, h: 5.625, fill: { color: T.accent }, line: { color: T.accent } });
//   s.addShape(pres.shapes.OVAL, { x: 0.05, y: 0.2, w: 0.4, h: 0.4, fill: { color: T.bg }, line: { color: T.bg } });
//   s.addText(String(themeIdx), { x: 0.05, y: 0.2, w: 0.4, h: 0.4, fontSize: 11, color: T.accent, bold: true, align: "center", valign: "middle" });
//   s.addText(slide.title, { x: 0.7, y: 0.3, w: 9.0, h: 0.75, fontSize: 26, color: T.text, bold: true, align: "left" });
//   s.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: 1.1, w: 2.5, h: 0.05, fill: { color: T.accent }, line: { color: T.accent } });
//   if (slide.body) s.addText(slide.body, { x: 0.7, y: 1.25, w: 9.0, h: 0.75, fontSize: 13, color: T.sub, align: "left" });
//   (slide.bullets || []).slice(0, 4).forEach((b, i) => {
//     const y = 2.1 + i * 0.85;
//     s.addShape(pres.shapes.RECTANGLE, { x: 0.7, y, w: 9.0, h: 0.72, fill: { color: T.card }, line: { color: T.accent, transparency: 70 }, shadow: { type: "outer", blur: 5, offset: 2, angle: 135, color: "000000", opacity: 0.15 } });
//     s.addShape(pres.shapes.RECTANGLE, { x: 0.7, y, w: 0.06, h: 0.72, fill: { color: T.accent }, line: { color: T.accent } });
//     s.addText(b, { x: 0.9, y: y + 0.05, w: 8.7, h: 0.62, fontSize: 13, color: T.text, align: "left", valign: "middle" });
//   });
// }
// function addGridSlide(pres, slide, themeIdx) {
//   const T = getTheme(themeIdx); const s = pres.addSlide(); s.background = { color: T.bg };
//   s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.65, fill: { color: T.card }, line: { color: T.card } });
//   s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0.62, w: 10, h: 0.04, fill: { color: T.accent }, line: { color: T.accent } });
//   s.addText(slide.title, { x: 0.4, y: 0.08, w: 9.2, h: 0.5, fontSize: 20, color: T.text, bold: true, align: "left", valign: "middle" });
//   if (slide.body) s.addText(slide.body, { x: 0.4, y: 0.78, w: 9.2, h: 0.5, fontSize: 12, color: T.sub, align: "left" });
//   const bullets = slide.bullets || []; const cols = bullets.length <= 2 ? 2 : 3; const cardW = bullets.length <= 2 ? 4.5 : 2.9;
//   bullets.slice(0, 6).forEach((b, i) => {
//     const col = i % cols; const row = Math.floor(i / cols); const x = 0.35 + col * (cardW + 0.15); const y = 1.4 + row * 1.85;
//     s.addShape(pres.shapes.RECTANGLE, { x, y, w: cardW, h: 1.65, fill: { color: T.card }, line: { color: T.accent, transparency: 75 }, shadow: { type: "outer", blur: 6, offset: 2, angle: 135, color: "000000", opacity: 0.18 } });
//     s.addShape(pres.shapes.RECTANGLE, { x, y, w: cardW, h: 0.06, fill: { color: T.accent }, line: { color: T.accent } });
//     s.addShape(pres.shapes.OVAL, { x: x + cardW - 0.55, y: y + 0.12, w: 0.38, h: 0.38, fill: { color: T.accent, transparency: 80 }, line: { color: T.accent, transparency: 60 } });
//     s.addText(String(i + 1), { x: x + cardW - 0.55, y: y + 0.12, w: 0.38, h: 0.38, fontSize: 11, color: T.accent, bold: true, align: "center", valign: "middle" });
//     s.addText(b, { x: x + 0.15, y: y + 0.2, w: cardW - 0.7, h: 1.3, fontSize: 12, color: T.text, align: "left", valign: "middle" });
//   });
// }
// function addTwoColumnSlide(pres, slide, themeIdx) {
//   const T = getTheme(themeIdx); const s = pres.addSlide(); s.background = { color: T.bg };
//   s.addShape(pres.shapes.RECTANGLE, { x: 5.1, y: 0, w: 4.9, h: 5.625, fill: { color: T.card }, line: { color: T.card } });
//   s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.08, fill: { color: T.accent }, line: { color: T.accent } });
//   s.addText(`0${themeIdx}`, { x: 5.2, y: 0.2, w: 4.5, h: 0.5, fontSize: 32, color: T.accent, bold: true, align: "right", transparency: 70 });
//   s.addText(slide.title, { x: 0.4, y: 0.3, w: 4.5, h: 1.2, fontSize: 24, color: T.text, bold: true, align: "left", valign: "middle" });
//   if (slide.body) s.addText(slide.body, { x: 0.4, y: 1.6, w: 4.5, h: 1.2, fontSize: 12, color: T.sub, align: "left" });
//   s.addShape(pres.shapes.RECTANGLE, { x: 0.4, y: 4.9, w: 1.5, h: 0.06, fill: { color: T.accent }, line: { color: T.accent } });
//   (slide.bullets || []).slice(0, 5).forEach((b, i) => {
//     const y = 0.85 + i * 0.92;
//     s.addShape(pres.shapes.RECTANGLE, { x: 5.25, y, w: 4.4, h: 0.78, fill: { color: T.bg }, line: { color: T.accent, transparency: 80 }, shadow: { type: "outer", blur: 4, offset: 1, angle: 135, color: "000000", opacity: 0.12 } });
//     s.addText(`${i + 1}`, { x: 5.25, y, w: 0.55, h: 0.78, fontSize: 18, color: T.accent, bold: true, align: "center", valign: "middle" });
//     s.addShape(pres.shapes.LINE, { x: 5.8, y: y + 0.15, w: 0, h: 0.48, line: { color: T.accent, width: 1, transparency: 60 } });
//     s.addText(b, { x: 5.9, y: y + 0.05, w: 3.65, h: 0.68, fontSize: 12, color: T.text, align: "left", valign: "middle" });
//   });
// }
// function addStatSlide(pres, slide, themeIdx) {
//   const T = getTheme(themeIdx); const s = pres.addSlide(); s.background = { color: T.bg };
//   s.addText(String(themeIdx).padStart(2, "0"), { x: 5.5, y: 0.5, w: 4.2, h: 4.5, fontSize: 180, color: T.card, bold: true, align: "center", valign: "middle" });
//   s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.1, h: 5.625, fill: { color: T.accent }, line: { color: T.accent } });
//   s.addText(slide.title, { x: 0.3, y: 0.4, w: 5.5, h: 1.0, fontSize: 28, color: T.text, bold: true, align: "left" });
//   s.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 1.45, w: 2.0, h: 0.05, fill: { color: T.accent }, line: { color: T.accent } });
//   if (slide.body) s.addText(slide.body, { x: 0.3, y: 1.6, w: 5.3, h: 0.8, fontSize: 13, color: T.sub, align: "left" });
//   (slide.bullets || []).slice(0, 4).forEach((b, i) => {
//     s.addText(`→  ${b}`, { x: 0.3, y: 2.55 + i * 0.72, w: 5.3, h: 0.62, fontSize: 13, color: T.text, align: "left" });
//     s.addShape(pres.shapes.LINE, { x: 0.3, y: 2.55 + i * 0.72 + 0.62, w: 5.0, h: 0, line: { color: T.card, width: 1 } });
//   });
// }
// function addSummarySlide(pres, slide) {
//   const T = THEMES[0]; const s = pres.addSlide(); s.background = { color: T.bg };
//   s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 5.625, fill: { color: T.card }, line: { color: T.card } });
//   s.addShape(pres.shapes.OVAL, { x: 3.5, y: 0.8, w: 3.0, h: 3.0, fill: { color: T.accent, transparency: 92 }, line: { color: T.accent, transparency: 75 } });
//   s.addShape(pres.shapes.OVAL, { x: 4.0, y: 1.3, w: 2.0, h: 2.0, fill: { color: T.accent, transparency: 85 }, line: { color: T.accent, transparency: 65 } });
//   s.addText("XULOSA", { x: 0.5, y: 0.5, w: 9, h: 0.5, fontSize: 11, color: T.accent, bold: true, charSpacing: 4, align: "center" });
//   s.addText(slide.title, { x: 0.5, y: 1.1, w: 9, h: 1.2, fontSize: 30, color: T.text, bold: true, align: "center", valign: "middle" });
//   (slide.bullets || []).slice(0, 3).forEach((b, i) => {
//     s.addShape(pres.shapes.RECTANGLE, { x: 1.0, y: 2.5 + i * 0.72, w: 8.0, h: 0.6, fill: { color: T.bg }, line: { color: T.accent, transparency: 70 }, shadow: { type: "outer", blur: 5, offset: 2, angle: 135, color: "000000", opacity: 0.15 } });
//     s.addText(`✓  ${b}`, { x: 1.1, y: 2.5 + i * 0.72, w: 7.8, h: 0.6, fontSize: 13, color: T.text, align: "left", valign: "middle" });
//   });
//   s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.2, w: 10, h: 0.425, fill: { color: T.accent }, line: { color: T.accent } });
//   s.addText("O'qituvchi AI  ·  aiuqituvchi.vercel.app", { x: 0, y: 5.2, w: 10, h: 0.425, fontSize: 11, color: T.bg, bold: true, align: "center", valign: "middle" });
// }

// async function createPresentation(slides, title) {
//   const pptx = new PptxGenJS();

//   pptx.layout = "LAYOUT_WIDE";
//   pptx.author = "O‘qituvchi AI";
//   pptx.subject = "Hybrid PPTX Image Router";
//   pptx.title = title || "Generated Presentation";
//   pptx.company = "O‘qituvchi AI";
//   pptx.lang = "uz-UZ";
//   pptx.theme = {
//     headFontFace: "Aptos Display",
//     bodyFontFace: "Aptos",
//     lang: "uz-UZ"
//   };

//   addCover(pptx, slides, title);

//   for (let i = 0; i < slides.length; i++) {
//     const slideData = slides[i];
//     const routed = await resolveImage(slideData);
//     const slide = pptx.addSlide();
//     addContent(slide, slideData, routed, i + 1, slides.length);
//   }

//   const buffer = await pptx.write({ outputType: "nodebuffer" });
//   return buffer;
// }
// const THEMES = [
//   { bg: "0F172A", accent: "0EA5E9", accent2: "38BDF8", text: "FFFFFF", sub: "94A3B8", card: "1E293B" },
//   { bg: "0D1F12", accent: "22C55E", accent2: "86EFAC", text: "FFFFFF", sub: "86EFAC", card: "14532D" },
//   { bg: "1A0A2E", accent: "A855F7", accent2: "D8B4FE", text: "FFFFFF", sub: "C4B5FD", card: "2D1B69" },
//   { bg: "1C0A00", accent: "F97316", accent2: "FED7AA", text: "FFFFFF", sub: "FED7AA", card: "431407" },
//   { bg: "0A1628", accent: "06B6D4", accent2: "67E8F9", text: "FFFFFF", sub: "A5F3FC", card: "164E63" },
// ];
// function getTheme(i) { return THEMES[i % THEMES.length]; }

// function addCoverSlide(pres, title, subject, grade) {
//   const T = THEMES[0]; const s = pres.addSlide(); s.background = { color: T.bg };
//   s.addShape(pres.shapes.RECTANGLE, { x: 8.8, y: 0, w: 4.53, h: 7.5, fill: { color: T.card }, line: { color: T.card } });
//   s.addShape(pres.shapes.RECTANGLE, { x: 8.8, y: 0, w: 0.15, h: 7.5, fill: { color: T.accent }, line: { color: T.accent } });
//   s.addShape(pres.shapes.OVAL, { x: 9.6, y: 0.4, w: 2.8, h: 2.8, fill: { color: T.accent, transparency: 85 }, line: { color: T.accent, transparency: 70 } });
//   s.addShape(pres.shapes.OVAL, { x: 10.5, y: 3.8, w: 1.8, h: 1.8, fill: { color: T.accent2, transparency: 80 }, line: { color: T.accent2, transparency: 60 } });
//   s.addText("TAQDIMOT", { x: 8.95, y: 0.5, w: 4.2, h: 0.45, fontSize: 11, color: T.accent, bold: true, charSpacing: 4, align: "center" });
//   s.addText(subject || "Fan", { x: 8.95, y: 1.1, w: 4.2, h: 0.45, fontSize: 14, color: T.text, align: "center" });
//   s.addText(grade || "", { x: 8.95, y: 1.6, w: 4.2, h: 0.4, fontSize: 13, color: T.sub, align: "center" });
//   s.addText(title, { x: 0.6, y: 1.8, w: 7.9, h: 3.2, fontSize: 44, color: T.text, bold: true, align: "left", valign: "middle" });
//   s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 6.1, w: 7.9, h: 0.07, fill: { color: T.accent }, line: { color: T.accent } });
//   s.addText("O'qituvchi AI  ·  aiuqituvchi.vercel.app", { x: 0.6, y: 6.25, w: 7.9, h: 0.4, fontSize: 11, color: T.sub, align: "left" });
// }

// function addSideAccentSlide(pres, slide, themeIdx) {
//   const T = getTheme(themeIdx); const s = pres.addSlide(); s.background = { color: T.bg };
//   s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.6, h: 7.5, fill: { color: T.accent }, line: { color: T.accent } });
//   s.addText(String(themeIdx), { x: 0.05, y: 0.25, w: 0.5, h: 0.5, fontSize: 12, color: T.bg, bold: true, align: "center", valign: "middle" });
//   s.addText(slide.title, { x: 0.9, y: 0.35, w: 12.0, h: 0.9, fontSize: 30, color: T.text, bold: true, align: "left" });
//   s.addShape(pres.shapes.RECTANGLE, { x: 0.9, y: 1.35, w: 3.2, h: 0.06, fill: { color: T.accent }, line: { color: T.accent } });
//   if (slide.body) s.addText(slide.body, { x: 0.9, y: 1.55, w: 12.0, h: 0.8, fontSize: 14, color: T.sub, align: "left" });
//   (slide.bullets || []).slice(0, 4).forEach((b, i) => {
//     const y = 2.55 + i * 1.1;
//     s.addShape(pres.shapes.RECTANGLE, { x: 0.9, y, w: 12.0, h: 0.92, fill: { color: T.card }, line: { color: T.accent, transparency: 70 }, shadow: { type: "outer", blur: 5, offset: 2, angle: 135, color: "000000", opacity: 0.15 } });
//     s.addShape(pres.shapes.RECTANGLE, { x: 0.9, y, w: 0.07, h: 0.92, fill: { color: T.accent }, line: { color: T.accent } });
//     s.addText(b, { x: 1.15, y: y + 0.05, w: 11.6, h: 0.82, fontSize: 14, color: T.text, align: "left", valign: "middle" });
//   });
// }

// function addGridSlide(pres, slide, themeIdx) {
//   const T = getTheme(themeIdx); const s = pres.addSlide(); s.background = { color: T.bg };
//   s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 0.8, fill: { color: T.card }, line: { color: T.card } });
//   s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0.78, w: 13.333, h: 0.05, fill: { color: T.accent }, line: { color: T.accent } });
//   s.addText(slide.title, { x: 0.5, y: 0.1, w: 12.3, h: 0.6, fontSize: 22, color: T.text, bold: true, align: "left", valign: "middle" });
//   if (slide.body) s.addText(slide.body, { x: 0.5, y: 0.95, w: 12.3, h: 0.55, fontSize: 13, color: T.sub, align: "left" });
//   const bullets = slide.bullets || []; const cols = bullets.length <= 2 ? 2 : 3; const cardW = bullets.length <= 2 ? 6.0 : 3.9;
//   bullets.slice(0, 6).forEach((b, i) => {
//     const col = i % cols; const row = Math.floor(i / cols);
//     const x = 0.45 + col * (cardW + 0.2); const y = 1.65 + row * 2.5;
//     s.addShape(pres.shapes.RECTANGLE, { x, y, w: cardW, h: 2.2, fill: { color: T.card }, line: { color: T.accent, transparency: 75 }, shadow: { type: "outer", blur: 6, offset: 2, angle: 135, color: "000000", opacity: 0.18 } });
//     s.addShape(pres.shapes.RECTANGLE, { x, y, w: cardW, h: 0.07, fill: { color: T.accent }, line: { color: T.accent } });
//     s.addShape(pres.shapes.OVAL, { x: x + cardW - 0.68, y: y + 0.15, w: 0.48, h: 0.48, fill: { color: T.accent, transparency: 80 }, line: { color: T.accent, transparency: 60 } });
//     s.addText(String(i + 1), { x: x + cardW - 0.68, y: y + 0.15, w: 0.48, h: 0.48, fontSize: 13, color: T.accent, bold: true, align: "center", valign: "middle" });
//     s.addText(b, { x: x + 0.2, y: y + 0.25, w: cardW - 0.95, h: 1.8, fontSize: 13, color: T.text, align: "left", valign: "middle" });
//   });
// }

// function addTwoColumnSlide(pres, slide, themeIdx) {
//   const T = getTheme(themeIdx); const s = pres.addSlide(); s.background = { color: T.bg };
//   s.addShape(pres.shapes.RECTANGLE, { x: 6.8, y: 0, w: 6.53, h: 7.5, fill: { color: T.card }, line: { color: T.card } });
//   s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 0.1, fill: { color: T.accent }, line: { color: T.accent } });
//   s.addText(`0${themeIdx}`, { x: 6.9, y: 0.25, w: 6.2, h: 0.65, fontSize: 40, color: T.accent, bold: true, align: "right", transparency: 70 });
//   s.addText(slide.title, { x: 0.5, y: 0.4, w: 6.0, h: 1.5, fontSize: 28, color: T.text, bold: true, align: "left", valign: "middle" });
//   if (slide.body) s.addText(slide.body, { x: 0.5, y: 2.1, w: 6.0, h: 1.5, fontSize: 13, color: T.sub, align: "left" });
//   s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 6.8, w: 2.0, h: 0.07, fill: { color: T.accent }, line: { color: T.accent } });
//   (slide.bullets || []).slice(0, 5).forEach((b, i) => {
//     const y = 1.1 + i * 1.22;
//     s.addShape(pres.shapes.RECTANGLE, { x: 7.0, y, w: 5.9, h: 1.02, fill: { color: T.bg }, line: { color: T.accent, transparency: 80 }, shadow: { type: "outer", blur: 4, offset: 1, angle: 135, color: "000000", opacity: 0.12 } });
//     s.addText(`${i + 1}`, { x: 7.0, y, w: 0.7, h: 1.02, fontSize: 20, color: T.accent, bold: true, align: "center", valign: "middle" });
//     s.addShape(pres.shapes.LINE, { x: 7.7, y: y + 0.2, w: 0, h: 0.62, line: { color: T.accent, width: 1, transparency: 60 } });
//     s.addText(b, { x: 7.85, y: y + 0.06, w: 4.9, h: 0.9, fontSize: 13, color: T.text, align: "left", valign: "middle" });
//   });
// }

// function addStatSlide(pres, slide, themeIdx) {
//   const T = getTheme(themeIdx); const s = pres.addSlide(); s.background = { color: T.bg };
//   s.addText(String(themeIdx).padStart(2, "0"), { x: 7.0, y: 0.5, w: 5.8, h: 6.0, fontSize: 220, color: T.card, bold: true, align: "center", valign: "middle" });
//   s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.12, h: 7.5, fill: { color: T.accent }, line: { color: T.accent } });
//   s.addText(slide.title, { x: 0.4, y: 0.5, w: 7.2, h: 1.2, fontSize: 32, color: T.text, bold: true, align: "left" });
//   s.addShape(pres.shapes.RECTANGLE, { x: 0.4, y: 1.85, w: 2.6, h: 0.06, fill: { color: T.accent }, line: { color: T.accent } });
//   if (slide.body) s.addText(slide.body, { x: 0.4, y: 2.1, w: 7.0, h: 1.0, fontSize: 14, color: T.sub, align: "left" });
//   (slide.bullets || []).slice(0, 4).forEach((b, i) => {
//     s.addText(`→  ${b}`, { x: 0.4, y: 3.3 + i * 0.95, w: 7.0, h: 0.8, fontSize: 14, color: T.text, align: "left" });
//     s.addShape(pres.shapes.LINE, { x: 0.4, y: 3.3 + i * 0.95 + 0.8, w: 6.6, h: 0, line: { color: T.card, width: 1 } });
//   });
// }

// function addSummarySlide(pres, slide) {
//   const T = THEMES[0]; const s = pres.addSlide(); s.background = { color: T.bg };
//   s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: T.card }, line: { color: T.card } });
//   s.addShape(pres.shapes.OVAL, { x: 4.7, y: 0.8, w: 4.0, h: 4.0, fill: { color: T.accent, transparency: 92 }, line: { color: T.accent, transparency: 75 } });
//   s.addShape(pres.shapes.OVAL, { x: 5.4, y: 1.5, w: 2.5, h: 2.5, fill: { color: T.accent, transparency: 85 }, line: { color: T.accent, transparency: 65 } });
//   s.addText("XULOSA", { x: 0.6, y: 0.6, w: 12.1, h: 0.55, fontSize: 12, color: T.accent, bold: true, charSpacing: 4, align: "center" });
//   s.addText(slide.title, { x: 0.6, y: 1.3, w: 12.1, h: 1.5, fontSize: 34, color: T.text, bold: true, align: "center", valign: "middle" });
//   (slide.bullets || []).slice(0, 3).forEach((b, i) => {
//     s.addShape(pres.shapes.RECTANGLE, { x: 1.5, y: 3.2 + i * 1.0, w: 10.3, h: 0.82, fill: { color: T.bg }, line: { color: T.accent, transparency: 70 }, shadow: { type: "outer", blur: 5, offset: 2, angle: 135, color: "000000", opacity: 0.15 } });
//     s.addText(`✓  ${b}`, { x: 1.65, y: 3.2 + i * 1.0, w: 10.0, h: 0.82, fontSize: 14, color: T.text, align: "left", valign: "middle" });
//   });
//   s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 6.9, w: 13.333, h: 0.6, fill: { color: T.accent }, line: { color: T.accent } });
//   s.addText("O'qituvchi AI  ·  aiuqituvchi.vercel.app", { x: 0, y: 6.9, w: 13.333, h: 0.6, fontSize: 13, color: T.bg, bold: true, align: "center", valign: "middle" });
// }

// async function createPresentation(slides, title, subject, grade) {
//   const pres = new PptxGenJS();
//   pres.layout = "LAYOUT_WIDE";
//   pres.title = title || "Taqdimot";

//   addCoverSlide(pres, title, subject, grade);

//   const layouts = [
//     addSideAccentSlide, addGridSlide, addTwoColumnSlide,
//     addStatSlide, addSideAccentSlide, addGridSlide, addTwoColumnSlide,
//   ];

//   slides.forEach((slide, i) => {
//     if (i === slides.length - 1) {
//       addSummarySlide(pres, slide);
//     } else {
//       layouts[i % layouts.length](pres, slide, (i % THEMES.length) + 1);
//     }
//   });

//   return await pres.write({ outputType: "nodebuffer" });
// }
const THEMES = [
  { bg: "0F172A", accent: "0EA5E9", accent2: "38BDF8", text: "FFFFFF", sub: "94A3B8", card: "1E293B" },
  { bg: "0D1F12", accent: "22C55E", accent2: "86EFAC", text: "FFFFFF", sub: "86EFAC", card: "14532D" },
  { bg: "1A0A2E", accent: "A855F7", accent2: "D8B4FE", text: "FFFFFF", sub: "C4B5FD", card: "2D1B69" },
  { bg: "1C0A00", accent: "F97316", accent2: "FED7AA", text: "FFFFFF", sub: "FED7AA", card: "431407" },
  { bg: "0A1628", accent: "06B6D4", accent2: "67E8F9", text: "FFFFFF", sub: "A5F3FC", card: "164E63" },
];
function getTheme(i) { return THEMES[i % THEMES.length]; }

function addCoverSlide(pres, title, subject, grade) {
  const T = THEMES[0]; const s = pres.addSlide(); s.background = { color: T.bg };
  s.addShape(pres.shapes.RECTANGLE, { x: 8.8, y: 0, w: 4.53, h: 7.5, fill: { color: T.card }, line: { color: T.card } });
  s.addShape(pres.shapes.RECTANGLE, { x: 8.8, y: 0, w: 0.15, h: 7.5, fill: { color: T.accent }, line: { color: T.accent } });
  s.addShape(pres.shapes.OVAL, { x: 9.6, y: 0.4, w: 2.8, h: 2.8, fill: { color: T.accent, transparency: 85 }, line: { color: T.accent, transparency: 70 } });
  s.addShape(pres.shapes.OVAL, { x: 10.5, y: 3.8, w: 1.8, h: 1.8, fill: { color: T.accent2, transparency: 80 }, line: { color: T.accent2, transparency: 60 } });
  s.addText("TAQDIMOT", { x: 8.95, y: 0.5, w: 4.2, h: 0.45, fontSize: 11, color: T.accent, bold: true, charSpacing: 4, align: "center" });
  s.addText(subject || "Fan", { x: 8.95, y: 1.1, w: 4.2, h: 0.45, fontSize: 14, color: T.text, align: "center" });
  s.addText(grade || "", { x: 8.95, y: 1.6, w: 4.2, h: 0.4, fontSize: 13, color: T.sub, align: "center" });
  s.addText(title, { x: 0.6, y: 1.8, w: 7.9, h: 3.2, fontSize: 44, color: T.text, bold: true, align: "left", valign: "middle" });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 6.1, w: 7.9, h: 0.07, fill: { color: T.accent }, line: { color: T.accent } });
  s.addText("O'qituvchi AI  ·  aiuqituvchi.vercel.app", { x: 0.6, y: 6.25, w: 7.9, h: 0.4, fontSize: 11, color: T.sub, align: "left" });
}

// Layout 1: Chap — matn, O'ng — rasm
function addSideAccentSlide(pres, slide, themeIdx, img) {
  const T = getTheme(themeIdx); const s = pres.addSlide(); s.background = { color: T.bg };
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.6, h: 7.5, fill: { color: T.accent }, line: { color: T.accent } });
  s.addText(String(themeIdx), { x: 0.05, y: 0.25, w: 0.5, h: 0.5, fontSize: 12, color: T.bg, bold: true, align: "center", valign: "middle" });

  // Rasm o'ng tomonda
  s.addShape(pres.shapes.RECTANGLE, { x: 7.2, y: 0, w: 6.13, h: 7.5, fill: { color: T.card }, line: { color: T.card } });
  if (img) {
    addImage(s, img, { x: 7.2, y: 0, w: 6.13, h: 7.5, sizing: { type: "cover", w: 6.13, h: 7.5 } });
    // Rasmni qoplaydigan gradient overlay
    s.addShape(pres.shapes.RECTANGLE, { x: 7.2, y: 0, w: 6.13, h: 7.5, fill: { color: T.bg, transparency: 40 }, line: { color: T.bg, transparency: 100 } });
  }
  s.addShape(pres.shapes.RECTANGLE, { x: 7.2, y: 0, w: 0.08, h: 7.5, fill: { color: T.accent, transparency: 50 }, line: { color: T.accent, transparency: 50 } });

  // Chap matn qismi
  s.addText(slide.title, { x: 0.9, y: 0.35, w: 6.0, h: 0.9, fontSize: 28, color: T.text, bold: true, align: "left" });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.9, y: 1.35, w: 3.0, h: 0.06, fill: { color: T.accent }, line: { color: T.accent } });
  if (slide.body) s.addText(slide.body, { x: 0.9, y: 1.55, w: 6.0, h: 0.75, fontSize: 13, color: T.sub, align: "left" });
  (slide.bullets || []).slice(0, 4).forEach((b, i) => {
    const y = 2.5 + i * 1.15;
    s.addShape(pres.shapes.RECTANGLE, { x: 0.9, y, w: 6.0, h: 0.95, fill: { color: T.card }, line: { color: T.accent, transparency: 70 }, shadow: { type: "outer", blur: 5, offset: 2, angle: 135, color: "000000", opacity: 0.15 } });
    s.addShape(pres.shapes.RECTANGLE, { x: 0.9, y, w: 0.07, h: 0.95, fill: { color: T.accent }, line: { color: T.accent } });
    s.addText(b, { x: 1.15, y: y + 0.05, w: 5.6, h: 0.85, fontSize: 13, color: T.text, align: "left", valign: "middle" });
  });
}

// Layout 2: Yuqori — rasm, Pastda — grid kartalar
function addGridSlide(pres, slide, themeIdx, img) {
  const T = getTheme(themeIdx); const s = pres.addSlide(); s.background = { color: T.bg };

  // Yuqori rasm paneli
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 3.2, fill: { color: T.card }, line: { color: T.card } });
  if (img) {
    addImage(s, img, { x: 0, y: 0, w: 13.333, h: 3.2, sizing: { type: "cover", w: 13.333, h: 3.2 } });
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 3.2, fill: { color: T.bg, transparency: 45 }, line: { color: T.bg, transparency: 100 } });
  }
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 0.08, fill: { color: T.accent }, line: { color: T.accent } });
  s.addText(slide.title, { x: 0.5, y: 0.2, w: 12.3, h: 0.85, fontSize: 26, color: T.text, bold: true, align: "left", valign: "middle" });
  if (slide.body) s.addText(slide.body, { x: 0.5, y: 1.2, w: 12.3, h: 0.7, fontSize: 13, color: T.sub, align: "left" });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 3.18, w: 13.333, h: 0.06, fill: { color: T.accent }, line: { color: T.accent } });

  // Pastki grid kartalar
  const bullets = slide.bullets || [];
  const cols = bullets.length <= 2 ? 2 : 3;
  const cardW = bullets.length <= 2 ? 6.3 : 4.1;
  bullets.slice(0, 6).forEach((b, i) => {
    const col = i % cols; const row = Math.floor(i / cols);
    const x = 0.3 + col * (cardW + 0.2); const y = 3.38 + row * 2.0;
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cardW, h: 1.75, fill: { color: T.card }, line: { color: T.accent, transparency: 75 }, shadow: { type: "outer", blur: 5, offset: 2, angle: 135, color: "000000", opacity: 0.15 } });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cardW, h: 0.06, fill: { color: T.accent }, line: { color: T.accent } });
    s.addText(String(i + 1), { x: x + 0.15, y: y + 0.15, w: 0.5, h: 0.5, fontSize: 16, color: T.accent, bold: true, align: "center", valign: "middle" });
    s.addText(b, { x: x + 0.75, y: y + 0.15, w: cardW - 0.95, h: 1.45, fontSize: 13, color: T.text, align: "left", valign: "middle" });
  });
}

// Layout 3: Chap — rasm, O'ng — raqamlangan bullets
function addTwoColumnSlide(pres, slide, themeIdx, img) {
  const T = getTheme(themeIdx); const s = pres.addSlide(); s.background = { color: T.bg };
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 0.1, fill: { color: T.accent }, line: { color: T.accent } });

  // Chap rasm paneli
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0.1, w: 6.3, h: 7.4, fill: { color: T.card }, line: { color: T.card } });
  if (img) {
    addImage(s, img, { x: 0, y: 0.1, w: 6.3, h: 7.4, sizing: { type: "cover", w: 6.3, h: 7.4 } });
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0.1, w: 6.3, h: 7.4, fill: { color: T.bg, transparency: 35 }, line: { color: T.bg, transparency: 100 } });
  }
  // Rasmda sarlavha
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.8, w: 6.3, h: 1.7, fill: { color: T.bg, transparency: 25 }, line: { color: T.bg, transparency: 100 } });
  s.addText(slide.title, { x: 0.3, y: 5.9, w: 5.7, h: 1.4, fontSize: 24, color: T.text, bold: true, align: "left", valign: "middle" });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 5.88, w: 2.0, h: 0.06, fill: { color: T.accent }, line: { color: T.accent } });

  // O'ng bullets
  s.addText(`0${themeIdx}`, { x: 6.5, y: 0.2, w: 6.6, h: 0.7, fontSize: 42, color: T.accent, bold: true, align: "right", transparency: 70 });
  if (slide.body) s.addText(slide.body, { x: 6.5, y: 1.1, w: 6.6, h: 0.6, fontSize: 13, color: T.sub, align: "left" });
  (slide.bullets || []).slice(0, 5).forEach((b, i) => {
    const y = 1.85 + i * 1.1;
    s.addShape(pres.shapes.RECTANGLE, { x: 6.5, y, w: 6.5, h: 0.92, fill: { color: T.card }, line: { color: T.accent, transparency: 80 }, shadow: { type: "outer", blur: 4, offset: 1, angle: 135, color: "000000", opacity: 0.12 } });
    s.addText(`${i + 1}`, { x: 6.5, y, w: 0.72, h: 0.92, fontSize: 20, color: T.accent, bold: true, align: "center", valign: "middle" });
    s.addShape(pres.shapes.LINE, { x: 7.22, y: y + 0.18, w: 0, h: 0.56, line: { color: T.accent, width: 1, transparency: 60 } });
    s.addText(b, { x: 7.4, y: y + 0.06, w: 5.4, h: 0.8, fontSize: 13, color: T.text, align: "left", valign: "middle" });
  });
}

// Layout 4: Rasm fon sifatida, matn ustida
function addStatSlide(pres, slide, themeIdx, img) {
  const T = getTheme(themeIdx); const s = pres.addSlide(); s.background = { color: T.bg };

  // To'liq fon rasm
  if (img) {
    addImage(s, img, { x: 0, y: 0, w: 13.333, h: 7.5, sizing: { type: "cover", w: 13.333, h: 7.5 } });
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: T.bg, transparency: 30 }, line: { color: T.bg, transparency: 100 } });
  }

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.12, h: 7.5, fill: { color: T.accent }, line: { color: T.accent } });

  // Chap matn panel (yarim shaffof)
  s.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 0.4, w: 6.5, h: 6.7, fill: { color: T.bg, transparency: 20 }, line: { color: T.bg, transparency: 100 } });

  s.addText(slide.title, { x: 0.5, y: 0.6, w: 6.0, h: 1.2, fontSize: 30, color: T.text, bold: true, align: "left" });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 1.9, w: 2.6, h: 0.06, fill: { color: T.accent }, line: { color: T.accent } });
  if (slide.body) s.addText(slide.body, { x: 0.5, y: 2.1, w: 6.0, h: 0.9, fontSize: 14, color: T.sub, align: "left" });
  (slide.bullets || []).slice(0, 4).forEach((b, i) => {
    s.addText(`→  ${b}`, { x: 0.5, y: 3.2 + i * 0.95, w: 6.0, h: 0.78, fontSize: 14, color: T.text, align: "left" });
    s.addShape(pres.shapes.LINE, { x: 0.5, y: 3.2 + i * 0.95 + 0.78, w: 5.6, h: 0, line: { color: T.card, width: 1 } });
  });

  // O'ng tomonda katta raqam
  s.addText(String(themeIdx).padStart(2, "0"), { x: 7.5, y: 1.5, w: 5.5, h: 5.0, fontSize: 200, color: T.accent, bold: true, align: "center", valign: "middle", transparency: 25 });
}

function addSummarySlide(pres, slide) {
  const T = THEMES[0]; const s = pres.addSlide(); s.background = { color: T.bg };
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: T.card }, line: { color: T.card } });
  s.addShape(pres.shapes.OVAL, { x: 4.7, y: 0.8, w: 4.0, h: 4.0, fill: { color: T.accent, transparency: 92 }, line: { color: T.accent, transparency: 75 } });
  s.addShape(pres.shapes.OVAL, { x: 5.4, y: 1.5, w: 2.5, h: 2.5, fill: { color: T.accent, transparency: 85 }, line: { color: T.accent, transparency: 65 } });
  s.addText("XULOSA", { x: 0.6, y: 0.6, w: 12.1, h: 0.55, fontSize: 12, color: T.accent, bold: true, charSpacing: 4, align: "center" });
  s.addText(slide.title, { x: 0.6, y: 1.3, w: 12.1, h: 1.5, fontSize: 34, color: T.text, bold: true, align: "center", valign: "middle" });
  (slide.bullets || []).slice(0, 3).forEach((b, i) => {
    s.addShape(pres.shapes.RECTANGLE, { x: 1.5, y: 3.2 + i * 1.0, w: 10.3, h: 0.82, fill: { color: T.bg }, line: { color: T.accent, transparency: 70 }, shadow: { type: "outer", blur: 5, offset: 2, angle: 135, color: "000000", opacity: 0.15 } });
    s.addText(`✓  ${b}`, { x: 1.65, y: 3.2 + i * 1.0, w: 10.0, h: 0.82, fontSize: 14, color: T.text, align: "left", valign: "middle" });
  });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 6.9, w: 13.333, h: 0.6, fill: { color: T.accent }, line: { color: T.accent } });
  s.addText("O'qituvchi AI  ·  aiuqituvchi.vercel.app", { x: 0, y: 6.9, w: 13.333, h: 0.6, fontSize: 13, color: T.bg, bold: true, align: "center", valign: "middle" });
}

async function createPresentation(slides, title, subject, grade) {
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE";
  pres.title = title || "Taqdimot";

  addCoverSlide(pres, title, subject, grade);

  const layouts = [
    addSideAccentSlide, addGridSlide, addTwoColumnSlide,
    addStatSlide, addSideAccentSlide, addGridSlide, addTwoColumnSlide,
  ];

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const isLast = i === slides.length - 1;

    // Har bir slayd uchun rasm olish
    let routed = null;
    try {
      routed = await resolveImage(slide);
    } catch (err) {
      console.warn("[Image fallback]", slide.title, err.message);
      routed = svgData(slide, "abstract");
    }

    const img = routed?.image || routed;

    if (isLast) {
      addSummarySlide(pres, slide);
    } else {
      const layoutFn = layouts[i % layouts.length];
      layoutFn(pres, slide, (i % THEMES.length) + 1, img);
    }
  }

  return await pres.write({ outputType: "nodebuffer" });
}
