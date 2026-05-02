// Frontend: index.html ichidagi <script> ga qo‘shiladigan funksiya
async function downloadHybridPptx(){
  const slides = [
    {
      title: "Ona plata",
      body: "Ona plata kompyuterning asosiy platasi bo‘lib, protsessor, RAM va boshqa qurilmalarni bog‘laydi.",
      bullets: [
        "Kompyuter komponentlarini ulaydi",
        "Protsessor va RAM shu plataga o‘rnatiladi",
        "Portlar va chipset orqali boshqaruvni ta’minlaydi"
      ]
    },
    {
      title: "Kiberxavfsizlik",
      body: "Kiberxavfsizlik axborot tizimlari va foydalanuvchilarni raqamli tahdidlardan himoya qilishga qaratilgan.",
      bullets: [
        "Parollarni himoyalash",
        "Zararli dasturlardan saqlanish",
        "Shaxsiy ma’lumotlarni xavfsiz saqlash"
      ]
    }
  ];

  const response = await fetch("/api/generate-pptx", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title: "Informatika taqdimoti",
      slides
    })
  });

  if(!response.ok){
    const text = await response.text();
    console.error(text);
    alert("PPTX yaratishda xatolik bo‘ldi");
    return;
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "taqdimot.pptx";
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}
