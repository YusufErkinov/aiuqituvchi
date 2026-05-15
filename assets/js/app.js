/************************************************************
     * SUPABASE SOZLAMALARI
     * 1) SUPABASE_URL ni o'zingizning Project URL bilan almashtiring
     * 2) SUPABASE_ANON_KEY ni o'zingizning anon public key bilan almashtiring
     * Service role key'ni bu yerga yozmang.
     ************************************************************/
    const SUPABASE_URL = "https://zngjsbdkooaqwvhbvcws.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZ2pzYmRrb29hcXd2aGJ2Y3dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MDUxMDEsImV4cCI6MjA5Mjk4MTEwMX0.GLelo2cLljCfI4WdtusL58fQlAd5SCbXBAg1icNHlAc";

    const isSupabaseConfigured =
      SUPABASE_URL.startsWith("https://") &&
      SUPABASE_ANON_KEY.length > 40 &&
      !SUPABASE_URL.includes("BU_YERGA") &&
      !SUPABASE_ANON_KEY.includes("BU_YERGA");

    const db = isSupabaseConfigured
      ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      : null;

    function getSessionId(){
      let id = localStorage.getItem("oqituvchi_ai_session_id");
      if(!id){
        id = crypto.randomUUID();
        localStorage.setItem("oqituvchi_ai_session_id", id);
      }
      return id;
    }

    const sessionId = getSessionId();

    async function trackEvent(eventName, metadata = {}){
      if(!db){
        console.log("[Supabase ulanmagan] event:", eventName, metadata);
        return;
      }

      try{
        const { error } = await db.from("analytics_events").insert({
          session_id: sessionId,
          profile_id: null,
          event_name: eventName,
          page: location.pathname,
          metadata: {
            ...metadata,
            current_plan: currentPlan,
            balance,
            pro_files_left: proFilesLeft,
            total_docs: totalDocs,
            total_downloads: totalDownloads,
            created_from: "oqituvchi_ai_test_site"
          }
        });

        if(error){
          console.warn("analytics_events insert error:", error.message);
        }
      }catch(err){
        console.warn("trackEvent error:", err);
      }
    }

    async function saveProfileToSupabase(){
      if(!db){
        console.log("[Supabase ulanmagan] profile saqlanmadi");
        return;
      }

      try{
        const { error } = await db.from("profiles").insert({
          session_id: sessionId,
          full_name: profile.fullName,
          phone: profile.phone,
          subject: profile.subject,
          grade: profile.grade,
          weekly_hours: Number(document.getElementById("hours")?.value || 0),
          main_need: profile.need
        });

        if(error){
          // session_id unique bo'lsa, qayta signup bosilganda duplicate chiqishi mumkin.
          // Test uchun bu xato xavfli emas: eventlar session_id bilan baribir yoziladi.
          console.warn("profiles insert error:", error.message);
          await trackEvent("signup_profile_save_error", { message: error.message });
          return;
        }

        await trackEvent("signup_success", {
          full_name: profile.fullName,
          phone: profile.phone,
          subject: profile.subject,
          grade: profile.grade,
          main_need: profile.need
        });
      }catch(err){
        console.warn("saveProfileToSupabase error:", err);
        await trackEvent("signup_profile_save_error", { message: String(err) });
      }
    }

    async function saveDocumentToSupabase(doc){
      if(!db){
        console.log("[Supabase ulanmagan] document saqlanmadi");
        return;
      }

      try{
        const { error } = await db.from("documents").insert({
          session_id: sessionId,
          profile_id: null,
          doc_type: doc.type,
          subject: doc.subject,
          grade: doc.grade,
          topic: doc.topic,
          content: doc.content
        });

        if(error){
          console.warn("documents insert error:", error.message);
          await trackEvent("document_save_error", { message: error.message });
          return;
        }

        await trackEvent("document_created", {
          doc_type: doc.type,
          subject: doc.subject,
          grade: doc.grade,
          topic: doc.topic,
          title: doc.title
        });
      }catch(err){
        console.warn("saveDocumentToSupabase error:", err);
        await trackEvent("document_save_error", { message: String(err) });
      }
    }

    const FILE_PRICE = 1000;
    const MIN_TOPUP = 5000;
    const PRO_PRICE = 39000;
    const PRO_FILE_LIMIT = 100;

    const STORAGE_KEY = "oqituvchi_ai_user_data_v1";
    let isGenerating = false;
    let lastGenerateTime = 0;
    const GENERATE_COOLDOWN_MS = 12000;
    let isRegistered = false;
    let currentPlan = 'Donabay';
    let balance = 0;
    let proFilesLeft = 0;
    let totalDocs = 0;
    let totalDownloads = 0;
    let documents = [];
    let currentDoc = null;
    let profile = {
      fullName: 'Yusuf Erkinov',
      phone: '+998 90 123 45 67',
      subject: 'Informatika',
      grade: '7–9-sinflar',
      need: 'Test generator',
      photoData: ''
    };

    function saveState(){
      const data = {
        profile,
        currentPlan,
        balance,
        proFilesLeft,
        totalDocs,
        totalDownloads,
        documents,
        currentDoc,
        isRegistered
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    function loadState(){
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return;

      try{
        const data = JSON.parse(raw);
        if(data.profile) profile = data.profile;
        if(data.currentPlan) currentPlan = data.currentPlan;
        if(typeof data.balance === "number") balance = data.balance;
        if(typeof data.proFilesLeft === "number") proFilesLeft = data.proFilesLeft;
        if(typeof data.totalDocs === "number") totalDocs = data.totalDocs;
        if(typeof data.totalDownloads === "number") totalDownloads = data.totalDownloads;
        if(Array.isArray(data.documents)) documents = data.documents;
        if(data.currentDoc) currentDoc = data.currentDoc;
        if(typeof data.isRegistered === "boolean"){
          isRegistered = data.isRegistered;
        } else if(data.profile && data.profile.fullName && data.profile.phone){
          isRegistered = true;
        }
      }catch(err){
        console.warn("LocalStorage o‘qishda xatolik:", err);
      }
    }

    window.addEventListener("load", function(){
      trackEvent("page_view", {
        referrer: document.referrer,
        user_agent: navigator.userAgent,
        screen: window.innerWidth + "x" + window.innerHeight,
        state_loaded: !!localStorage.getItem(STORAGE_KEY)
      });
    });

    function toggleMenu(){
      document.getElementById('navLinks').classList.toggle('open');
    }

    function showPage(id){
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      const page = document.getElementById(id);
      if(page) page.classList.add('active');

      document.querySelectorAll('.nav-link').forEach(b => {
        b.classList.toggle('active', b.dataset.page === id);
      });

      const nav = document.getElementById('navLinks');
      if(nav) nav.classList.remove('open');
      window.scrollTo({top:0, behavior:'smooth'});
      updateUsageUI();
      if(id === 'dashboard'){
        renderDocuments();
        syncProfileUI();
      }
      trackEvent("page_change", { page_id: id });
    }

    function showDashTab(tab){
      showPage('dashboard');
      document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
      const target = document.getElementById('tab-' + tab);
      if(target) target.classList.add('active');

      document.querySelectorAll('.side-menu button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
      });

      if(tab === 'documents') renderDocuments();
      if(tab === 'profile') loadProfileToEdit();
      updateUsageUI();
      trackEvent("dashboard_tab_click", { tab });
    }

    function fillDemo(){
      document.getElementById('fullName').value = 'Yusuf Erkinov';
      document.getElementById('phone').value = '+998 90 123 45 67';
      document.getElementById('subject').value = 'Informatika';
      document.getElementById('grade').value = '7–9-sinflar';
      document.getElementById('hours').value = 22;
      document.getElementById('need').value = 'Test generator';
      const note = document.getElementById('note');
      if(note) note.value = 'Testlar javob kaliti bilan chiqsin, Word format kerak.';
      toast('Demo ma’lumotlar to‘ldirildi');
      trackEvent("demo_fill_click");
    }

    const signupForm = document.getElementById('signupForm');
    if(signupForm){
      signupForm.addEventListener('submit', async function(e){
        e.preventDefault();

        const name = document.getElementById('fullName').value.trim() || 'Ustoz';
        const subject = document.getElementById('subject').value;
        const need = document.getElementById('need').value;
        const hours = Number(document.getElementById('hours').value || 20);
        const save = Math.max(6, Math.round(hours * 0.45));

        profile.fullName = name;
        profile.phone = document.getElementById('phone').value.trim();
        profile.subject = subject;
        profile.grade = document.getElementById('grade').value;
        profile.need = need;
        isRegistered = true;
        saveState();
        updateAuthUI();

        await trackEvent("signup_attempt", {
          full_name: profile.fullName,
          phone: profile.phone,
          subject: profile.subject,
          grade: profile.grade,
          main_need: profile.need,
          weekly_hours: hours
        });

        await saveProfileToSupabase();

        document.getElementById('analysisTitle').textContent = name + ', sizga mos tavsiya tayyor';
        document.getElementById('analysisText').textContent =
          'Siz ' + subject + ' o‘qituvchisisiz. Tavsiya: Donabay tarif bilan boshlang — kerakli faylni 1 000 so‘mdan yuklab olasiz.';
        document.getElementById('saveTime').textContent = save + ' soat';
        document.getElementById('mainNeed').textContent = 'Donabay';

        syncProfileUI();
        const genSubject = document.getElementById('genSubject');
        if(genSubject) genSubject.value = subject;
        const editSubject = document.getElementById('editSubject');
        if(editSubject) editSubject.value = subject;
        document.getElementById('analysis').classList.add('show');
        toast('Shaxsiy tahlil tayyor');
      });
    }

    function isRegisteredUser(){
      return isRegistered === true;
    }

    function updateAuthUI(){
      const registered = isRegisteredUser();

      // Mayda "Ro‘yxatdan o‘tish" linki yashiriladi. Asosiy CTA yetarli.
      document.querySelectorAll('[data-auth="signup"]').forEach(btn => {
        btn.style.display = 'none';
      });

      // Ro‘yxatdan o‘tgan odamda kichik "Shaxsiy kabinet" linkini yashiramiz,
      // chunki asosiy gradient button ham "Shaxsiy kabinet" bo‘ladi.
      document.querySelectorAll('[data-auth="cabinet"]').forEach(btn => {
        btn.textContent = 'Shaxsiy kabinet';
        btn.style.display = registered ? 'none' : '';
        btn.onclick = function(){
          if(registered){
            showPage('dashboard');
          } else {
            showPage('signup');
            toast("Avval ro‘yxatdan o‘ting.");
          }
        };
      });

      document.querySelectorAll('[data-auth="primary"]').forEach(btn => {
        if(registered){
          btn.textContent = 'Shaxsiy kabinet';
          btn.onclick = function(){ showPage('dashboard'); };
        } else {
          btn.textContent = 'Ro‘yxatdan o‘tish';
          btn.onclick = function(){ showPage('signup'); };
        }
      });
    }

    function protectResultCopy(){
      const targets = [
        document.getElementById('docOutput'),
        document.getElementById('outputBody'),
        document.getElementById('outputList')
      ].filter(Boolean);

      targets.forEach(el => {
        ['copy','cut','contextmenu','selectstart','dragstart'].forEach(eventName => {
          el.addEventListener(eventName, function(e){
            e.preventDefault();
            toast('Natijani copy qilish yopiq. Faylni yuklab oling.');
          });
        });
      });
    }

    function syncProfileUI(){
      const name = profile.fullName || 'Ustoz';
      const first = name.split(' ')[0] || 'Ustoz';
      const initials = getInitials(name);

      const sideName = document.getElementById('sideName');
      if(sideName) sideName.textContent = name;
      const sideSubject = document.getElementById('sideSubject');
      if(sideSubject) sideSubject.textContent = profile.subject + ' o‘qituvchisi';
      const greeting = document.getElementById('dashGreeting');
      if(greeting) greeting.textContent = 'Assalomu alaykum, ' + first + ' 👋';
      const advice = document.getElementById('dashAdvice');
      if(advice) advice.textContent = 'Donabay tarif: tayyor faylni 1 000 so‘mdan yuklab oling yoki Pro tarifda 100 faylni oching.';

      setAvatarContent('avatarText', initials);
      setAvatarContent('profilePhotoLarge', initials);
      updateAuthUI();
    }

    function setAvatarContent(id, initials){
      const el = document.getElementById(id);
      if(!el) return;
      if(profile.photoData){
        el.innerHTML = '<img src="' + profile.photoData + '" alt="Profil rasmi">';
      } else {
        el.textContent = initials || 'AI';
      }
    }

    function getInitials(name){
      return (name || 'AI').split(' ').filter(Boolean).map(x => x[0]).slice(0,2).join('').toUpperCase();
    }

    function loadProfileToEdit(){
      const editName = document.getElementById('editName');
      if(!editName) return;
      editName.value = profile.fullName;
      document.getElementById('editPhone').value = profile.phone;
      document.getElementById('editSubject').value = profile.subject;
      document.getElementById('editGrade').value = profile.grade;
      document.getElementById('editNeed').value = profile.need;
      document.getElementById('profileSuccess').classList.remove('show');
      syncProfileUI();
    }

    async function saveProfile(){
      profile.fullName = document.getElementById('editName').value.trim() || 'Ustoz';
      profile.phone = document.getElementById('editPhone').value.trim();
      profile.subject = document.getElementById('editSubject').value;
      profile.grade = document.getElementById('editGrade').value;
      profile.need = document.getElementById('editNeed').value;

      const genSubject = document.getElementById('genSubject');
      if(genSubject) genSubject.value = profile.subject;
      syncProfileUI();
      saveState();
      updateAuthUI();
      document.getElementById('profileSuccess').classList.add('show');

      await trackEvent("profile_updated", {
        full_name: profile.fullName,
        phone: profile.phone,
        subject: profile.subject,
        grade: profile.grade,
        main_need: profile.need
      });

      toast('Profil yangilandi');
    }

    function handlePhotoUpload(event){
      const file = event.target.files && event.target.files[0];
      if(!file) return;
      if(!file.type.startsWith('image/')){
        toast('Faqat rasm fayl tanlang');
        return;
      }
      const reader = new FileReader();
      reader.onload = function(e){
        profile.photoData = e.target.result;
        syncProfileUI();
        saveState();
        toast('Profil rasmi joylashtirildi');
        trackEvent("profile_photo_uploaded", { file_type: file.type, file_size: file.size });
      };
      reader.readAsDataURL(file);
    }

    function removePhoto(){
      profile.photoData = '';
      document.getElementById('photoInput').value = '';
      syncProfileUI();
      saveState();
      toast('Profil rasmi olib tashlandi');
      trackEvent("profile_photo_removed");
    }

    function focusGenerator(){
      showDashTab('generator');
      setTimeout(() => {
        const block = document.getElementById('generatorBlock');
        if(block) block.scrollIntoView({behavior:'smooth', block:'start'});
      }, 100);
    }

    function presetDoc(type){
      showDashTab('generator');
      document.getElementById('docType').value = type;
      toast(type + ' generatori tanlandi');
      trackEvent("quick_action_click", { doc_type: type });
    }

    async function generateDoc(){
  if (isGenerating) {
    toast("AI javob tayyorlayapti. Kuting.");
    return;
  }

  const now = Date.now();

  if (now - lastGenerateTime < GENERATE_COOLDOWN_MS) {
    const wait = Math.ceil((GENERATE_COOLDOWN_MS - (now - lastGenerateTime)) / 1000);
    toast(wait + " soniyadan keyin qayta urinib ko‘ring.");
    return;
  }

  isGenerating = true;
  lastGenerateTime = now;

  const type = document.getElementById('docType').value;
  const subject = document.getElementById('genSubject').value;
  const grade = document.getElementById('genGrade').value;
  const topic = document.getElementById('topic').value || 'Mavzu kiritilmagan';

  const btn = document.getElementById('generateBtn');
  const oldBtnText = btn ? btn.textContent : '';

  if(btn){
    btn.textContent = 'AI javob tayyorlanmoqda...';
    btn.disabled = true;
  }

  await trackEvent("generator_click", {
    doc_type: type,
    subject,
    grade,
    topic
  });

  let aiContent = "";
  let aiMode = "gemini";

  try {
    const aiResult = await callGenerateFunction({
      docType: type,
      subject,
      grade,
      topic
    });

    aiContent = aiResult.content || "";
    aiMode = aiResult.mode || "gemini";

    if (!aiContent.trim()) {
      throw new Error("AI bo‘sh javob qaytardi");
    }

  } catch(err) {
    console.warn("AI function error:", err);

    await trackEvent("ai_function_error", {
      message: String(err),
      doc_type: type,
      subject,
      grade,
      topic
    });

    toast("AI javob bermadi. 10–15 soniyadan keyin qayta urinib ko‘ring.");
    return;

  } finally {
    isGenerating = false;

    if(btn){
      btn.textContent = oldBtnText || 'AI bilan yaratish';
      btn.disabled = false;
    }
  }

  totalDocs += 1;

  const items = splitAIContentToItems(aiContent);
  const content = aiContent || buildPlainText(type, subject, grade, topic, items);

  currentDoc = {
    id: Date.now(),
    type,
    subject,
    grade,
    topic,
    title: type + ' - ' + topic,
    content,
    items,
    createdAt: new Date().toLocaleString('uz-UZ'),
    paidDownload: false,
    aiMode
  };

  documents.unshift(currentDoc);
  saveState();

  await saveDocumentToSupabase(currentDoc);

  const emptyState = document.getElementById('emptyState');
  if(emptyState) emptyState.style.display = 'none';

  document.getElementById('docOutput').classList.add('show');
  document.getElementById('outputTitle').textContent = type + ' preview';
  document.getElementById('outputMeta').textContent =
    subject + ' • ' + grade + ' • Mavzu: ' + topic + ' • Rejim: ' + aiMode;

  const outputBody = document.getElementById('outputBody');
  const outputList = document.getElementById('outputList');

 if(outputBody){
  if(type.toLowerCase().includes('taqdimot')){
    let slideCount = 0;
    let title = topic;

    try{
      const pptData = JSON.parse(content);
      slideCount = Array.isArray(pptData.slides) ? pptData.slides.length : 0;
      title = pptData.presentationTitle || topic;
    }catch(err){
      slideCount = 0;
    }

    outputBody.innerHTML = `
      <div class="rich-output">
        <p><b>AI taqdimot tayyor.</b></p>
        <p><b>Mavzu:</b> ${escapeHtml(title)}</p>
        <p><b>Slaydlar soni:</b> ${slideCount || 'tayyor'}</p>
        <p>PowerPoint faylni yuklab olish uchun pastdagi tugmani bosing.</p>
      </div>
    `;
  } else {
    outputBody.innerHTML = buildRichHtmlContent(content, type);
  }
} 
 const exportBtn = document.getElementById('exportBtn');

if(exportBtn){
  if(type.toLowerCase().includes('taqdimot')){
    exportBtn.textContent = 'PPTX yuklab olish';
    exportBtn.classList.add('pptx');
  } else {
    exportBtn.textContent = 'Word yuklab olish';
    exportBtn.classList.remove('pptx');
  }
}else if(outputList){
    outputList.innerHTML = '';

    items.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      outputList.appendChild(li);
    });
  }
      else if(outputList){
    outputList.innerHTML = '';

    items.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      outputList.appendChild(li);
    });
  }


  updateUsageUI();
  renderDocuments();

  await trackEvent("ai_result_rendered", {
    doc_type: type,
    subject,
    grade,
    topic,
    mode: aiMode,
    content_length: content.length
  });

  toast(aiMode === 'gemini' ? 'Gemini AI javobi tayyor' : 'AI javob tayyorlandi');
}

    async function callGenerateFunction(payload){
  const response = await fetch('/api/generate-ai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();

  let data;
  try{
    data = JSON.parse(text);
  }catch(err){
    console.error("API raw response:", text);
    throw new Error("API JSON qaytarmadi: " + text);
  }

  if(!response.ok){
    console.error("API error data:", data);
    throw new Error(data.error || data.details || "API xatosi");
  }

  if(!data.ok){
    console.error("API not ok:", data);
    throw new Error(data.error || "AI javob bermadi");
  }

  return data;
}

    function normalizeAIContent(rawContent, type){
      let text = String(rawContent || '')
        .replace(/\r/g, '')
        .replace(/\*\*/g, '')
        .replace(/`/g, '')
        .replace(/^#{1,6}\s*/gm, '')
        .replace(/---+/g, '\n\n')
        .replace(/[ \t]+\n/g, '\n')
        .trim();

      text = text.replace(/\s+(\d+\.\s)/g, '\n$1');
      text = text.replace(/\s+([A-D])\)\s+/g, '\n$1) ');
      text = text.replace(/\s+(Javoblar kaliti:)/gi, '\n$1');
      text = text.replace(/\s+(Izoh:)/gi, '\n\n$1');

      text = text
        .split('\n')
        .map(line => line.replace(/[ \t]{2,}/g, ' ').trimEnd())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      return text;
    }

    function splitAIContentToItems(content){
      const text = normalizeAIContent(content);
      if(!text) return ['AI javob bo‘sh qaytdi.'];

      const numberedBlocks = text.match(/(?:^|\n)\d+\.\s[\s\S]*?(?=(?:\n\d+\.\s)|$)/g);
      if(numberedBlocks && numberedBlocks.length){
        return numberedBlocks
          .map(block => block.replace(/^\s*\d+\.\s*/, '').trim())
          .slice(0, 80);
      }

      return text
        .split(/\n{2,}|\n+/)
        .map(line => line.trim())
        .filter(Boolean)
        .slice(0, 80);
    }

    function buildRichHtmlContent(content, type){
      const text = normalizeAIContent(content, type);
      if(!text) return '<div class="rich-output"><p>AI javob bo‘sh qaytdi.</p></div>';

      const firstQuestionIndex = text.search(/(?:^|\n)\d+\.\s/);
      let html = '<div class="rich-output">';

      if(firstQuestionIndex !== -1){
        const intro = text.slice(0, firstQuestionIndex).trim();
        const rest = text.slice(firstQuestionIndex).trim();

        if(intro){
          intro.split(/\n{2,}/).forEach(par => {
            const p = par.trim();
            if(p){
              html += '<p>' + escapeHtml(p).replace(/\n/g, '<br>') + '</p>';
            }
          });
        }

        const blocks = rest.match(/(?:^|\n)\d+\.\s[\s\S]*?(?=(?:\n\d+\.\s)|$)/g) || [];
        html += '<ol>';

        blocks.forEach(block => {
          let item = block.replace(/^\s*\d+\.\s*/, '').trim();
          let mainText = item;
          let answerKey = '';

          const answerMatch = item.match(/\nJavoblar kaliti:[\s\S]*$/i);
          if(answerMatch){
            answerKey = answerMatch[0].trim();
            mainText = item.slice(0, answerMatch.index).trim();
          }

          const optionMatches = mainText.match(/\n[A-D]\)\s[^\n]*/g) || [];
          let questionText = mainText.replace(/\n[A-D]\)\s[^\n]*/g, '').trim();

          html += '<li>';
          html += '<div>' + escapeHtml(questionText).replace(/\n/g, '<br>') + '</div>';

          if(optionMatches.length){
            html += '<div class="options">';
            optionMatches.forEach(opt => {
              html += '<div>' + escapeHtml(opt.trim()) + '</div>';
            });
            html += '</div>';
          }

          if(answerKey){
            html += '<div class="answer-key">' + escapeHtml(answerKey) + '</div>';
          }

          html += '</li>';
        });

        html += '</ol>';
      } else {
        text.split(/\n{2,}/).forEach(par => {
          const p = par.trim();
          if(p){
            html += '<p>' + escapeHtml(p).replace(/\n/g, '<br>') + '</p>';
          }
        });
      }

      html += '</div>';
      return html;
    }

    function buildDemoContent(type, subject, grade, topic){
      const items = buildDocumentItems(type, topic);
      return [
        'O‘qituvchi AI demo javobi',
        'Hujjat turi: ' + type,
        'Fan: ' + subject,
        'Sinf: ' + grade,
        'Mavzu: ' + topic,
        '',
        ...items.map((item, index) => (index + 1) + '. ' + item),
        '',
        'Izoh: Netlify Function yoki Gemini API javobida muammo bo‘lsa, shu fallback javob chiqadi.'
      ].join('\n');
    }

    function buildDocumentItems(type, topic){
      if(type === 'Test'){
        return [
          topic + ' mavzusi bo‘yicha asosiy tushuncha qaysi?',
          'Quyidagi javoblardan to‘g‘risini belgilang.',
          'Sanoq sistemasida asos va raqamlar qanday bog‘lanadi?',
          'Ikkilik sanoq sistemasiga oid misolni yeching.',
          'Javoblar kaliti: 1-A, 2-C, 3-B, 4-D.'
        ];
      }
      if(type === 'Dars ishlanma'){
        return [
          'Dars mavzusi: ' + topic,
          'Dars maqsadi: o‘quvchilarda mavzu bo‘yicha tushuncha hosil qilish.',
          'Yangi mavzu bayoni: asosiy tushunchalar izohlanadi.',
          'Mustahkamlash: savol-javob va kichik amaliy topshiriq.',
          'Uyga vazifa: mavzu bo‘yicha mashqlar bajarish.'
        ];
      }
      if(type === 'Hisobot'){
        return [
          'Hisobot mavzusi: ' + topic,
          'Amalga oshirilgan ishlar qisqacha bayon qilinadi.',
          'O‘quvchilar ishtiroki va natijalar ko‘rsatiladi.',
          'Muammolar va takliflar beriladi.',
          'Xulosa rasmiy uslubda yakunlanadi.'
        ];
      }
      return [
        '1-slayd: Mavzu va maqsad.',
        '2-slayd: Asosiy tushunchalar.',
        '3-slayd: Misollar va vizual diagramma.',
        '4-slayd: Mustahkamlash savollari.',
        '5-slayd: Xulosa va uyga vazifa.'
      ];
    }

    function buildPlainText(type, subject, grade, topic, items){
      return [
        'O‘qituvchi AI',
        'Hujjat turi: ' + type,
        'Fan: ' + subject,
        'Sinf: ' + grade,
        'Mavzu: ' + topic,
        '',
        ...items.map((item, index) => (index + 1) + '. ' + item),
        '',
        'Izoh: Bu demo prototip orqali yaratilgan namunaviy hujjat.'
      ].join('\\n');
    }

    function renderDocuments(){
      const box = document.getElementById('docsList');
      if(!box) return;
      if(documents.length === 0){
        box.innerHTML = '<div class="empty-docs"><div style="font-size:40px">📄</div><b>Hali fayl yo‘q</b><p>AI generator orqali hujjat yaratsangiz, shu yerga tushadi.</p></div>';
        return;
      }

      let rows = documents.map(doc => `
        <tr>
          <td><strong>${escapeHtml(doc.title)}</strong><br><span style="color:#66758b">${escapeHtml(doc.createdAt)}</span></td>
          <td>${escapeHtml(doc.type)}</td>
          <td>${escapeHtml(doc.subject)} / ${escapeHtml(doc.grade)}</td>
          <td>
            <button class="small-btn green" onclick="downloadDoc(${doc.id}, 'doc')">Yuklab olish</button>
            <button class="small-btn red" onclick="deleteDoc(${doc.id})">O‘chirish</button>
          </td>
        </tr>
      `).join('');

      box.innerHTML = `
        <table class="doc-table">
          <thead>
            <tr><th>Fayl</th><th>Tur</th><th>Fan / Sinf</th><th>Amal</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }

    function escapeHtml(str){
      return String(str).replace(/[&<>"']/g, s => ({
        '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
      }[s]));
    }

    function deleteDoc(id){
      documents = documents.filter(doc => doc.id !== id);
      if(currentDoc && currentDoc.id === id) currentDoc = null;
      saveState();
      renderDocuments();
      toast('Fayl tarixdan o‘chirildi');
      trackEvent("document_deleted", { local_document_id: id });
    }

    function clearDocuments(){
      documents = [];
      currentDoc = null;
      totalDocs = 0;
      saveState();
      renderDocuments();
      toast('Fayllar tarixi tozalandi');
      trackEvent("documents_cleared");
    }

    function downloadCurrentTxt(){
      if(!currentDoc){
        toast('Avval hujjat yarating');
        return;
      }
      downloadDoc(currentDoc.id, 'doc');
    }

    function handleExport(){
      if(currentDoc && currentDoc.type.toLowerCase().includes('taqdimot')){
        downloadPresentationPptx();
        return;
      }
      if(!currentDoc){
        toast('Avval hujjat yarating');
        return;
      }
      async function downloadPresentationPptx(){
  if(!currentDoc){
    toast("Avval taqdimot yarating.");
    return;
  }

  const PptxLib = window.PptxGenJS;

if(!PptxLib){
  toast("PPTX kutubxonasi yuklanmadi.");
  return;
}

  let data;

  try{
    data = JSON.parse(currentDoc.content);
  }catch(err){
    toast("AI taqdimot JSON formatda kelmadi.");
    console.error(err);
    return;
  }

  const pptx = new PptxLib();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "O‘qituvchi AI";
  pptx.subject = data.subject || currentDoc.subject || "";
  pptx.title = data.presentationTitle || currentDoc.topic || "Taqdimot";

  const slides = Array.isArray(data.slides) ? data.slides : [];

  slides.forEach((s, index) => {
    if(s.type === "title"){
      addAiTitleSlide(pptx, s, data);
    } else if(s.type === "comparison"){
      addAiComparisonSlide(pptx, s, index + 1);
    } else if(s.type === "process"){
      addAiProcessSlide(pptx, s, index + 1);
    } else if(s.type === "example"){
      addAiExampleSlide(pptx, s, index + 1);
    } else if(s.type === "activity"){
      addAiActivitySlide(pptx, s, index + 1);
    } else if(s.type === "summary"){
      addAiSummarySlide(pptx, s, index + 1);
    } else {
      addAiContentSlide(pptx, s, index + 1);
    }
  });

  const fileName = safeFileName(data.presentationTitle || currentDoc.title || "taqdimot") + ".pptx";
  await pptx.writeFile({ fileName });

  toast("PPTX fayl yuklandi.");
}
      downloadDoc(currentDoc.id, 'doc');
    }
    const PPT = {
  dark: "07101D",
  light: "F8FBFF",
  primary: "5B7CFF",
  accent: "22D3EE",
  text: "10213D",
  soft: "607086",
  white: "FFFFFF"
};

function addAiHeader(slide, pptx, num){
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 13.33, h: 0.72,
    fill: { color: PPT.dark },
    line: { color: PPT.dark }
  });

  slide.addText("O‘qituvchi AI", {
    x: 0.55, y: 0.21, w: 3, h: 0.3,
    fontFace: "Arial", fontSize: 12,
    color: PPT.white, bold: true
  });

  slide.addText(String(num).padStart(2, "0"), {
    x: 11.8, y: 0.18, w: 0.9, h: 0.3,
    fontFace: "Arial", fontSize: 13,
    color: PPT.accent, bold: true,
    align: "right"
  });
}

