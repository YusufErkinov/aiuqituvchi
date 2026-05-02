// Vercel Serverless Function
// Joylashuvi: api/generate-ai.js
// Kerakli Environment Variables:
// GEMINI_API_KEY = Google AI Studio API key
// GEMINI_MODEL   = gemini-3.1-flash-lite-preview yoki gemini-2.5-flash-lite

export const config = {
  maxDuration: 60
};

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

    const docType = body.docType || "Test";
    const subject = body.subject || "Informatika";
    const grade = body.grade || "7-sinf";
    const topic = body.topic || "Sanoq sistemalari";

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(200).json({
        ok: true,
        mode: "demo_fallback",
        docType,
        subject,
        grade,
        topic,
        content: buildDemoContent({ docType, subject, grade, topic }),
        warning: "GEMINI_API_KEY topilmadi. Vercel Environment Variables ichiga GEMINI_API_KEY qo‘ying."
      });
    }

    const prompt = buildPrompt({ docType, subject, grade, topic });
    const aiContent = await callGemini(apiKey, prompt);

    return res.status(200).json({
      ok: true,
      mode: "gemini",
      docType,
      subject,
      grade,
      topic,
      content: cleanAIContent(aiContent)
    });
  } catch (error) {
    const message = String(error && error.message ? error.message : error);

    if (
      message.includes("RESOURCE_EXHAUSTED") ||
      message.includes("Quota exceeded") ||
      message.includes("429")
    ) {
      return res.status(429).json({
        ok: false,
        mode: "quota_exceeded",
        error: "Gemini limiti tugadi. Birozdan keyin qayta urinib ko‘ring yoki boshqa model ishlating.",
        details: message
      });
    }

    if (
      message.includes("UNAVAILABLE") ||
      message.includes("503") ||
      message.includes("high demand")
    ) {
      return res.status(503).json({
        ok: false,
        mode: "model_unavailable",
        error: "Gemini modeli hozir band. Birozdan keyin qayta urinib ko‘ring.",
        details: message
      });
    }

    return res.status(500).json({
      ok: false,
      mode: "api_error",
      error: message
    });
  }
}

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function parseBody(body) {
  if (!body) return {};
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

function buildPrompt({ docType, subject, grade, topic }) {
  const type = String(docType || "").toLowerCase();

  if (
    type.includes("taqdimot") ||
    type.includes("slayd") ||
    type.includes("prezentatsiya")
  ) {
    return buildPresentationPrompt({ subject, grade, topic });
  }

  if (type.includes("test")) {
    return buildTestPrompt({ subject, grade, topic });
  }

  if (type.includes("dars")) {
    return buildLessonPrompt({ subject, grade, topic });
  }

  if (type.includes("hisobot")) {
    return buildReportPrompt({ subject, grade, topic });
  }

  return buildGeneralPrompt({ docType, subject, grade, topic });
}

function baseRules() {
  return `
UMUMIY FORMAT QOIDALARI:
- Javobni faqat o‘zbek tilida yoz.
- Markdown belgilarini ishlatma: **, ###, ---, markdown jadval ishlatma.
- Salomlashish, "hurmatli hamkasb", "albatta" kabi kirish gaplar yozma.
- Tayyor hujjat matnini bevosita chiqar.
- Har bir bo‘lim orasida bitta bo‘sh qator qoldir.
- Har bir hujjat turi o‘z qolipida bo‘lsin.
- Testni dars ishlanma kabi yozma.
- Dars ishlanmani test kabi raqamlab ketma.
- Hisobotni savol-javob shaklida yozma.
- Taqdimotni oddiy matn emas, taqdimotga mos shaklda yoz.
`;
}

function buildPresentationPrompt({ subject, grade, topic }) {
  return `
Sen professional prezentatsiya dizayneri, metodist va AI taqdimot yaratuvchisan.

VAZIFA:
${subject} fanidan ${grade} uchun "${topic}" mavzusida haqiqiy PowerPoint taqdimot uchun strukturali JSON yarat.

MUHIM QOIDALAR:
- Javob FAQAT JSON bo‘lsin.
- Markdown ishlatma.
- JSON code block yozma.
- Izoh yozma.
- JSON tashqarisida hech qanday matn bo‘lmasin.
- Matnlar o‘zbek tilida bo‘lsin.
- Slayd matnlari qisqa, aniq va o‘quvchi tushunadigan bo‘lsin.
- Har bir slayd uchun visual maydoni bo‘lsin.
- Zerikarli matn emas, chiroyli taqdimotga mos kontent tuz.
- 7–9 ta slayd bo‘lsin.
- JSON valid bo‘lsin.
- Qo‘shtirnoqlarni to‘g‘ri yop.
- Oxirgi elementdan keyin ortiqcha vergul qo‘yma.

QAYTARILADIGAN JSON QOLIPI:
{
  "presentationTitle": "${topic}",
  "subject": "${subject}",
  "grade": "${grade}",
  "theme": "modern_edtech_blue",
  "style": {
    "background": "dark_gradient",
    "primaryColor": "#5B7CFF",
    "accentColor": "#22D3EE",
    "font": "Arial",
    "mood": "modern, clean, educational, premium"
  },
  "slides": [
    {
      "type": "title",
      "title": "${topic}",
      "subtitle": "${grade} ${subject} darsi",
      "visual": "large_ai_badge"
    },
    {
      "type": "content",
      "title": "Asosiy tushuncha",
      "bullets": [
        "Mavzuning asosiy mazmuni qisqa bayon qilinadi",
        "O‘quvchilar tushunishi kerak bo‘lgan muhim fikrlar ajratiladi",
        "Mavzu hayotiy misollar bilan bog‘lanadi"
      ],
      "visual": "concept_icon",
      "speakerNote": "O‘qituvchi ushbu slaydda mavzuni sodda tilda kirish sifatida tushuntiradi."
    },
    {
      "type": "comparison",
      "title": "Taqqoslash",
      "leftTitle": "1-tushuncha",
      "leftPoints": [
        "Birinchi belgisi",
        "Ikkinchi belgisi"
      ],
      "rightTitle": "2-tushuncha",
      "rightPoints": [
        "Birinchi farqi",
        "Ikkinchi farqi"
      ],
      "visual": "two_column_cards"
    },
    {
      "type": "process",
      "title": "Jarayon bosqichlari",
      "steps": [
        "Birinchi bosqich",
        "Ikkinchi bosqich",
        "Uchinchi bosqich"
      ],
      "visual": "step_timeline"
    },
    {
      "type": "example",
      "title": "Amaliy misol",
      "exampleTitle": "Misol",
      "exampleText": "Mavzuga mos sodda amaliy misol yoziladi.",
      "solutionSteps": [
        "1-qadam",
        "2-qadam",
        "3-qadam"
      ],
      "visual": "example_card"
    },
    {
      "type": "activity",
      "title": "Interaktiv topshiriq",
      "task": "O‘quvchilar bajaradigan qisqa topshiriq yoziladi.",
      "instructions": [
        "Topshiriqni o‘qing",
        "Juftlikda muhokama qiling",
        "Natijani sinfda izohlang"
      ],
      "visual": "activity_box"
    },
    {
      "type": "summary",
      "title": "Xulosa",
      "bullets": [
        "Mavzuning eng muhim xulosasi",
        "O‘quvchi eslab qolishi kerak bo‘lgan fikr",
        "Keyingi mavzuga bog‘lanish"
      ],
      "visual": "summary_checklist"
    }
  ]
}

SLAYD TURLARI:
title, content, comparison, process, example, activity, summary

QOIDALAR:
- slides massivida kamida 7 ta slayd bo‘lsin.
- Har bir slaydda type va title bo‘lsin.
- content slaydlarda 3–5 ta bullet bo‘lsin.
- comparison slaydda leftTitle, leftPoints, rightTitle, rightPoints bo‘lsin.
- process slaydda steps bo‘lsin.
- example slaydda exampleTitle, exampleText, solutionSteps bo‘lsin.
- activity slaydda task va instructions bo‘lsin.
- summary slaydda bullets bo‘lsin.
- Slayd matnlari uzun bo‘lmasin.
- Faqat JSON qaytar.
`;
}

function buildTestPrompt({ subject, grade, topic }) {
  return `
Sen O‘zbekiston maktab o‘qituvchilari uchun professional AI yordamchisan.

VAZIFA:
${subject} fanidan ${grade} uchun "${topic}" mavzusida 20 ta test savoli tuz.

${baseRules()}

QAT’IY TEST QOLIPI:
TEST

Fan: ${subject}
Sinf: ${grade}
Mavzu: ${topic}

1. Savol matni?
A) Variant matni
B) Variant matni
C) Variant matni
D) Variant matni

2. Savol matni?
A) Variant matni
B) Variant matni
C) Variant matni
D) Variant matni

... 20 tagacha davom ettir.

Javoblar kaliti:
1-A
2-C
3-B
...

TEST UCHUN QAT’IY QOIDALAR:
- Faqat savollar 1 dan 20 gacha raqamlansin.
- Har bir savol bitta satrdan boshlansin.
- Har bir variant A), B), C), D) ko‘rinishida alohida satrda bo‘lsin.
- Har savolda faqat bitta to‘g‘ri javob bo‘lsin.
- Oxirida faqat "Javoblar kaliti:" bo‘limi bo‘lsin.
- Dars maqsadi, metodist izohi, baholash, uyga vazifa qo‘shma.
- Ortiqcha izoh yozma.
`;
}

function buildLessonPrompt({ subject, grade, topic }) {
  return `
Sen tajribali metodist-o‘qituvchisan.

VAZIFA:
${subject} fanidan ${grade} uchun "${topic}" mavzusida to‘liq dars ishlanma tayyorla.

${baseRules()}

QAT’IY DARS ISHLANMA QOLIPI:
DARS ISHLANMA

Fan: ${subject}
Sinf: ${grade}
Mavzu: ${topic}

Darsning maqsadi:
Ta’limiy:
Tarbiyaviy:
Rivojlantiruvchi:

Kutilayotgan natija:
O‘quvchilar dars yakunida nimalarni bilishi va bajara olishi yoziladi.

Dars jihozlari:
Kerakli vositalar yoziladi.

Dars turi:
Mavzuga mos dars turi yoziladi.

Dars metodi:
Mavzuga mos metodlar yoziladi.

Darsning borishi:

Tashkiliy qism:
2-3 jumla bilan yoz.

O‘tilgan mavzuni takrorlash:
3-5 ta savol yoki topshiriq yoz.

Yangi mavzu bayoni:
Mavzuni ${grade} darajasiga mos, tushunarli, 4-6 abzastda tushuntir.
Kerak bo‘lsa misollar keltir.

Mustahkamlash:
Amaliy topshiriqlar yoki savol-javob yoz.

Baholash:
Baholash mezonlari yoziladi.

Uyga vazifa:
Aniq uy vazifasi yoziladi.

Metodist izohi:
Darsni samarali tashkil etish bo‘yicha 2-3 jumla tavsiya yoz.

DARS ISHLANMA UCHUN QAT’IY QOIDALAR:
- Har bir gapni 1,2,3 deb raqamlama.
- Faqat yuqoridagi bo‘lim nomlari bilan yoz.
- Test savollari shaklida 20 ta savol tuzma.
- "1. Tashkiliy qism" emas, "Tashkiliy qism:" deb yoz.
- Har bir bo‘limni alohida abzast bilan ajrat.
`;
}

function buildReportPrompt({ subject, grade, topic }) {
  return `
Sen maktab hujjatlarini rasmiy uslubda tayyorlaydigan yordamchisan.

VAZIFA:
${subject} fanidan ${grade} bo‘yicha "${topic}" mavzusida rasmiy hisobot tayyorla.

${baseRules()}

QAT’IY HISOBOT QOLIPI:
HISOBOT

Fan: ${subject}
Sinf: ${grade}
Mavzu: ${topic}

Kirish:
Mavzu va faoliyat haqida qisqa rasmiy ma’lumot yoz.

Asosiy qism:
Faoliyat qanday olib borilgani haqida 2-4 abzast yoz.

Amalga oshirilgan ishlar:
- Birinchi bajarilgan ish
- Ikkinchi bajarilgan ish
- Uchinchi bajarilgan ish
- To‘rtinchi bajarilgan ish

O‘quvchilar faolligi:
O‘quvchilarning ishtiroki va faolligi haqida yoz.

Natijalar:
Erishilgan natijalarni rasmiy uslubda yoz.

Xulosa:
Umumiy yakuniy xulosa yoz.

Takliflar:
- Birinchi taklif
- Ikkinchi taklif
- Uchinchi taklif

HISOBOT UCHUN QAT’IY QOIDALAR:
- Savollar yoki test variantlari yozma.
- Har bir gapni raqamlama.
- Rasmiy, aniq, qisqa va maktab hujjatiga mos yoz.
- Faqat "Amalga oshirilgan ishlar" va "Takliflar" bo‘limlarida tireli ro‘yxat ishlat.
`;
}

function buildGeneralPrompt({ docType, subject, grade, topic }) {
  return `
Sen O‘zbekiston maktab o‘qituvchilari uchun AI yordamchisan.

VAZIFA:
Hujjat turi: ${docType}
Fan: ${subject}
Sinf: ${grade}
Mavzu: ${topic}

${baseRules()}

QOLIP:
${docType}

Fan: ${subject}
Sinf: ${grade}
Mavzu: ${topic}

Asosiy mazmun:
Rasmiy, tartibli, abzastlarga ajratilgan tayyor hujjat matnini yoz.

Xulosa:
Qisqa yakuniy xulosa yoz.
`;
}

function buildDemoContent({ docType, subject, grade, topic }) {
  const type = String(docType || "").toLowerCase();

  if (type.includes("taqdimot") || type.includes("slayd") || type.includes("prezentatsiya")) {
    return JSON.stringify({
      presentationTitle: topic,
      subject,
      grade,
      theme: "modern_edtech_blue",
      style: {
        background: "dark_gradient",
        primaryColor: "#5B7CFF",
        accentColor: "#22D3EE",
        font: "Arial",
        mood: "modern, clean, educational, premium"
      },
      slides: [
        {
          type: "title",
          title: topic,
          subtitle: grade + " " + subject + " darsi",
          visual: "large_ai_badge"
        },
        {
          type: "content",
          title: "Asosiy tushuncha",
          bullets: [
            "Mavzuning asosiy mazmuni tushuntiriladi",
            "Muhim fikrlar qisqa ko‘rinishda beriladi",
            "O‘quvchilar uchun tushunarli misollar keltiriladi"
          ],
          visual: "concept_icon",
          speakerNote: "O‘qituvchi mavzuga kirish qiladi."
        },
        {
          type: "comparison",
          title: "Taqqoslash",
          leftTitle: "1-tushuncha",
          leftPoints: ["Birinchi belgisi", "Ikkinchi belgisi"],
          rightTitle: "2-tushuncha",
          rightPoints: ["Birinchi farqi", "Ikkinchi farqi"],
          visual: "two_column_cards"
        },
        {
          type: "process",
          title: "Jarayon bosqichlari",
          steps: ["Birinchi bosqich", "Ikkinchi bosqich", "Uchinchi bosqich"],
          visual: "step_timeline"
        },
        {
          type: "example",
          title: "Amaliy misol",
          exampleTitle: "Misol",
          exampleText: "Mavzuga mos sodda amaliy misol.",
          solutionSteps: ["1-qadam", "2-qadam", "3-qadam"],
          visual: "example_card"
        },
        {
          type: "activity",
          title: "Interaktiv topshiriq",
          task: "O‘quvchilar bajaradigan qisqa topshiriq.",
          instructions: ["Topshiriqni o‘qing", "Juftlikda muhokama qiling", "Natijani izohlang"],
          visual: "activity_box"
        },
        {
          type: "summary",
          title: "Xulosa",
          bullets: ["Asosiy xulosa", "Muhim fikr", "Keyingi mavzuga bog‘lanish"],
          visual: "summary_checklist"
        }
      ]
    });
  }

  if (type.includes("test")) {
    return `TEST

Fan: ${subject}
Sinf: ${grade}
Mavzu: ${topic}

1. ${topic} mavzusi bo‘yicha asosiy tushuncha qaysi?
A) Birinchi variant
B) Ikkinchi variant
C) Uchinchi variant
D) To‘rtinchi variant

2. ${topic} mavzusiga oid to‘g‘ri javobni belgilang.
A) Birinchi variant
B) Ikkinchi variant
C) Uchinchi variant
D) To‘rtinchi variant

Javoblar kaliti:
1-A
2-B`;
  }

  if (type.includes("dars")) {
    return `DARS ISHLANMA

Fan: ${subject}
Sinf: ${grade}
Mavzu: ${topic}

Darsning maqsadi:
Ta’limiy: O‘quvchilarga ${topic} mavzusi haqida tushuncha berish.
Tarbiyaviy: O‘quvchilarda intizom va mas’uliyatni shakllantirish.
Rivojlantiruvchi: Mustaqil fikrlash va amaliy ko‘nikmalarni rivojlantirish.

Kutilayotgan natija:
O‘quvchilar mavzu bo‘yicha asosiy tushunchalarni izohlay oladi.

Dars jihozlari:
Darslik, doska, kompyuter, slaydlar.

Darsning borishi:

Tashkiliy qism:
Salomlashish, davomatni aniqlash va darsga tayyorgarlik ko‘rish.

Yangi mavzu bayoni:
${topic} mavzusi o‘quvchilarga sodda misollar asosida tushuntiriladi.

Mustahkamlash:
O‘quvchilar bilan savol-javob o‘tkaziladi.

Uyga vazifa:
Mavzuni o‘qish va mashqlarni bajarish.`;
  }

  if (type.includes("hisobot")) {
    return `HISOBOT

Fan: ${subject}
Sinf: ${grade}
Mavzu: ${topic}

Kirish:
${topic} mavzusi bo‘yicha o‘quv jarayoni tashkil etildi.

Asosiy qism:
Mashg‘ulot davomida o‘quvchilarga mavzuga oid ma’lumotlar tushuntirildi.

Amalga oshirilgan ishlar:
- Mavzu bo‘yicha tushuntirish ishlari olib borildi
- O‘quvchilar bilan savol-javob tashkil etildi
- Amaliy topshiriqlar bajarildi

Natijalar:
O‘quvchilar mavzu yuzasidan dastlabki tushunchalarga ega bo‘ldi.

Xulosa:
Mashg‘ulot belgilangan maqsad asosida tashkil etildi.`;
  }

  return `${docType}

Fan: ${subject}
Sinf: ${grade}
Mavzu: ${topic}

Asosiy mazmun:
${topic} mavzusi bo‘yicha tayyor hujjat matni.

Xulosa:
Mavzu bo‘yicha umumiy xulosa beriladi.`;
}

function cleanAIContent(content) {
  return String(content || "")
    .replace(/\r/g, "")
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/---+/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function callGemini(apiKey, prompt) {
  const envModel = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite-preview";

  const models = [
    envModel,
    "gemini-3.1-flash-lite-preview",
    "gemini-2.5-flash-lite",
    "gemini-3-flash-preview"
  ].filter((model, index, arr) => model && arr.indexOf(model) === index);

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
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.35,
            topP: 0.9,
            maxOutputTokens: 8192
          }
        })
      });

      if (!response.ok) {
        const text = await response.text();
        lastError = "Model " + model + ": " + text;

        if (response.status === 429 || response.status === 503) {
          continue;
        }

        throw new Error(lastError);
      }

      const data = await response.json();

      return (
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "AI javob qaytarmadi."
      );
    } catch (err) {
      lastError = err.message || String(err);

      if (
        lastError.includes("429") ||
        lastError.includes("503") ||
        lastError.includes("Quota") ||
        lastError.includes("UNAVAILABLE") ||
        lastError.includes("RESOURCE_EXHAUSTED")
      ) {
        continue;
      }

      throw err;
    }
  }

  throw new Error("Barcha Gemini modellari ishlamadi: " + lastError);
}
