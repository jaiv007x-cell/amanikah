(function () {
  "use strict";

  var CORE_PLEDGE = {
    en: "I believe a meaningful Nikah should be rooted in mutual respect, consent, sincerity, and a commitment to avoiding dowry demands and unnecessary financial pressure.",
    hi: "मेरा विश्वास है कि एक सार्थक निकाह आपसी सम्मान, सहमति, ईमानदारी पर आधारित होना चाहिए, और दहेज की माँग तथा अनावश्यक आर्थिक दबाव से बचना चाहिए।",
    ur: "میرا یقین ہے کہ ایک بامعنی نکاح باہمی احترام، رضامندی، خلوص پر مبنی ہونا چاہیے، اور جہیز کے مطالبات اور غیر ضروری مالی دباؤ سے اجتناب کرنا چاہیے۔",
    te: "అర్థవంతమైన నికాహ్ పరస్పర గౌరవం, సమ్మతి, నిజాయితీపై ఆధారపడి ఉండాలని, వరకట్న డిమాండ్లు మరియు అనవసరమైన ఆర్థిక ఒత్తిడిని నివారించాలని నేను నమ్ముతున్నాను."
  };

  var MAHR_NOTE = {
    en: "Mahr is the bride’s right in the nikah contract. It is not dowry, and it is not a payment demanded from her family.",
    hi: "महर निकाह अनुबंध में दुल्हन का अधिकार है। यह दहेज नहीं है, और न ही उसके परिवार से माँगा गया भुगतान है।",
    ur: "مہر نکاح کے عقد میں دلہن کا حق ہے۔ یہ جہیز نہیں، اور نہ ہی اس کے خاندان سے مانگی گئی رقم ہے۔",
    te: "మహర్ నికాహ్ ఒప్పందంలో వధువు హక్కు. ఇది వరకట్నం కాదు, ఆమె కుటుంబం నుంచి డిమాండ్ చేసే చెల్లింపు కాదు."
  };

  var I18N = {
    en: {
      dir: "ltr",
      label: "English",
      kicker: "#SimpleNikah",
      title: "A simpler nikah, said in your own words",
      lede: "Take a voluntary pledge against dowry demands and competitive extravagance. Share a card only if you want to. Amanikah never treats a pledge as proof of honesty or religious suitability.",
      meaningTitle: "What this pledge means",
      meaningBody: "It is a personal statement of intent. It does not bind anyone else, create an account, or guarantee a marriage. You may personalise celebration, family, and home preferences without changing the core wording.",
      start: "Begin my pledge",
      stepLang: "Language",
      stepPrefs: "Your preferences",
      stepPrivacy: "Privacy and sharing",
      stepConfirm: "Confirm your pledge",
      stepCard: "Your card",
      celebration: "How should the celebration feel?",
      family: "How should family take part?",
      home: "Where do you hope to live?",
      template: "Card template",
      visibility: "Who can open your link?",
      visPrivate: "Private — download or share text only. No public link.",
      visLink: "Unlisted link — preferences only. No name, photo, or city unless you add a first name.",
      firstName: "Optional first name on the card",
      firstNameHelp: "Leave blank to keep the card anonymous. Never add surnames, photos, or locations here.",
      matching: "Also save these preferences as an optional matching priority on this device",
      matchingHelp: "Taking the pledge is not a character check. Matching, when accounts exist, may only use what you save here.",
      confirmLabel: "I make this pledge of my own free will",
      confirmBtn: "Confirm my #SimpleNikah pledge",
      back: "Back",
      next: "Continue",
      shareWhatsApp: "Share on WhatsApp",
      shareNative: "Share…",
      copyLink: "Copy link",
      copyText: "Copy pledge text",
      downloadOg: "Download 1200×630 image",
      downloadStory: "Download story 1080×1920",
      revoke: "Revoke unlisted link",
      revokeDone: "Link revoked on the server. Visitors who open it will see that it is no longer shown. Downloads or copies already saved elsewhere cannot be recalled.",
      register: "Optionally continue to Find My Match",
      registerHelp: "Registration is still device-local until accounts exist. Your SimpleNikah preferences can travel with that request.",
      recipientTitle: "Someone shared a #SimpleNikah pledge",
      recipientCta: "Make my own pledge",
      explore: "Privately explore Amanikah",
      revokedTitle: "This pledge link is no longer shown",
      revokedBody: "The person who created it revoked the link, or the link is incomplete.",
      statusCopied: "Copied.",
      statusShareBlocked: "Sharing was cancelled or blocked. You can copy the text or download an image instead.",
      statusNeedConfirm: "Please confirm the pledge before continuing.",
      statusPrivateNoLink: "Private mode has no public link. Use WhatsApp text, native share, or download an image.",
      statusLinkReady: "Unlisted link ready. It carries preferences only.",
      statusRevokedNeed: "No active public link to revoke.",
      optCelebration: ["An intimate gathering", "A moderate family celebration", "A large celebration", "We are flexible"],
      optFamily: ["With us from the beginning", "After we both wish to continue", "Supportive, without deciding for us"],
      optHome: ["In the same city", "Open to moving", "Open to life abroad", "Flexible"],
      templates: { emerald: "Emerald night", ivory: "Ivory morning", arch: "Gold arch" },
      cardBrand: "Amanikah",
      cardTag: "#SimpleNikah",
      cardFoot: "amanikah.com/simple-nikah",
      prefsLabel: "My preferences"
    },
    hi: {
      dir: "ltr",
      label: "हिन्दी",
      kicker: "#SimpleNikah",
      title: "सरल निकाह — आपके शब्दों में",
      lede: "दहेज की माँग और दिखावे के विरुद्ध स्वैच्छिक प्रतिज्ञा लें। कार्ड तभी साझा करें जब आप चाहें।",
      meaningTitle: "इस प्रतिज्ञा का अर्थ",
      meaningBody: "यह व्यक्तिगत इरादे का बयान है। यह किसी और को बाध्य नहीं करती, खाता नहीं बनाती, और विवाह की गारंटी नहीं देती।",
      start: "प्रतिज्ञा शुरू करें",
      stepLang: "भाषा",
      stepPrefs: "आपकी प्राथमिकताएँ",
      stepPrivacy: "गोपनीयता और साझाकरण",
      stepConfirm: "प्रतिज्ञा की पुष्टि",
      stepCard: "आपका कार्ड",
      celebration: "समारोह कैसा हो?",
      family: "परिवार की भूमिका?",
      home: "आप कहाँ रहना चाहेंगे?",
      template: "कार्ड टेम्पलेट",
      visibility: "लिंक कौन खोल सकता है?",
      visPrivate: "निजी — केवल पाठ या चित्र। कोई सार्वजनिक लिंक नहीं।",
      visLink: "अनलिस्टेड लिंक — केवल प्राथमिकताएँ। नाम/फ़ोटो/शहर नहीं जब तक आप पहला नाम न लिखें।",
      firstName: "कार्ड पर वैकल्पिक पहला नाम",
      firstNameHelp: "खाली छोड़ें तो कार्ड गुमनाम रहेगा।",
      matching: "इन प्राथमिकताओं को इस डिवाइस पर वैकल्पिक मैचिंग प्राथमिकता के रूप में सहेजें",
      matchingHelp: "प्रतिज्ञा ईमानदारी या धार्मिक उपयुक्तता का प्रमाण नहीं है।",
      confirmLabel: "मैं अपनी स्वतंत्र इच्छा से यह प्रतिज्ञा करता/करती हूँ",
      confirmBtn: "मेरी #SimpleNikah प्रतिज्ञा की पुष्टि करें",
      back: "पीछे",
      next: "आगे",
      shareWhatsApp: "WhatsApp पर साझा करें",
      shareNative: "साझा करें…",
      copyLink: "लिंक कॉपी करें",
      copyText: "पाठ कॉपी करें",
      downloadOg: "1200×630 चित्र डाउनलोड",
      downloadStory: "स्टोरी 1080×1920 डाउनलोड",
      revoke: "अनलिस्टेड लिंक रद्द करें",
      revokeDone: "लिंक सर्वर पर रद्द हो गया। खोलने वाले को अब यह नहीं दिखेगा। पहले डाउनलोड की गई प्रतियाँ वापस नहीं ली जा सकतीं।",
      register: "वैकल्पिक रूप से Find My Match पर जाएँ",
      registerHelp: "खाते जुड़ने तक पंजीकरण इस डिवाइस पर रहता है।",
      recipientTitle: "किसी ने #SimpleNikah प्रतिज्ञा साझा की",
      recipientCta: "मेरी प्रतिज्ञा लें",
      explore: "निजी रूप से Amanikah देखें",
      revokedTitle: "यह लिंक अब नहीं दिखता",
      revokedBody: "बनाने वाले ने लिंक रद्द किया, या लिंक अधूरा है।",
      statusCopied: "कॉपी हो गया।",
      statusShareBlocked: "साझाकरण रद्द या अवरुद्ध। पाठ कॉपी करें या चित्र डाउनलोड करें।",
      statusNeedConfirm: "आगे बढ़ने से पहले प्रतिज्ञा की पुष्टि करें।",
      statusPrivateNoLink: "निजी मोड में सार्वजनिक लिंक नहीं।",
      statusLinkReady: "अनलिस्टेड लिंक तैयार।",
      statusRevokedNeed: "रद्द करने के लिए कोई सक्रिय लिंक नहीं।",
      optCelebration: ["छोटा निजी समारोह", "मध्यम पारिवारिक समारोह", "बड़ा समारोह", "लचीला"],
      optFamily: ["शुरुआत से साथ", "दोनों चाहें तब", "सहायक, निर्णय हमारे बिना"],
      optHome: ["उसी शहर में", "स्थान बदलने को तैयार", "विदेश में जीवन", "लचीला"],
      templates: { emerald: "एमरल्ड रात", ivory: "हाथीदांत सुबह", arch: "सुनहरा मेहराब" },
      cardBrand: "Amanikah",
      cardTag: "#SimpleNikah",
      cardFoot: "amanikah.com/simple-nikah",
      prefsLabel: "मेरी प्राथमिकताएँ"
    },
    ur: {
      dir: "rtl",
      label: "اردو",
      kicker: "#SimpleNikah",
      title: "سادہ نکاح — آپ کے الفاظ میں",
      lede: "جہیز کے مطالبات اور نمائشی فضول خرچی کے خلاف رضاکارانہ عہد لیں۔ کارڈ تبھی شیئر کریں جب آپ چاہیں۔",
      meaningTitle: "اس عہد کا مطلب",
      meaningBody: "یہ ذاتی ارادے کا بیان ہے۔ یہ کسی اور کو پابند نہیں کرتا، اکاؤنٹ نہیں بناتا، اور شادی کی ضمانت نہیں دیتا۔",
      start: "عہد شروع کریں",
      stepLang: "زبان",
      stepPrefs: "آپ کی ترجیحات",
      stepPrivacy: "رازداری اور شیئرنگ",
      stepConfirm: "عہد کی تصدیق",
      stepCard: "آپ کا کارڈ",
      celebration: "تقریب کیسی ہو؟",
      family: "خاندان کا کردار؟",
      home: "آپ کہاں رہنا چاہیں گے؟",
      template: "کارڈ ٹیمپلیٹ",
      visibility: "لنک کون کھول سکتا ہے؟",
      visPrivate: "نجی — صرف متن یا تصویر۔ کوئی عوامی لنک نہیں۔",
      visLink: "غیر فہرست شدہ لنک — صرف ترجیحات۔ نام/تصویر/شہر نہیں جب تک آپ پہلا نام نہ لکھیں۔",
      firstName: "کارڈ پر اختیاری پہلا نام",
      firstNameHelp: "خالی چھوڑیں تو کارڈ گمنام رہے گا۔",
      matching: "ان ترجیحات کو اس ڈیوائس پر اختیاری میچنگ ترجیح کے طور پر محفوظ کریں",
      matchingHelp: "عہد دیانت یا مذہبی موزونیت کا ثبوت نہیں۔",
      confirmLabel: "میں اپنی آزاد مرضی سے یہ عہد کرتا/کرتی ہوں",
      confirmBtn: "میرا #SimpleNikah عہد تصدیق کریں",
      back: "پیچھے",
      next: "آگے",
      shareWhatsApp: "WhatsApp پر شیئر کریں",
      shareNative: "شیئر…",
      copyLink: "لنک کاپی کریں",
      copyText: "متن کاپی کریں",
      downloadOg: "1200×630 تصویر ڈاؤن لوڈ",
      downloadStory: "اسٹوری 1080×1920 ڈاؤن لوڈ",
      revoke: "انلسٹڈ لنک منسوخ کریں",
      revokeDone: "لنک سرور پر منسوخ ہو گیا۔ کھولنے والے کو اب یہ نہیں دکھے گا۔ پہلے ڈاؤن لوڈ شدہ کاپیاں واپس نہیں لی جا سکتیں۔",
      register: "اختیاری طور پر Find My Match پر جائیں",
      registerHelp: "اکاؤنٹس جڑنے تک رجسٹریشن اس ڈیوائس پر رہتی ہے۔",
      recipientTitle: "کسی نے #SimpleNikah عہد شیئر کیا",
      recipientCta: "میرا عہد لیں",
      explore: "نجی طور پر Amanikah دیکھیں",
      revokedTitle: "یہ لنک اب دکھائی نہیں دیتا",
      revokedBody: "بنانے والے نے لنک منسوخ کیا، یا لنک نامکمل ہے۔",
      statusCopied: "کاپی ہو گیا۔",
      statusShareBlocked: "شیئرنگ منسوخ یا مسدود۔ متن کاپی کریں یا تصویر ڈاؤن لوڈ کریں۔",
      statusNeedConfirm: "آگے بڑھنے سے پہلے عہد کی تصدیق کریں۔",
      statusPrivateNoLink: "نجی موڈ میں عوامی لنک نہیں۔",
      statusLinkReady: "غیر فہرست شدہ لنک تیار۔",
      statusRevokedNeed: "منسوخ کرنے کے لیے کوئی فعال لنک نہیں۔",
      optCelebration: ["چھوٹی نجی تقریب", "متوسط خاندانی تقریب", "بڑی تقریب", "لچکدار"],
      optFamily: ["شروع سے ساتھ", "جب دونوں چاہیں", "مددگار، فیصلہ ہمارے بغیر"],
      optHome: ["اسی شہر میں", "منتقل ہونے کو تیار", "بیرون ملک زندگی", "لچکدار"],
      templates: { emerald: "زمردی رات", ivory: "ہاتھی دانت صبح", arch: "سنہری محراب" },
      cardBrand: "Amanikah",
      cardTag: "#SimpleNikah",
      cardFoot: "amanikah.com/simple-nikah",
      prefsLabel: "میری ترجیحات"
    },
    te: {
      dir: "ltr",
      label: "తెలుగు",
      kicker: "#SimpleNikah",
      title: "సాధారణ నికాహ్ — మీ మాటల్లో",
      lede: "వరకట్న డిమాండ్లు మరియు ప్రదర్శనాత్మక వ్యయానికి వ్యతిరేకంగా స్వచ్ఛంద ప్రతిజ్ఞ. కార్డ్ మీరు కోరుకున్నప్పుడే షేర్ చేయండి.",
      meaningTitle: "ఈ ప్రతిజ్ఞ అర్థం",
      meaningBody: "ఇది వ్యక్తిగత ఉద్దేశ్య ప్రకటన. ఇది ఇతరులను బంధించదు, ఖాతా సృష్టించదు, వివాహం హామీ ఇవ్వదు.",
      start: "నా ప్రతిజ్ఞ ప్రారంభించండి",
      stepLang: "భాష",
      stepPrefs: "మీ ప్రాధాన్యతలు",
      stepPrivacy: "గోప్యత మరియు షేరింగ్",
      stepConfirm: "ప్రతిజ్ఞ నిర్ధారణ",
      stepCard: "మీ కార్డ్",
      celebration: "వేడుక ఎలా ఉండాలి?",
      family: "కుటుంబ పాత్ర?",
      home: "మీరు ఎక్కడ నివసించాలనుకుంటున్నారు?",
      template: "కార్డ్ టెంప్లేట్",
      visibility: "లింక్ ఎవరు తెరవవచ్చు?",
      visPrivate: "ప్రైవేట్ — టెక్స్ట్ లేదా చిత్రం మాత్రమే. పబ్లిక్ లింక్ లేదు.",
      visLink: "అన్‌లిస్టెడ్ లింక్ — ప్రాధాన్యతలు మాత్రమే.",
      firstName: "కార్డ్‌పై ఐచ్ఛిక మొదటి పేరు",
      firstNameHelp: "ఖాళీగా ఉంచితే కార్డ్ అజ్ఞాతంగా ఉంటుంది.",
      matching: "ఈ ప్రాధాన్యతలను ఈ పరికరంపై ఐచ్ఛిక మ్యాచింగ్ ప్రాధాన్యతగా సేవ్ చేయండి",
      matchingHelp: "ప్రతిజ్ఞ నిజాయితీ లేదా మతపరమైన అనుకూలతకు రుజువు కాదు.",
      confirmLabel: "నేను స్వచ్ఛందంగా ఈ ప్రతిజ్ఞ చేస్తున్నాను",
      confirmBtn: "నా #SimpleNikah ప్రతిజ్ఞను నిర్ధారించండి",
      back: "వెనుకకు",
      next: "కొనసాగించు",
      shareWhatsApp: "WhatsAppలో షేర్",
      shareNative: "షేర్…",
      copyLink: "లింక్ కాపీ",
      copyText: "టెక్స్ట్ కాపీ",
      downloadOg: "1200×630 చిత్రం",
      downloadStory: "స్టోరీ 1080×1920",
      revoke: "అన్‌లిస్టెడ్ లింక్ రద్దు",
      revokeDone: "లింక్ సర్వర్‌పై రద్దు అయింది. తెరిచే వారికి ఇక కనిపించదు. ఇప్పటికే డౌన్‌లోడ్ చేసిన కాపీలు తిరిగి తీసుకోలేము.",
      register: "ఐచ్ఛికంగా Find My Matchకి వెళ్లండి",
      registerHelp: "ఖాతాలు రాకముందు రిజిస్ట్రేషన్ ఈ పరికరంపైనే ఉంటుంది.",
      recipientTitle: "ఎవరో #SimpleNikah ప్రతిజ్ఞను షేర్ చేశారు",
      recipientCta: "నా ప్రతిజ్ఞ చేయండి",
      explore: "ప్రైవేట్‌గా Amanikah చూడండి",
      revokedTitle: "ఈ లింక్ ఇక కనిపించదు",
      revokedBody: "సృష్టికర్త లింక్‌ను రద్దు చేశారు, లేదా లింక్ అసంపూర్ణం.",
      statusCopied: "కాపీ అయింది.",
      statusShareBlocked: "షేర్ రద్దు లేదా బ్లాక్. టెక్స్ట్ కాపీ చేయండి లేదా చిత్రం డౌన్‌లోడ్ చేయండి.",
      statusNeedConfirm: "ముందుగా ప్రతిజ్ఞను నిర్ధారించండి.",
      statusPrivateNoLink: "ప్రైవేట్ మోడ్‌లో పబ్లిక్ లింక్ లేదు.",
      statusLinkReady: "అన్‌లిస్టెడ్ లింక్ సిద్ధం.",
      statusRevokedNeed: "రద్దు చేయడానికి యాక్టివ్ లింక్ లేదు.",
      optCelebration: ["చిన్న ప్రైవేట్ వేడుక", "మధ్యస్థ కుటుంబ వేడుక", "పెద్ద వేడుక", "సరళమైనది"],
      optFamily: ["మొదటి నుండి కలిసి", "ఇద్దరూ కోరుకున్నప్పుడు", "మద్దతు, నిర్ణయం మా లేకుండా"],
      optHome: ["అదే నగరంలో", "మారడానికి సిద్ధం", "విదేశాల్లో జీవితం", "సరళమైనది"],
      templates: { emerald: "ఎమరాల్డ్ రాత్రి", ivory: "ఐవరీ ఉదయం", arch: "గోల్డ్ ఆర్చ్" },
      cardBrand: "Amanikah",
      cardTag: "#SimpleNikah",
      cardFoot: "amanikah.com/simple-nikah",
      prefsLabel: "నా ప్రాధాన్యతలు"
    }
  };

  var STORAGE = {
    pledge: "amanikah.simpleNikah.pledge",
    revoked: "amanikah.simpleNikah.revoked",
    matching: "amanikah.matching.simpleNikah",
    analytics: "amanikah.analytics"
  };

  function track(name, props) {
    var event = {
      name: name,
      ts: new Date().toISOString(),
      props: props || {}
    };
    try {
      var list = JSON.parse(localStorage.getItem(STORAGE.analytics) || "[]");
      if (!Array.isArray(list)) list = [];
      list.push(event);
      if (list.length > 200) list = list.slice(-200);
      localStorage.setItem(STORAGE.analytics, JSON.stringify(list));
    } catch (err) {}
    try {
      document.dispatchEvent(new CustomEvent("amanikah:analytics", { detail: event }));
    } catch (err2) {}
    var funnel = { pledge_completed: 1, pledge_to_profile_conversion: 1 };
    if (funnel[name]) {
      var mapped = name === "pledge_to_profile_conversion" ? "pledge_to_signup" : name;
      var safe = {};
      Object.keys(event.props || {}).forEach(function (k) {
        if (["note", "intentions", "message", "profile", "password"].indexOf(k) === -1) safe[k] = event.props[k];
      });
      try {
        fetch("/api/amanikah/analytics/events", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ name: mapped, props: safe }),
          credentials: "same-origin",
          keepalive: true,
        }).catch(function () {});
      } catch (errFunnel) {}
    }
    var endpoint = window.AMANIKAH_ANALYTICS_ENDPOINT;
    var consent = false;
    try { consent = localStorage.getItem("amanikah.analytics.consent") === "1"; } catch (errConsent) {}
    if (!consent) endpoint = "";
    if (endpoint && typeof navigator.sendBeacon === "function") {
      try {
        var blob = new Blob([JSON.stringify(event)], { type: "application/json" });
        navigator.sendBeacon(endpoint, blob);
      } catch (err3) {}
    }
  }

  function t(lang) {
    return I18N[lang] || I18N.en;
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "p-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function encodePayload(obj) {
    var json = JSON.stringify(obj);
    var bytes = new TextEncoder().encode(json);
    var bin = "";
    bytes.forEach(function (b) { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function decodePayload(raw) {
    if (!raw) return null;
    try {
      var b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      var bin = atob(b64);
      var bytes = Uint8Array.from(bin, function (c) { return c.charCodeAt(0); });
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (err) {
      return null;
    }
  }

  function readRevoked() {
    try {
      var list = JSON.parse(localStorage.getItem(STORAGE.revoked) || "[]");
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return [];
    }
  }

  function isRevoked(id) {
    return !!(id && readRevoked().indexOf(id) !== -1);
  }

  function revokeId(id) {
    if (!id) return false;
    var list = readRevoked();
    if (list.indexOf(id) === -1) list.push(id);
    localStorage.setItem(STORAGE.revoked, JSON.stringify(list));
    try { localStorage.removeItem(STORAGE.pledge); } catch (err) {}
    try { localStorage.removeItem(STORAGE.matching); } catch (err2) {}
    return true;
  }

  function publicUrl(payloadOrShareId) {
    var origin = window.location.origin;
    if (typeof payloadOrShareId === "string") {
      return origin + "/simple-nikah/share.html?s=" + encodeURIComponent(payloadOrShareId);
    }
    // Legacy encoded payload URLs remain readable; new shares use server ids.
    return origin + "/simple-nikah/share.html?p=" + encodePayload(payloadOrShareId);
  }

  function ensureServerShare(state) {
    if (state.shareId && state.revokeToken) {
      return Promise.resolve({
        shareId: state.shareId,
        revokeToken: state.revokeToken,
        path: "/simple-nikah/share.html?s=" + state.shareId
      });
    }
    return fetch("/api/amanikah/shares", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ kind: "simple-nikah", payload: stateToPayload(state) })
    }).then(function (res) {
      return res.json().then(function (json) {
        if (!res.ok || !json.ok) {
          throw new Error((json && json.message) || "Could not create a shareable link.");
        }
        state.shareId = json.shareId;
        state.revokeToken = json.revokeToken;
        try {
          localStorage.setItem(STORAGE.pledge, JSON.stringify(state));
        } catch (err) {}
        return json;
      });
    });
  }

  function revokeServerShare(state) {
    if (!state.shareId || !state.revokeToken) {
      return Promise.resolve({ ok: false, code: "NO_SERVER_SHARE" });
    }
    return fetch("/api/amanikah/shares/" + encodeURIComponent(state.shareId) + "/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ revokeToken: state.revokeToken })
    }).then(function (res) {
      return res.json().then(function (json) {
        return { status: res.status, body: json };
      });
    });
  }

  function pledgeText(state) {
    var lang = state.lang || "en";
    var lines = [
      "Amanikah · #SimpleNikah",
      CORE_PLEDGE[lang] || CORE_PLEDGE.en
    ];
    if (state.firstName) lines.push(state.firstName);
    lines.push(
      (t(lang).prefsLabel) + " — " +
      [state.celebration, state.family, state.home].filter(Boolean).join(" · ")
    );
    lines.push(MAHR_NOTE[lang] || MAHR_NOTE.en);
    if (state.visibility === "link" && state.shareId) lines.push(publicUrl(state.shareId));
    else if (state.visibility === "link") lines.push("https://amanikah.com/simple-nikah/");
    else lines.push("https://amanikah.com/simple-nikah/");
    return lines.join("\n\n");
  }

  function stateToPayload(state) {
    var payload = {
      v: 1,
      id: state.id,
      lang: state.lang,
      template: state.template,
      celebration: state.celebration,
      family: state.family,
      home: state.home,
      visibility: state.visibility
    };
    if (state.firstName) payload.firstName = state.firstName.slice(0, 40);
    return payload;
  }

  function copyText(text, statusEl, button) {
    var done = function () {
      if (statusEl) statusEl.textContent = t(document.documentElement.lang || "en").statusCopied || "Copied.";
      if (button) {
        var prev = button.textContent;
        button.textContent = t(document.documentElement.lang || "en").statusCopied || "Copied.";
        setTimeout(function () {
          button.textContent = prev;
          if (statusEl) statusEl.textContent = "";
        }, 1600);
      }
    };
    var fallback = function () {
      var area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
      document.body.removeChild(area);
      if (ok) done();
      else if (statusEl) statusEl.textContent = "Copy was blocked. Select the text manually.";
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallback);
    } else fallback();
  }

  function paintCard(canvas, state, width, height) {
    var ctx = canvas.getContext("2d");
    canvas.width = width;
    canvas.height = height;
    var lang = state.lang || "en";
    var copy = t(lang);
    var template = state.template || "emerald";
    var colors = {
      emerald: { bg: "#123F35", ink: "#F7F3EA", gold: "#B59A60", soft: "#E4D7B8" },
      ivory: { bg: "#FAF8F3", ink: "#123F35", gold: "#B59A60", soft: "#26342F" },
      arch: { bg: "#0C2B24", ink: "#F7F3EA", gold: "#B59A60", soft: "#E4D7B8" }
    }[template] || { bg: "#123F35", ink: "#F7F3EA", gold: "#B59A60", soft: "#E4D7B8" };

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, height);

    if (template === "arch") {
      ctx.fillStyle = "rgba(181,154,96,0.16)";
      ctx.beginPath();
      ctx.moveTo(width * 0.1, height * 0.22);
      ctx.quadraticCurveTo(width * 0.5, height * 0.02, width * 0.9, height * 0.22);
      ctx.lineTo(width * 0.9, height * 0.95);
      ctx.lineTo(width * 0.1, height * 0.95);
      ctx.closePath();
      ctx.fill();
    }

    var pad = Math.round(width * 0.08);
    ctx.strokeStyle = colors.gold;
    ctx.lineWidth = Math.max(2, Math.round(width * 0.003));
    ctx.strokeRect(pad * 0.55, pad * 0.55, width - pad * 1.1, height - pad * 1.1);

    ctx.fillStyle = colors.gold;
    ctx.font = "600 " + Math.round(width * 0.028) + "px Inter, system-ui, sans-serif";
    ctx.fillText(copy.cardBrand, pad, pad * 1.15);

    ctx.fillStyle = colors.gold;
    ctx.font = "600 " + Math.round(width * 0.022) + "px Inter, system-ui, sans-serif";
    ctx.fillText(copy.cardTag, pad, pad * 1.55);

    var pledge = CORE_PLEDGE[lang] || CORE_PLEDGE.en;
    ctx.fillStyle = colors.ink;
    var titleSize = Math.round(width * (height > width ? 0.048 : 0.036));
    ctx.font = "500 " + titleSize + "px 'Playfair Display', Georgia, serif";
    wrapText(ctx, pledge, pad, pad * 1.95, width - pad * 2, Math.round(titleSize * 1.28), Math.round(height * 0.42));

    var y = height * (height > width ? 0.62 : 0.68);
    if (state.firstName) {
      ctx.fillStyle = colors.soft;
      ctx.font = "600 " + Math.round(width * 0.03) + "px Inter, system-ui, sans-serif";
      ctx.fillText(state.firstName, pad, y);
      y += Math.round(width * 0.04);
    }

    ctx.fillStyle = colors.gold;
    ctx.font = "600 " + Math.round(width * 0.018) + "px Inter, system-ui, sans-serif";
    ctx.fillText(copy.prefsLabel.toUpperCase(), pad, y);
    y += Math.round(width * 0.032);
    ctx.fillStyle = colors.ink;
    ctx.font = "500 " + Math.round(width * 0.024) + "px Inter, system-ui, sans-serif";
    [state.celebration, state.family, state.home].filter(Boolean).forEach(function (line) {
      ctx.fillText("·  " + line, pad, y);
      y += Math.round(width * 0.032);
    });

    ctx.fillStyle = colors.soft;
    ctx.font = "400 " + Math.round(width * 0.018) + "px Inter, system-ui, sans-serif";
    wrapText(ctx, MAHR_NOTE[lang] || MAHR_NOTE.en, pad, height - pad * 1.35, width - pad * 2, Math.round(width * 0.026), Math.round(height * 0.12));
    ctx.fillStyle = colors.gold;
    ctx.fillText(copy.cardFoot, pad, height - pad * 0.55);
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxHeight) {
    var words = text.split(/\s+/);
    var line = "";
    var bottom = y + (maxHeight || 9999);
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y);
        line = words[i];
        y += lineHeight;
        if (y > bottom) return y;
      } else {
        line = test;
      }
    }
    if (line && y <= bottom) ctx.fillText(line, x, y);
    return y + lineHeight;
  }

  function downloadCanvas(canvas, filename) {
    return new Promise(function (resolve, reject) {
      if (!canvas.toBlob) {
        var a = document.createElement("a");
        a.href = canvas.toDataURL("image/png");
        a.download = filename;
        a.click();
        resolve();
        return;
      }
      canvas.toBlob(function (blob) {
        if (!blob) {
          reject(new Error("Could not export image"));
          return;
        }
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
        resolve();
      }, "image/png");
    });
  }

  function whatsappUrl(text) {
    return "https://wa.me/?text=" + encodeURIComponent(text);
  }

  function canNativeShare() {
    return !!(navigator.share);
  }

  async function nativeShare(state, canvas) {
    var text = pledgeText(state);
    var data = { title: "#SimpleNikah — Amanikah", text: text };
    if (state.visibility === "link" && state.shareId) data.url = publicUrl(state.shareId);
    if (canvas && canvas.toBlob && navigator.canShare) {
      var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, "image/png"); });
      if (blob) {
        var file = new File([blob], "simple-nikah.png", { type: "image/png" });
        var withFile = { title: data.title, text: data.text, files: [file] };
        if (navigator.canShare(withFile)) {
          await navigator.share(withFile);
          return;
        }
      }
    }
    await navigator.share(data);
  }

  function bindLanding() {
    var root = document.getElementById("sn-app");
    if (!root) return;

    var state = {
      step: 0,
      lang: "en",
      celebration: "",
      family: "",
      home: "",
      template: "emerald",
      visibility: "private",
      firstName: "",
      matching: false,
      confirmed: false,
      id: uuid()
    };

    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE.pledge) || "null");
      if (saved && saved.id && !isRevoked(saved.id)) {
        state = Object.assign(state, saved, { step: 4, confirmed: true });
      }
    } catch (err) {}

    var status = document.getElementById("sn-status");
    var preview = document.getElementById("sn-preview");
    var ogCanvas = document.getElementById("sn-og");
    var storyCanvas = document.getElementById("sn-story");

    function setStatus(msg) {
      if (status) status.textContent = msg || "";
    }

    function applyLang() {
      var copy = t(state.lang);
      document.documentElement.lang = state.lang === "ur" ? "ur" : state.lang;
      document.documentElement.dir = copy.dir;
      root.setAttribute("data-lang", state.lang);
      root.querySelectorAll("[data-i18n]").forEach(function (el) {
        var key = el.getAttribute("data-i18n");
        if (copy[key]) el.textContent = copy[key];
      });
      var pledgeCopy = CORE_PLEDGE[state.lang] || CORE_PLEDGE.en;
      var core = document.getElementById("sn-core");
      if (core) core.textContent = pledgeCopy;
      var coreConfirm = document.getElementById("sn-core-confirm");
      if (coreConfirm) coreConfirm.textContent = pledgeCopy;
      var mahr = document.getElementById("sn-mahr");
      if (mahr) mahr.textContent = MAHR_NOTE[state.lang] || MAHR_NOTE.en;
      fillOptions("sn-celebration", copy.optCelebration, state.celebration);
      fillOptions("sn-family", copy.optFamily, state.family);
      fillOptions("sn-home", copy.optHome, state.home);
      var tpl = document.getElementById("sn-template");
      if (tpl) {
        Array.prototype.forEach.call(tpl.options, function (opt) {
          if (copy.templates[opt.value]) opt.textContent = copy.templates[opt.value];
        });
        tpl.value = state.template;
      }
    }

    function fillOptions(id, options, selected) {
      var el = document.getElementById(id);
      if (!el) return;
      el.replaceChildren();
      options.forEach(function (label) {
        var opt = document.createElement("option");
        opt.value = label;
        opt.textContent = label;
        if (label === selected) opt.selected = true;
        el.appendChild(opt);
      });
      if (!selected && options[0]) {
        el.value = options[0];
        if (id === "sn-celebration") state.celebration = options[0];
        if (id === "sn-family") state.family = options[0];
        if (id === "sn-home") state.home = options[0];
      }
    }

    function showStep() {
      root.querySelectorAll("[data-step]").forEach(function (panel) {
        panel.hidden = Number(panel.getAttribute("data-step")) !== state.step;
      });
      var progress = document.getElementById("sn-progress");
      if (progress) progress.textContent = String(state.step + 1) + " / 5";
      if (state.step === 4) renderCard();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function renderCard() {
      paintCard(ogCanvas, state, 1200, 630);
      paintCard(storyCanvas, state, 1080, 1920);
      if (preview) {
        preview.replaceChildren();
        var img = document.createElement("img");
        img.alt = "#SimpleNikah pledge card";
        img.width = 1200;
        img.height = 630;
        img.src = ogCanvas.toDataURL("image/png");
        preview.appendChild(img);
      }
      var linkOut = document.getElementById("sn-link");
      if (linkOut) {
        if (state.visibility === "link") {
          linkOut.hidden = false;
          if (state.shareId) {
            linkOut.textContent = publicUrl(state.shareId);
          } else {
            linkOut.textContent = "Preparing a revocable server link…";
            ensureServerShare(state).then(function () {
              linkOut.textContent = publicUrl(state.shareId);
              persist();
            }).catch(function (err) {
              linkOut.textContent = "";
              setStatus(err.message || "Could not create a shareable link.");
            });
          }
        } else {
          linkOut.hidden = true;
          linkOut.textContent = "";
        }
      }
    }

    function persist() {
      try {
        localStorage.setItem(STORAGE.pledge, JSON.stringify(state));
      } catch (err) {}
      if (state.matching) {
        try {
          localStorage.setItem(STORAGE.matching, JSON.stringify({
            source: "simple-nikah",
            celebration: state.celebration,
            family: state.family,
            home: state.home,
            lang: state.lang,
            updated: new Date().toISOString(),
            note: "Optional preference only. Not a character or faith score."
          }));
        } catch (err2) {}
      } else {
        try { localStorage.removeItem(STORAGE.matching); } catch (err3) {}
      }
    }

    document.getElementById("sn-start").addEventListener("click", function () {
      track("pledge_started", { lang: state.lang });
      state.step = 0;
      showStep();
      document.getElementById("sn-flow").hidden = false;
      document.getElementById("sn-intro").hidden = true;
    });

    root.querySelectorAll("[name='sn-lang']").forEach(function (input) {
      input.addEventListener("change", function () {
        state.lang = input.value;
        applyLang();
      });
    });

    ["sn-celebration", "sn-family", "sn-home", "sn-template"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("change", function () {
        if (id === "sn-celebration") state.celebration = el.value;
        if (id === "sn-family") state.family = el.value;
        if (id === "sn-home") state.home = el.value;
        if (id === "sn-template") state.template = el.value;
      });
    });

    root.querySelectorAll("[name='sn-visibility']").forEach(function (input) {
      input.addEventListener("change", function () {
        state.visibility = input.value;
      });
    });

    var firstName = document.getElementById("sn-firstname");
    if (firstName) {
      firstName.addEventListener("input", function () {
        state.firstName = firstName.value.trim().replace(/\s+/g, " ").slice(0, 40);
      });
    }
    var matching = document.getElementById("sn-matching");
    if (matching) {
      matching.addEventListener("change", function () {
        state.matching = matching.checked;
      });
    }
    var confirm = document.getElementById("sn-confirm");
    if (confirm) {
      confirm.addEventListener("change", function () {
        state.confirmed = confirm.checked;
      });
    }

    root.querySelectorAll("[data-next]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (state.step === 3) {
          if (!state.confirmed) {
            setStatus(t(state.lang).statusNeedConfirm);
            return;
          }
          if (!state.id) state.id = uuid();
          persist();
          track("pledge_completed", {
            lang: state.lang,
            template: state.template,
            visibility: state.visibility,
            matching: !!state.matching,
            named: !!state.firstName
          });
          state.step = 4;
          showStep();
          return;
        }
        state.step = Math.min(4, state.step + 1);
        showStep();
      });
    });
    root.querySelectorAll("[data-back]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.step = Math.max(0, state.step - 1);
        showStep();
      });
    });

    document.getElementById("sn-wa").addEventListener("click", function () {
      track("share_clicked", { channel: "whatsapp", visibility: state.visibility });
      var openWa = function () {
        window.open(whatsappUrl(pledgeText(state)), "_blank", "noopener,noreferrer");
      };
      if (state.visibility === "link") {
        ensureServerShare(state).then(openWa).catch(function (err) { setStatus(err.message); });
      } else openWa();
    });

    document.getElementById("sn-native").addEventListener("click", function () {
      if (!canNativeShare()) {
        setStatus(t(state.lang).statusShareBlocked);
        return;
      }
      track("share_clicked", { channel: "native", visibility: state.visibility });
      var run = function () {
        return nativeShare(state, storyCanvas).catch(function () {
          setStatus(t(state.lang).statusShareBlocked);
        });
      };
      if (state.visibility === "link") {
        ensureServerShare(state).then(run).catch(function (err) { setStatus(err.message); });
      } else run();
    });
    if (!canNativeShare()) {
      document.getElementById("sn-native").hidden = true;
    }

    document.getElementById("sn-copy-link").addEventListener("click", function () {
      if (state.visibility !== "link") {
        setStatus(t(state.lang).statusPrivateNoLink);
        return;
      }
      var btn = this;
      track("share_clicked", { channel: "copy_link" });
      ensureServerShare(state).then(function () {
        copyText(publicUrl(state.shareId), status, btn);
        setStatus(t(state.lang).statusLinkReady);
        renderCard();
      }).catch(function (err) {
        setStatus(err.message || "Could not create a shareable link.");
      });
    });

    document.getElementById("sn-copy-text").addEventListener("click", function () {
      track("share_clicked", { channel: "copy_text" });
      copyText(pledgeText(state), status, this);
    });

    document.getElementById("sn-dl-og").addEventListener("click", function () {
      track("share_clicked", { channel: "download_og" });
      downloadCanvas(ogCanvas, "amanikah-simple-nikah-1200x630.png").catch(function () {
        setStatus("Could not export the image in this browser.");
      });
    });

    document.getElementById("sn-dl-story").addEventListener("click", function () {
      track("share_clicked", { channel: "download_story" });
      downloadCanvas(storyCanvas, "amanikah-simple-nikah-1080x1920.png").catch(function () {
        setStatus("Could not export the image in this browser.");
      });
    });

    document.getElementById("sn-revoke").addEventListener("click", function () {
      if (state.visibility === "private" && !state.shareId) {
        setStatus(t(state.lang).statusRevokedNeed);
        return;
      }
      var finishLocal = function () {
        revokeId(state.id);
        track("pledge_revoked", { id: state.id, shareId: state.shareId || null });
        setStatus(t(state.lang).revokeDone);
        state.visibility = "private";
        state.shareId = null;
        state.revokeToken = null;
        state.id = uuid();
        state.confirmed = false;
        persist();
        renderCard();
      };
      if (state.shareId && state.revokeToken) {
        revokeServerShare(state).then(function (result) {
          if (!result.body || !result.body.ok) {
            setStatus((result.body && result.body.message) || "Server revocation failed. The link may still be open.");
            return;
          }
          finishLocal();
        }).catch(function () {
          setStatus("Network error. The link was not confirmed revoked.");
        });
        return;
      }
      // No server share yet — nothing remote to revoke.
      setStatus(t(state.lang).statusRevokedNeed);
    });

    document.getElementById("sn-register").addEventListener("click", function () {
      track("pledge_to_profile_conversion", { from: "simple-nikah" });
      try {
        localStorage.setItem("amanikah.signup.pref.simpleNikah", JSON.stringify({
          celebration: state.celebration,
          family: state.family,
          home: state.home,
          lang: state.lang
        }));
      } catch (err) {}
      window.location.href = "/signup.html?from=simple-nikah";
    });

    applyLang();
    if (state.confirmed) {
      document.getElementById("sn-intro").hidden = true;
      document.getElementById("sn-flow").hidden = false;
      showStep();
    } else {
      document.getElementById("sn-flow").hidden = true;
    }
  }

  function renderSharePayload(payload) {
    var revoked = document.getElementById("sn-share-revoked");
    var content = document.getElementById("sn-share-content");
    if (!payload || !payload.celebration) {
      if (content) content.hidden = true;
      if (revoked) revoked.hidden = false;
      return;
    }
    if (content) content.hidden = false;
    if (revoked) revoked.hidden = true;

    var lang = payload.lang || "en";
    var copy = t(lang);
    document.documentElement.lang = lang === "ur" ? "ur" : lang;
    document.documentElement.dir = copy.dir;
    document.getElementById("sn-share-title").textContent = copy.recipientTitle;
    document.getElementById("sn-share-core").textContent = CORE_PLEDGE[lang] || CORE_PLEDGE.en;
    document.getElementById("sn-share-mahr").textContent = MAHR_NOTE[lang] || MAHR_NOTE.en;
    var nameEl = document.getElementById("sn-share-name");
    if (payload.firstName) {
      nameEl.hidden = false;
      nameEl.textContent = payload.firstName;
    } else {
      nameEl.hidden = true;
    }
    var list = document.getElementById("sn-share-prefs");
    list.replaceChildren();
    [payload.celebration, payload.family, payload.home].filter(Boolean).forEach(function (line) {
      var li = document.createElement("li");
      li.textContent = line;
      list.appendChild(li);
    });
    document.getElementById("sn-share-cta").textContent = copy.recipientCta;
    document.getElementById("sn-share-explore").textContent = copy.explore;

    var canvas = document.getElementById("sn-share-canvas");
    paintCard(canvas, payload, 1200, 630);
    var img = document.getElementById("sn-share-img");
    img.src = canvas.toDataURL("image/png");
    img.alt = "#SimpleNikah card";

    document.getElementById("sn-share-cta").addEventListener("click", function () {
      track("referral_signup", { action: "start_pledge" });
    });
    document.getElementById("sn-share-explore").addEventListener("click", function () {
      track("referral_signup", { action: "explore_home" });
    });
  }

  function bindSharePage() {
    var root = document.getElementById("sn-share");
    if (!root) return;
    var params = new URLSearchParams(window.location.search);
    var shareId = params.get("s");
    var payload = decodePayload(params.get("p"));
    var revoked = document.getElementById("sn-share-revoked");
    var content = document.getElementById("sn-share-content");

    track("referral_visited", { hasPayload: !!payload, shareId: shareId || null });

    if (shareId) {
      if (content) {
        content.hidden = false;
        var loading = content.querySelector("h1");
        if (loading) loading.textContent = "Loading pledge…";
      }
      fetch("/api/amanikah/shares/" + encodeURIComponent(shareId), {
        headers: { Accept: "application/json" }
      }).then(function (res) {
        return res.json().then(function (json) {
          return { status: res.status, body: json };
        });
      }).then(function (result) {
        if (result.status === 410 || (result.body && result.body.revoked)) {
          if (content) content.hidden = true;
          if (revoked) revoked.hidden = false;
          return;
        }
        if (!result.body || !result.body.ok) {
          if (content) content.hidden = true;
          if (revoked) revoked.hidden = false;
          return;
        }
        renderSharePayload(result.body.payload);
      }).catch(function () {
        if (content) content.hidden = true;
        if (revoked) revoked.hidden = false;
      });
      return;
    }

    // Legacy encoded URLs: still readable, but local-only revoke cannot hide them for others.
    if (payload && payload.id && isRevoked(payload.id)) {
      if (content) content.hidden = true;
      if (revoked) revoked.hidden = false;
      return;
    }
    renderSharePayload(payload);
  }

  function enhanceSignupFromPledge() {
    if (!/signup\.html/.test(window.location.pathname)) return;
    var note = document.getElementById("note");
    if (!note || note.value) return;
    try {
      var pref = JSON.parse(localStorage.getItem("amanikah.signup.pref.simpleNikah") || "null");
      var matching = JSON.parse(localStorage.getItem(STORAGE.matching) || "null");
      var data = pref || matching;
      if (!data) return;
      note.value = "SimpleNikah preferences: " + [data.celebration, data.family, data.home].filter(Boolean).join("; ");
      var banner = document.createElement("div");
      banner.className = "banner ok";
      banner.innerHTML = "<strong>#SimpleNikah preferences loaded.</strong><p>They are optional matching context only — not a proof of character or faith.</p>";
      var form = document.getElementById("signup");
      if (form && form.parentElement) form.parentElement.insertBefore(banner, form);
      track("pledge_to_profile_conversion", { stage: "signup_prefill" });
    } catch (err) {}
  }

  document.addEventListener("DOMContentLoaded", function () {
    bindLanding();
    bindSharePage();
    enhanceSignupFromPledge();
  });

  window.AmanikahSimpleNikah = {
    encodePayload: encodePayload,
    decodePayload: decodePayload,
    paintCard: paintCard,
    whatsappUrl: whatsappUrl,
    revokeId: revokeId,
    isRevoked: isRevoked,
    track: track,
    CORE_PLEDGE: CORE_PLEDGE,
    I18N: I18N
  };
})();