function addAiTitleSlide(pptx, s, data){
  const slide = pptx.addSlide();
  slide.background = { color: PPT.dark };

  slide.addText("O‘qituvchi AI", {
    x: 0.7, y: 0.55, w: 4, h: 0.4,
    fontFace: "Arial", fontSize: 17,
    color: "A8B5CB", bold: true
  });

  slide.addText(s.title || data.presentationTitle || "Taqdimot", {
    x: 0.7, y: 1.7, w: 8.6, h: 1.3,
    fontFace: "Arial", fontSize: 42,
    color: PPT.white, bold: true,
    fit: "shrink"
  });

  slide.addText(s.subtitle || "", {
    x: 0.75, y: 3.25, w: 6, h: 0.5,
    fontFace: "Arial", fontSize: 20,
    color: "DCE8FB"
  });

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 9.4, y: 1.45, w: 2.8, h: 2.8,
    rectRadius: 0.18,
    fill: { color: PPT.primary },
    line: { color: PPT.accent }
  });

  slide.addText("AI", {
    x: 9.8, y: 2.08, w: 2, h: 1,
    fontFace: "Arial", fontSize: 50,
    color: PPT.white, bold: true,
    align: "center"
  });
}

function addAiContentSlide(pptx, s, num){
  const slide = pptx.addSlide();
  slide.background = { color: PPT.light };
  addAiHeader(slide, pptx, num);

  slide.addText(s.title || "Slayd", {
    x: 0.7, y: 1.12, w: 10.5, h: 0.6,
    fontFace: "Arial", fontSize: 31,
    color: PPT.text, bold: true,
    fit: "shrink"
  });

  const bullets = (s.bullets || []).slice(0, 5).map(t => ({
    text: t,
    options: { bullet: { type: "ul" } }
  }));

  slide.addText(bullets, {
    x: 0.95, y: 2.05, w: 7.4, h: 4.4,
    fontFace: "Arial", fontSize: 20,
    color: "26364D",
    breakLine: true,
    paraSpaceAfterPt: 12,
    fit: "shrink"
  });

  addVisualCard(slide, pptx, s.visual || "concept_icon");
}

