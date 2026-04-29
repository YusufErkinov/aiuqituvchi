export async function handler(event) {
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
      content: aiContent
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error.message || "Unknown error"
    }, 500);
  }
}

function buildPrompt({ docType, subject, grade, topic }) {
  if (docType === "Test") {
    return `
Sen O‘zbekiston maktab o‘qituvchilari uchun AI yordamchisan.

Vazifa:
${subject} fanidan ${grade} uchun "${topic}" mavzusida test tuz.

Talablar:
- 20 ta test savoli bo‘lsin
- Har bir savolda A/B/C/D variantlar bo‘lsin
- Faqat bitta to‘g‘ri javob bo‘lsin
- Oxirida javoblar kaliti bo‘lsin
- O‘zbek tilida, sinf darajasiga mos, rasmiy pedagogik uslubda yoz
`;
  }

  if (docType === "Dars ishlanma") {
    return `
Sen tajribali metodist-o‘qituvchisan.

Quyidagi ma’lumotlar asosida dars ishlanma tuz:
Fan: ${subject}
Sinf: ${grade}
Mavzu: ${topic}

Bo‘limlar:
1. Dars mavzusi
2. Dars maqsadi
3. Kompetensiyalar
4. Kerakli jihozlar
5. Dars bosqichlari
6. Yangi mavzu bayoni
7. Mustahkamlash
8. Baholash
9. Uyga vazifa

Matn rasmiy pedagogik uslubda bo‘lsin.
`;
  }

  return `
Sen O‘zbekiston maktab o‘qituvchilari uchun AI yordamchisan.

Hujjat turi: ${docType}
Fan: ${subject}
Sinf: ${grade}
Mavzu: ${topic}

Rasmiy, tartibli, o‘zbek tilida tayyor hujjat matnini yoz.
`;
}

function buildDemoContent({ docType, subject, grade, topic }) {
  return `O‘qituvchi AI demo javobi

Hujjat turi: ${docType}
Fan: ${subject}
Sinf: ${grade}
Mavzu: ${topic}

1. ${topic} mavzusi bo‘yicha asosiy tushunchalar yoritiladi.
2. O‘quvchilar mavzuga oid savollarga javob beradi.
3. Amaliy topshiriqlar orqali bilim mustahkamlanadi.
4. Yakunda qisqa xulosa va baholash amalga oshiriladi.

Izoh: Bu fallback demo javob. GEMINI_API_KEY qo‘yilgandan keyin real AI javob qaytadi.`;
}

async function callGemini(apiKey, prompt) {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
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
      ]
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
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(data)
  };
}