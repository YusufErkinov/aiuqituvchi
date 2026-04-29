export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return jsonResponse({ ok: true });
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse({ error: "Only POST method allowed" }, 405);
  }

  try {
    const body = JSON.parse(event.body || "{}");

    const docType = body.docType || "Test";
    const subject = body.subject || "Informatika";
    const grade = body.grade || "7-sinf";
    const topic = body.topic || "Sanoq sistemalari";

    const prompt = buildPrompt({ docType, subject, grade, topic });
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return jsonResponse({
        ok: true,
        mode: "demo_fallback",
        content: buildDemoContent({ docType, subject, grade, topic })
      });
    }

    const aiContent = await callGemini(apiKey, prompt);

    return jsonResponse({
      ok: true,
      mode: "gemini",
      docType,
      content: cleanAIContent(aiContent)
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error.message || "Unknown error"
    }, 500);
  }
}

function buildPrompt({ docType, subject, grade, topic }) {
  const normalizedType = String(docType || "").toLowerCase();

  if (normalizedType.includes("test")) {
    return buildTestPrompt({ subject, grade, topic });
  }

  if (normalizedType.includes("dars")) {
    return buildLessonPrompt({ subject, grade, topic });
  }

  if (normalizedType.includes("hisobot")) {
    return buildReportPrompt({ subject, grade, topic });
  }

  if (
    normalizedType.includes("taqdimot") ||
    normalizedType.includes("slayd") ||
    normalizedType.includes("prezentatsiya")
  ) {
    return buildPresentationPrompt({ subject, grade, topic });
  }

  return buildGeneralPrompt({ docType, subject, grade, topic });
}

function baseRules() {
  return `
MUHIM FORMAT QOIDALARI:
- Javobni faqat o‘zbek tilida yoz.
- Markdown ishlatma: **, ###, --- , jadval markdown belgilarini ishlatma.
- Salomlashish, “hurmatli hamkasb”, kirish gaplar va ortiqcha izohlar yozma.
- Tayyor hujjat matnini bevosita chiqar.
- Har bir bo‘lim orasida bitta bo‘sh qator qoldir.
- Avto raqamlashni chalkashtirma: har bir hujjat turi o‘z qolipida bo‘lsin.
- Testni dars ishlanma kabi, dars ishlanmani test kabi yozma.
`;
}

function buildTestPrompt({ subject, grade, topic }) {
  return `
Sen O‘zbekiston maktab o‘qituvchilari uchun AI yordamchisan.

VAZIFA:
${subject} fanidan ${grade} uchun "${topic}" mavzusida 20 ta test tuz.

${baseRules()}

QAT’IY TEST QOLIPI:
TEST

Fan: ${subject}
Sinf: ${grade}
Mavzu: ${topic}

1. Savol matni?
A) Variant
B) Variant
C) Variant
D) Variant

2. Savol matni?
A) Variant
B) Variant
C) Variant
D) Variant

... shu tartibda 20 tagacha davom etadi.

Javoblar kaliti:
1-A
2-C
3-B
...

TEST UCHUN MAXSUS QOIDALAR:
- Faqat savollar 1 dan 20 gacha raqamlansin.
- Har bir savol ostida A), B), C), D) variantlar alohida satrda bo‘lsin.
- Har bir savolda faqat bitta to‘g‘ri javob bo‘lsin.
- Javoblar kaliti oxirida alohida bo‘limda bo‘lsin.
- Izoh, metodist fikri, dars bosqichi, uyga vazifa qo‘shma.
`;
}

function buildLessonPrompt({ subject, grade, topic }) {
  return `
Sen tajribali metodist-o‘qituvchisan.

VAZIFA:
${subject} fanidan ${grade} uchun "${topic}" mavzusida dars ishlanma tayyorla.

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
O‘quvchilar dars yakunida nimalarni bilishi va bajara olishi qisqa yoziladi.

Dars jihozlari:
Kerakli vositalar vergul bilan yoziladi.

Dars turi:
Yangi bilim beruvchi / mustahkamlovchi / aralash darsdan mosini yoz.

Dars metodi:
Mos metodlarni yoz.

Darsning borishi:

Tashkiliy qism:
Qisqa, 2-3 jumla.

O‘tilgan mavzuni takrorlash:
3-5 ta savol yoki topshiriq.

Yangi mavzu bayoni:
Mavzuni sinf darajasiga mos, tushunarli, 3-5 abzastda tushuntir.

Mustahkamlash:
Amaliy mashq, savol-javob yoki kichik topshiriqlar.

Baholash:
Baholash mezonlari qisqa yoziladi.

Uyga vazifa:
Aniq uy vazifasi yoziladi.

Metodist izohi:
Darsni samarali o‘tish bo‘yicha 2-3 jumla tavsiya.

DARS ISHLANMA UCHUN MAXSUS QOIDALAR:
- 1, 2, 3 deb har bir gapni raqamlama.
- Faqat yuqoridagi bo‘lim nomlari saqlansin.
- Test savollari shaklida 20 ta savol tuzma.
- Har bir bo‘lim alohida abzast bilan ajralsin.
`;
}

function buildReportPrompt({ subject, grade, topic }) {
  return `
Sen maktab hujjatlarini rasmiy uslubda tayyorlaydigan yordamchisan.

VAZIFA:
${subject} fanidan ${grade} bo‘yicha "${topic}" mavzusida hisobot tayyorla.

${baseRules()}

QAT’IY HISOBOT QOLIPI:
HISOBOT

Fan: ${subject}
Sinf: ${grade}
Mavzu: ${topic}

Kirish:
Mavzu va faoliyat haqida qisqa ma’lumot.

Asosiy qism:
Amalga oshirilgan ishlar rasmiy uslubda bayon qilinadi.

Amalga oshirilgan ishlar:
- 1-ish
- 2-ish
- 3-ish
- 4-ish

O‘quvchilar faolligi:
O‘quvchilarning ishtiroki va faolligi haqida yoziladi.

Natijalar:
Erishilgan natijalar qisqa bayon qilinadi.

Xulosa:
Umumiy xulosa yoziladi.

Takliflar:
- 1-taklif
- 2-taklif
- 3-taklif

HISOBOT UCHUN MAXSUS QOIDALAR:
- Savol-javob yoki test formatida yozma.
- Har bir gapni raqamlama.
- Rasmiy, qisqa, tushunarli va maktab hujjatiga mos yoz.
`;
}

function buildPresentationPrompt({ subject, grade, topic }) {
  return `
Sen taqdimot rejasini tuzadigan metodik yordamchisan.

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

TAQDIMOT UCHUN MAXSUS QOIDALAR:
- Faqat slaydlar raqamlansin.
- Test savollari ko‘rinishida yozma.
- Har bir slaydda qisqa mazmun va vizual tavsiya bo‘lsin.
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
  const normalizedType = String(docType || "").toLowerCase();

  if (normalizedType.includes("test")) {
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

  if (normalizedType.includes("dars")) {
    return `DARS ISHLANMA

Fan: ${subject}
Sinf: ${grade}
Mavzu: ${topic}

Darsning maqsadi:
Ta’limiy: O‘quvchilarga ${topic} mavzusi haqida tushuncha berish.
Tarbiyaviy: O‘quvchilarda mas’uliyat va intizomni shakllantirish.
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

function jsonResponse(data, status = 200) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    },
    body: JSON.stringify(data)
  };
}