function addAiComparisonSlide(pptx, s, num){
  const slide = pptx.addSlide();
  slide.background = { color: PPT.light };
  addAiHeader(slide, pptx, num);

  slide.addText(s.title || "Taqqoslash", {
    x: 0.7, y: 1.05, w: 11, h: 0.6,
    fontFace: "Arial", fontSize: 30,
    color: PPT.text, bold: true
  });

  addCompareBox(slide, pptx, 0.85, 2.05, s.leftTitle, s.leftPoints, PPT.primary);
  addCompareBox(slide, pptx, 6.85, 2.05, s.rightTitle, s.rightPoints, PPT.accent);
}

function addCompareBox(slide, pptx, x, y, title, points, color){
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w: 5.25, h: 3.9,
    rectRadius: 0.16,
    fill: { color: "FFFFFF" },
    line: { color }
  });

  slide.addText(title || "Bo‘lim", {
    x: x + 0.3, y: y + 0.25, w: 4.5, h: 0.4,
    fontFace: "Arial", fontSize: 22,
    bold: true,
    color
  });

  const bullets = (points || []).slice(0, 4).map(t => ({
    text: t,
    options: { bullet: { type: "ul" } }
  }));

  slide.addText(bullets, {
    x: x + 0.45, y: y + 1.05, w: 4.3, h: 2.5,
    fontFace: "Arial", fontSize: 16,
    color: "26364D",
    breakLine: true,
    paraSpaceAfterPt: 8
  });
}

