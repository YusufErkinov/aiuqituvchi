// Vercel Serverless Function
// Joylashuvi: api/generate-ai.js
// Kerakli Environment Variables:
// GEMINI_API_KEY = Google AI Studio API key
// GEMINI_MODEL   = gemini-2.5-flash yoki gemini-3-flash-preview (ixtiyoriy)
export const config = {
  maxDuration: 60
};

const requestMemory = new Map();
const RATE_LIMIT_MS = 12000;
export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST method allowed" });
  }
  const ip =
  req.headers["x-forwarded-for"]?.split(",")[0] ||
  req.headers["x-real-ip"] ||
  "unknown";

const now = Date.now();
const last = requestMemory.get(ip) || 0;

if (now - last < RATE_LIMIT_MS) {
  return res.status(429).json({
    ok: false,
    mode: "rate_limited",
    error: "Juda tez so‘rov yuborildi. 10–15 soniyadan keyin qayta urinib ko‘ring."
  });
}

requestMemory.set(ip, now);
  
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
    return res.status(500).json({
      ok: false,
      mode: "api_error",
      error: error.message || "Unknown server error"
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

  if (type.includes("test")) {
    return buildTestPrompt({ subject, grade, topic });
  }

  if (type.includes("dars")) {
    return buildLessonPrompt({ subject, grade, topic });
  }

  if (type.includes("hisobot")) {
    return buildReportPrompt({ subject, grade, topic });
  }

  if (
    type.includes("taqdimot") ||
    type.includes("slayd") ||
    type.includes("prezentatsiya")
  ) {
    return buildPresentationPrompt({ subject, grade, topic });
  }

  return buildGeneralPrompt({ docType, subject, grade, topic });
}

function baseRules() {
  return `
UMUMIY FORMAT QOIDALARI:
- Javobni faqat o‘zbek tilida yoz.
- Markdown belgilarini ishlatma: **, ###, ---, \`\`\`, markdown jadval ishlatma.
- Salomlashish, "hurmatli hamkasb", "albatta" kabi kirish gaplar yozma.
- Tayyor hujjat matnini bevosita chiqar.
- Har bir bo‘lim orasida bitta bo‘sh qator qoldir.
- Har bir hujjat turi o‘z qolipida bo‘lsin.
- Testni dars ishlanma kabi yozma.
- Dars ishlanmani test kabi raqamlab ketma.
- Hisobotni savol-javob shaklida yozma.
- Taqdimotni test ko‘rinishida yozma.
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

function buildPresentationPrompt({ subject, grade, topic }) {
  return `
Sen o‘qituvchilar uchun taqdimot rejasi tuzadigan metodik yordamchisan.

VAZIFA:
${subject} fanidan ${grade} uchun "${topic}" mavzusida taqdimot rejasi tayyorla.

${baseRules()}

QAT’IY TAQDIMOT QOLIPI:
TAQDIMOT REJASI

Fan: ${subject}
Sinf: ${grade}
Mavzu: ${topic}

1-slayd: Sarlavha
Slayd mazmuni:
Vizual tavsiya:

2-slayd: Dars maqsadi
Slayd mazmuni:
Vizual tavsiya:

3-slayd: Asosiy tushuncha
Slayd mazmuni:
Vizual tavsiya:

4-slayd: Misollar
Slayd mazmuni:
Vizual tavsiya:

5-slayd: Amaliy topshiriq
Slayd mazmuni:
Vizual tavsiya:

6-slayd: Mustahkamlash
Slayd mazmuni:
Vizual tavsiya:

7-slayd: Xulosa
Slayd mazmuni:
Vizual tavsiya:

TAQDIMOT UCHUN QAT’IY QOIDALAR:
- Faqat slaydlar 1-slayd, 2-slayd kabi raqamlansin.
- Test savollari yozma.
- Har bir slaydda "Slayd mazmuni:" va "Vizual tavsiya:" bo‘lsin.
- Juda uzun matn yozma, slayd uchun qisqa va aniq yoz.
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
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/---+/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function callGemini(apiKey, prompt) {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

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
        temperature: 0.4,
        topP: 0.9,
        maxOutputTokens: 8192
      }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error("Gemini API error: " + text);
  }

  const data = await response.json();

  return (
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    "AI javob qaytarmadi."
  );
}