function addAiProcessSlide(pptx, s, num){
  const slide = pptx.addSlide();
  slide.background = { color: PPT.light };
  addAiHeader(slide, pptx, num);

  slide.addText(s.title || "Jarayon", {
    x: 0.7, y: 1.05, w: 11, h: 0.6,
    fontFace: "Arial", fontSize: 30,
    color: PPT.text, bold: true
  });

  const steps = (s.steps || []).slice(0, 5);
  steps.forEach((step, i) => {
    const x = 0.85 + i * 2.45;
    slide.addShape(pptx.ShapeType.ellipse, {
      x, y: 2.4, w: 0.75, h: 0.75,
      fill: { color: PPT.primary },
      line: { color: PPT.primary }
    });

    slide.addText(String(i + 1), {
      x, y: 2.57, w: 0.75, h: 0.3,
      fontSize: 15, bold: true,
      color: PPT.white,
      align: "center"
    });

    slide.addText(step, {
      x: x - 0.25, y: 3.35, w: 1.5, h: 1.2,
      fontSize: 15,
      color: PPT.text,
      align: "center",
      fit: "shrink"
    });

    if(i < steps.length - 1){
      slide.addShape(pptx.ShapeType.line, {
        x: x + 0.82, y: 2.78, w: 1.25, h: 0,
        line: { color: PPT.accent, width: 2, beginArrowType: "none", endArrowType: "triangle" }
      });
    }
  });
}

function addAiExampleSlide(pptx, s, num){
  const slide = pptx.addSlide();
  slide.background = { color: PPT.light };
  addAiHeader(slide, pptx, num);

  slide.addText(s.title || "Amaliy misol", {
    x: 0.7, y: 1.05, w: 11, h: 0.6,
    fontFace: "Arial", fontSize: 30,
    color: PPT.text, bold: true
  });

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.85, y: 2.0, w: 5.4, h: 3.8,
    rectRadius: 0.16,
    fill: { color: "FFFFFF" },
    line: { color: "D7E8FB" }
  });

  slide.addText(s.exampleTitle || "Misol", {
    x: 1.15, y: 2.3, w: 4.8, h: 0.4,
    fontSize: 22,
    bold: true,
    color: PPT.primary
  });

  slide.addText(s.exampleText || "", {
    x: 1.15, y: 2.95, w: 4.65, h: 1.5,
    fontSize: 17,
    color: PPT.text,
    fit: "shrink"
  });

  const steps = (s.solutionSteps || []).slice(0, 4).map(t => ({
    text: t,
    options: { bullet: { type: "ul" } }
  }));

  slide.addText(steps, {
    x: 7.0, y: 2.1, w: 5.0, h: 3.8,
    fontSize: 18,
    color: "26364D",
    breakLine: true,
    paraSpaceAfterPt: 10
  });
}

function addAiActivitySlide(pptx, s, num){
  const slide = pptx.addSlide();
  slide.background = { color: PPT.dark };

  slide.addText(s.title || "Interaktiv topshiriq", {
    x: 0.75, y: 0.9, w: 11.5, h: 0.8,
    fontSize: 34,
    bold: true,
    color: PPT.white
  });

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.9, y: 2.05, w: 11.5, h: 3.8,
    rectRadius: 0.18,
    fill: { color: "FFFFFF", transparency: 5 },
    line: { color: PPT.accent }
  });

  slide.addText(s.task || "Topshiriq", {
    x: 1.25, y: 2.35, w: 10.6, h: 0.7,
    fontSize: 21,
    bold: true,
    color: PPT.text
  });

  const inst = (s.instructions || []).slice(0, 4).map(t => ({
    text: t,
    options: { bullet: { type: "ul" } }
  }));

  slide.addText(inst, {
    x: 1.35, y: 3.25, w: 10.2, h: 2.1,
    fontSize: 18,
    color: "26364D",
    breakLine: true
  });
}

function addAiSummarySlide(pptx, s, num){
  const slide = pptx.addSlide();
  slide.background = { color: PPT.dark };

  slide.addText(s.title || "Xulosa", {
    x: 0.8, y: 0.9, w: 11, h: 0.8,
    fontSize: 36,
    bold: true,
    color: PPT.white
  });

  const bullets = (s.bullets || []).slice(0, 5);

  bullets.forEach((b, i) => {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.9, y: 2.0 + i * 0.82, w: 11.3, h: 0.58,
      rectRadius: 0.14,
      fill: { color: "FFFFFF", transparency: 8 },
      line: { color: PPT.primary, transparency: 25 }
    });

    slide.addText("✓ " + b, {
      x: 1.15, y: 2.11 + i * 0.82, w: 10.7, h: 0.35,
      fontSize: 18,
      color: PPT.white,
      bold: true
    });
  });
}

function addVisualCard(slide, pptx, visual){
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 9.0, y: 2.05, w: 3.35, h: 3.2,
    rectRadius: 0.18,
    fill: { color: "EAF1FF" },
    line: { color: "D7E8FB" }
  });

  slide.addText("Vizual", {
    x: 9.25, y: 2.35, w: 2.8, h: 0.4,
    fontSize: 16,
    color: PPT.primary,
    bold: true
  });

  slide.addText(visual || "diagram", {
    x: 9.25, y: 2.95, w: 2.8, h: 0.5,
    fontSize: 14,
    color: PPT.soft
  });

  slide.addShape(pptx.ShapeType.hexagon, {
    x: 10.15, y: 3.75, w: 1.2, h: 1.1,
    fill: { color: PPT.primary, transparency: 10 },
    line: { color: PPT.accent }
  });
}
    function safeFileName(name){
  return String(name || 'fayl')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80);
}
async function downloadDoc(id, format) {
  const doc = documents.find(d => d.id === id);
  if (!doc) { toast('Fayl topilmadi'); return; }

  await trackEvent("download_click", {
    local_document_id: id,
    title: doc.title,
    doc_type: doc.type,
    subject: doc.subject,
    grade: doc.grade,
    format
  });

  if (!canDownload(doc)) {
    await trackEvent("paywall_shown", {
      reason: "balance_or_pro_quota_not_enough",
      local_document_id: id,
      balance,
      pro_files_left: proFilesLeft
    });
    showUpgradeModal('Fayl yuklab olish uchun Donabay balansda kamida 1 000 so\'m bo\'lishi yoki Pro fayl kvotasi kerak.');
    return;
  }

  chargeDownload(doc);

  // PPTX
  if (doc.type?.toLowerCase().includes('taqdimot')) {
    currentDoc = doc;
    await downloadHybridPptx();
    return;
  }

  // WORD — docx.js
  if (!window.docx) {
    toast('docx kutubxonasi yuklanmagan');
    return;
  }

  const { Document, Packer, Paragraph, TextRun,
          Table, TableRow, TableCell,
          WidthType, BorderStyle } = window.docx;

  const content = doc.content || (doc.items || []).join('\n');
  const isTest  = doc.type?.toLowerCase().includes('test');
  const margins = { top: 567, bottom: 567, left: 1701, right: 1134 };

  function txt(text, opts = {}) {
    return new TextRun({ font: 'Times New Roman', size: opts.size || 20, ...opts, text: String(text) });
  }
  function para(children, spAfter = 60, spBefore = 0) {
    return new Paragraph({ children, spacing: { after: spAfter, before: spBefore } });
  }
  function parseMeta(text) {
    return {
      fan:   text.match(/Fan:\s*(.+)/i)?.[1]?.trim()   || doc.subject || '',
      sinf:  text.match(/Sinf:\s*(.+)/i)?.[1]?.trim()  || doc.grade   || '',
      mavzu: text.match(/Mavzu:\s*(.+)/i)?.[1]?.trim() || doc.topic   || '',
    };
  }
  function parseQuestions(text) {
    const qs = []; let cur = null;
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      const qm = line.match(/^(\d+)\.\s+(.+)/);
      if (qm) { if (cur) qs.push(cur); cur = { num: +qm[1], text: qm[2], opts: [] }; continue; }
      const om = line.match(/^([A-D])\)\s*(.+)/);
      if (om && cur) cur.opts.push({ l: om[1], t: om[2] });
    }
    if (cur) qs.push(cur);
    return qs;
  }
  function parseKey(text) {
    const m = text.match(/Javoblar kaliti[\s\S]*/i);
    return m ? m[0].trim() : '';
  }
  function makeQBlock(q) {
    if (!q) return [para([txt(' ')], 40)];
    const ps = [para([txt(`${q.num}. ${q.text}`, { bold: true, size: 20 })], 20, 80)];
    for (const o of (q.opts || [])) ps.push(para([txt(`${o.l}) ${o.t}`, { size: 19 })], 10));
    return ps;
  }
  function makeCell(children, rightBorder) {
    return new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      borders: {
        top:    { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left:   { style: BorderStyle.NONE },
        right:  rightBorder
          ? { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }
          : { style: BorderStyle.NONE },
      },
      margins: { left: 100, right: 100 },
      children,
    });
  }

  let sections;

  if (isTest) {
    const meta = parseMeta(content);
    const qs   = parseQuestions(content);
    const key  = parseKey(content);
    const half = Math.ceil(qs.length / 2);
    const lQs  = qs.slice(0, half);
    const rQs  = qs.slice(half);

    const header = [
      para([txt(`Test – ${meta.mavzu}`, { bold: true, size: 26 })], 80),
      para([txt('Fan: ', { bold: true }), txt(meta.fan)], 40),
      para([txt('Sinf: ', { bold: true }), txt(meta.sinf)], 40),
      para([txt('Mavzu: ', { bold: true }), txt(meta.mavzu)], 140),
    ];

    const rows = [];
    for (let i = 0; i < Math.max(lQs.length, rQs.length); i++) {
      rows.push(new TableRow({
        children: [
          makeCell(makeQBlock(lQs[i]), true),
          makeCell(makeQBlock(rQs[i]), false),
        ]
      }));
    }

    const keyParas = key.split('\n')
      .filter(l => l.trim())
      .map((line, i) => para([txt(line.trim(), { bold: i === 0, size: 18 })], 30));

    sections = [{
      properties: { page: { margin: margins } },
      children: [
        ...header,
        new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }),
        para([txt('')], 0, 180),
        ...keyParas,
      ],
    }];

  } else {
    const children = content.split('\n').map(line => {
      const t = line.trim();
      const isH = /^(DARS ISHLANMA|HISOBOT|TEST|Darsning maqsadi|Javoblar kaliti|Kirish:|Xulosa:)/i.test(t)
               || /^[A-ZЁĞQO'\u0400-\u04FF][A-ZЁĞQO'\s\u0400-\u04FF]{4,}:$/.test(t);
      return para([txt(t || ' ', { bold: isH, size: isH ? 24 : 22 })], isH ? 120 : 60);
    });
    sections = [{ properties: { page: { margin: margins } }, children }];
  }

  try {
    const blob = await Packer.toBlob(new Document({ sections }));
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = (doc.title || 'hujjat').replace(/[^\w\s\-]/g, '').trim() + '.docx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    totalDownloads++;
    saveState();
    updateUsageUI();
    toast('Word fayl yuklandi ✓');

    await trackEvent('document_downloaded', {
      doc_type: doc.type,
      subject:  doc.subject,
      topic:    doc.topic,
    });
  } catch(err) {
    console.error('downloadDoc word error:', err);
    toast('Xatolik: ' + err.message);
  }
}
    // async function downloadDoc(id, format){
    //   const doc = documents.find(d => d.id === id);
    //   if(!doc){
    //     toast('Fayl topilmadi');
    //     return;
    //   }

    //   await trackEvent("download_click", {
    //     local_document_id: id,
    //     title: doc.title,
    //     doc_type: doc.type,
    //     subject: doc.subject,
    //     grade: doc.grade,
    //     format
    //   });

    //   if(!canDownload(doc)){
    //     await trackEvent("paywall_shown", {
    //       reason: "balance_or_pro_quota_not_enough",
    //       local_document_id: id,
    //       balance,
    //       pro_files_left: proFilesLeft
    //     });
    //     showUpgradeModal('Fayl yuklab olish uchun Donabay balansda kamida 1 000 so‘m bo‘lishi yoki Pro fayl kvotasi kerak.');
    //     return;
    //   }

    //   chargeDownload(doc);

    //   const safeName = (doc.title || 'hujjat').replace(/[\\/:*?"<>|]/g, '_').replace(/\\s+/g, '_').toLowerCase();
    //   const htmlContent = `
    //     <html>
    //     <head>
    //       <meta charset="UTF-8">
    //       <title>${escapeHtml(doc.title)}</title>
    //       <style>
    //         body{font-family:"Times New Roman",serif;font-size:14pt;line-height:1.7;margin:34px;color:#111}
    //         h2{margin:0 0 16px}
    //         .meta{margin:0 0 22px}
    //         .meta div{margin:2px 0}
    //         p{margin:0 0 14px;text-align:justify}
    //         ol{margin:0; padding-left:28px}
    //         li{margin:0 0 14px}
    //         .options{margin-top:8px; padding-left:14px}
    //         .options div{margin:4px 0}
    //         .answer-key{margin-top:8px;font-weight:700}
            
    //       <>
    //     </head>
    //     <body>
    //       <h2>${escapeHtml(doc.title)}</h2>
    //       <div class="meta">
    //         <div><b>Fan:</b> ${escapeHtml(doc.subject)}</div>
    //         <div><b>Sinf:</b> ${escapeHtml(doc.grade)}</div>
    //         <div><b>Mavzu:</b> ${escapeHtml(doc.topic)}</div>
    //       </div>
    //       ${buildRichHtmlContent(doc.content || doc.items.join('\n'), doc.type)}
    //     </body>
    //     </html>`;
    //   downloadBlob(htmlContent, safeName + '.doc', 'application/msword');
    //   totalDownloads += 1;
    //   saveState();
    //   updateUsageUI();

    //   await trackEvent("download_success", {
    //     local_document_id: id,
    //     title: doc.title,
    //     charged_plan: currentPlan,
    //     charged_amount: currentPlan === 'Donabay' ? FILE_PRICE : 0
    //   });

    //   toast('Fayl yuklab olindi');
    // }

    function canDownload(doc){
      if(currentPlan === 'Pro') return proFilesLeft > 0;
      return balance >= FILE_PRICE;
    }

    function chargeDownload(doc){
      if(currentPlan === 'Pro'){
        proFilesLeft = Math.max(0, proFilesLeft - 1);
      } else {
        balance = Math.max(0, balance - FILE_PRICE);
      }
      doc.paidDownload = true;
      saveState();
    }

    function downloadBlob(content, filename, type){
      const blob = new Blob([content], {type});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    function updateUsageUI(){
      const usedCount = document.getElementById('usedCount');
      if(usedCount) usedCount.textContent = totalDownloads;

      const kpiTrial = document.getElementById('kpiTrial');
      if(kpiTrial) kpiTrial.textContent = formatMoney(balance);

      const trialProgress = document.getElementById('trialProgress');
      if(trialProgress) trialProgress.style.width = currentPlan === 'Pro' ? (proFilesLeft / PRO_FILE_LIMIT * 100) + '%' : Math.min(100, balance / MIN_TOPUP * 100) + '%';

      const kpiDocs = document.getElementById('kpiDocs');
      if(kpiDocs) kpiDocs.textContent = totalDocs;

      const kpiTime = document.getElementById('kpiTime');
      if(kpiTime) kpiTime.textContent = (totalDocs * 0.6).toFixed(1) + ' soat';

      const planLabel = document.getElementById('planLabel');
      if(planLabel) planLabel.textContent = currentPlan;

      const kpiPlan = document.getElementById('kpiPlan');
      if(kpiPlan) kpiPlan.textContent = currentPlan;

      const subPlanPill = document.getElementById('subPlanPill');
      if(subPlanPill){
        subPlanPill.textContent = currentPlan;
        subPlanPill.className = 'pill pro';
      }

      const pill = document.getElementById('generatorPlanPill');
      if(pill){
        pill.textContent = currentPlan;
        pill.className = 'pill pro';
      }

      const balanceAmount = document.getElementById('balanceAmount');
      if(balanceAmount) balanceAmount.textContent = formatNumber(balance);
      const balanceAmountSub = document.getElementById('balanceAmountSub');
      if(balanceAmountSub) balanceAmountSub.textContent = formatNumber(balance);
      const proFilesLeftEl = document.getElementById('proFilesLeft');
      if(proFilesLeftEl) proFilesLeftEl.textContent = proFilesLeft;

      const generateBtn = document.getElementById('generateBtn');
      const limitHelp = document.getElementById('limitHelp');
      if(generateBtn && limitHelp){
        generateBtn.textContent = 'AI bilan yaratish';
        generateBtn.className = 'btn green';
        limitHelp.textContent = 'Preview yaratish demo rejimda ochiq. Faylni yuklab olish Donabay tarifda 1 000 so‘m yoki Pro kvotadan yechiladi.';
      }
    }

    function formatNumber(n){
      return Number(n || 0).toLocaleString('uz-UZ');
    }

    function formatMoney(n){
      return formatNumber(n) + ' so‘m';
    }

    async function showUpgradeModal(reason){
      document.getElementById('modalReason').textContent =
        reason || 'Donabay tarifda fayl yuklab olish 1 000 so‘m. Eng kam hisob to‘ldirish 5 000 so‘m.';
      document.getElementById('upgradeModal').classList.add('show');
      await trackEvent("upgrade_modal_shown", { reason });
    }

    function showTopupModal(){
      showUpgradeModal('Hisobni kamida 5 000 so‘mga to‘ldiring. Har bir fayl yuklab olish 1 000 so‘m.');
    }

    function closeUpgradeModal(){
      document.getElementById('upgradeModal').classList.remove('show');
    }

    async function topupBalance(amount){
      if(amount < MIN_TOPUP){
        toast('Eng kam to‘ldirish 5 000 so‘m');
        return;
      }
      currentPlan = 'Donabay';
      balance += amount;
      saveState();
      closeUpgradeModal();
      updateUsageUI();
      await trackEvent("topup_click", { amount, new_balance: balance });
      toast(formatMoney(amount) + ' balansga qo‘shildi');
    }

    async function upgradePlan(plan){
      if(plan === 'Pro'){
        currentPlan = 'Pro';
        proFilesLeft = PRO_FILE_LIMIT;
        saveState();
        closeUpgradeModal();
        updateUsageUI();
        await trackEvent("pro_click", { price: PRO_PRICE, files: PRO_FILE_LIMIT });
        toast('Pro tarif yoqildi: 100 ta fayl limiti ochildi');
        return;
      }
      currentPlan = 'Donabay';
      saveState();
      closeUpgradeModal();
      updateUsageUI();
      await trackEvent("donabay_plan_click");
      toast('Donabay tarif tanlandi');
    }

    function setPlanFromDashboard(plan){
      if(plan === 'Pro'){
        upgradePlan('Pro');
      } else {
        currentPlan = 'Donabay';
        saveState();
        updateUsageUI();
        trackEvent("donabay_plan_click", { source: "dashboard_subscription" });
        toast('Donabay tarif tanlandi');
      }
    }

    function logoutUser(){
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("oqituvchi_ai_session_id");

      currentPlan = 'Donabay';
      isRegistered = false;
      balance = 0;
      proFilesLeft = 0;
      totalDocs = 0;
      totalDownloads = 0;
      documents = [];
      currentDoc = null;
      profile = {
        fullName: 'Yangi foydalanuvchi',
        phone: '',
        subject: 'Informatika',
        grade: '7–9-sinflar',
        need: 'Test generator',
        photoData: ''
      };

      updateUsageUI();
      renderDocuments();
      syncProfileUI();
      updateAuthUI();
      showPage('home');
      trackEvent("logout_click");
      toast('Profildan chiqildi');
    }
    function escapeHtml(text){
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
    function toast(text){
      const t = document.getElementById('toast');
      t.textContent = text;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 1800);
    }

    const upgradeModal = document.getElementById('upgradeModal');
    if(upgradeModal){
      upgradeModal.addEventListener('click', function(e){
        if(e.target.id === 'upgradeModal') closeUpgradeModal();
      });
    }

    loadState();
    updateUsageUI();
    renderDocuments();
    syncProfileUI();
    protectResultCopy();
    updateAuthUI();
async function downloadHybridPptx(){
  const subject = document.getElementById('genSubject')?.value || 'Informatika';
  const grade = document.getElementById('genGrade')?.value || '7-sinf';
  const topic = document.getElementById('topic')?.value?.trim() || 'Mavzu kiritilmagan';

  const btn = document.getElementById('pptxBtn');
  const oldText = btn ? btn.textContent : '';

  try{
    if(btn){
      btn.disabled = true;
      btn.textContent = 'PPTX tayyorlanmoqda...';
    }

    toast("AI taqdimot tayyorlamoqda...");

    const response = await fetch("/api/generate-pptx", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: `${subject} - ${topic}`,
        subject: subject,
        grade: grade,
        topic: topic,
        slidesCount: 7
      })
    });

    if(!response.ok){
      const text = await response.text();
      console.error("PPTX API error:", text);
      toast("PPTX yaratishda xatolik bo‘ldi.");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    const fileName = `${subject}-${topic}`
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName + ".pptx";
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);

    toast("PPTX yuklab olindi.");
  }catch(err){
    console.error(err);
    toast("PPTX serveriga ulanishda xatolik.");
  }finally{
    if(btn){
      btn.disabled = false;
      btn.textContent = oldText || 'PPTX yaratish';
    }
  }
}
