import React, { useState } from 'react';
import { ArrowUpRight, ArrowRight, Sprout, Tractor, Wheat, Layers, Droplets, MapPin, CalendarDays, ShieldCheck, Check, Menu, X, Plus, Minus } from 'lucide-react';
import { TractorArt } from './TractorArt';
import './HomePage.css';

const equipmentIcons = {
  tractor: Tractor,
  harvest: Wheat,
  implement: Layers,
  sprayer: Droplets,
};

const contentByLang = {
  en: {
    nav: {
      equipment: 'Equipment',
      how: 'How it works',
      estimate: 'Rental estimate',
      faq: 'FAQs',
      signIn: 'Sign in',
      skip: 'Skip to content',
      growTogether: 'GROW TOGETHER.',
    },
    hero: {
      eyebrow: 'ROOTED IN COMMUNITY. BUILT FOR YOUR FARM.',
      titleLine1: 'Good equipment.',
      titleLine2: 'Great possibilities.',
      titleEm: 'Growing together.',
      desc: 'Your next job deserves the right machine. Connect with equipment owners nearby and turn your plans into a productive day in the field.',
      findBtn: 'Find equipment',
      howBtn: 'See how it works',
      footNear: 'Start with nearby equipment',
      footRecords: 'Clear rental records',
      sceneLabel: 'A BETTER DAY IN THE FIELD',
      cardTitle: 'Plan. Book. Get to work.',
      cardSub: 'One place for your next rental.',
      sceneCaption: 'LOCAL CONNECTIONS. SHARED OPPORTUNITIES.',
    },
    principles: [
      'Equipment for every stage',
      'Book around your schedule',
      'Meter-based billing',
      'Farmers & owners, connected',
    ],
    equipmentHead: {
      eyebrow: '01 / FIND YOUR FIT',
      title: 'What’s next for your field?',
      desc: 'Explore the possibilities. Sign in to check actual listings, rates and availability near you.',
      signInToExplore: 'Sign in to explore equipment',
    },
    equipment: [
      { key: 'tractor', name: 'Tractors', tag: 'THE FIELD ESSENTIAL', title: 'Big jobs. The right horsepower.', description: 'From land preparation to transport, find a tractor suited to your next job.', uses: ['Land preparation', 'Farm transport', 'Attachment support'], color: 'tractor' },
      { key: 'harvest', name: 'Harvesters', tag: 'WHEN TIMING MATTERS', title: 'Make the most of harvest time.', description: 'Explore harvesting equipment and plan your slot around your crop and season.', uses: ['Crop harvesting', 'Seasonal planning', 'Time-slot booking'], color: 'harvest' },
      { key: 'implement', name: 'Implements', tag: 'PREPARE FOR WHAT’S NEXT', title: 'A good season starts with the soil.', description: 'Explore implements for your field work. Confirm compatibility and attachments with the owner.', uses: ['Soil preparation', 'Field cultivation', 'Attachment planning'], color: 'implement' },
      { key: 'sprayer', name: 'Sprayers', tag: 'CARE FOR EVERY ACRE', title: 'Give your crop the attention it needs.', description: 'Find spraying equipment and discuss your field requirements with the equipment owner.', uses: ['Crop care', 'Field coverage', 'Scheduled rental'], color: 'sprayer' },
    ],
    journeysHead: {
      eyebrow: '02 / A SIMPLER WAY TO WORK',
      title: 'Two sides. One community.',
    },
    journeys: {
      farmer: {
        label: 'For farmers',
        title: 'Your field. Your schedule.',
        intro: 'Spend less time arranging equipment and more time planning a good day’s work.',
        steps: [
          ['Find nearby equipment', 'Search by equipment type and distance from your farm.'],
          ['Request your time slot', 'Choose when you need it and wait for the owner’s approval.'],
          ['Finish with a clear bill', 'Confirm meter readings and keep a record of the rental.'],
        ],
        cta: 'Find my next machine',
      },
      owner: {
        label: 'For equipment owners',
        title: 'Put idle equipment to work.',
        intro: 'Bring your listings, booking requests and rental records into one workspace.',
        steps: [
          ['Create your listing', 'Add your equipment, location, rental rate and availability.'],
          ['Manage incoming requests', 'Accept or reject bookings around your own work schedule.'],
          ['Track every rental', 'Record readings, generate bills and review rental earnings.'],
        ],
        cta: 'Start listing equipment',
      },
    },
    calc: {
      eyebrow: '03 / CLARITY BEFORE YOU COMMIT',
      title: 'A little planning.\nA clearer rental cost.',
      desc: 'Try an example before you book. Adjust the rate and work quantity to see how a rental estimate adds up.',
      note: 'This is an illustrative calculator, not a quote. Actual rates, availability, add-ons and final bills come from your booking.',
      cardTitle: 'Try a rental estimate',
      exampleBadge: 'EXAMPLE',
      unitLabel: 'Pricing unit',
      perHour: 'Per hour',
      perAcre: 'Per acre',
      rateLabel: 'Rate per {unit} (₹)',
      workingHours: 'Working hours',
      completedAcres: 'Completed acres',
      transportLabel: 'Transport / mobilization (₹)',
      totalLabel: 'Illustrative total',
      validError: 'Enter amounts from ₹0 to ₹1,00,000.',
      directPayment: 'Payment is arranged directly with the owner.',
    },
    faqHead: {
      eyebrow: 'A FEW THINGS TO KNOW',
      title: 'Before you \nhead to the field.',
      desc: 'Simple answers for your first rental.',
    },
    faqs: [
      ['Can I rent equipment and list my own?', 'Yes. Choose both farmer and owner roles when creating your account to rent equipment and manage your own listings.'],
      ['How is the final rental bill calculated?', 'The booking uses the equipment’s saved rental rate. Hourly rentals use confirmed start and end meter readings; per-acre rentals use the completed acreage. Applicable listed charges are included in the breakdown.'],
      ['Do I pay through YantraSetu?', 'Payments are arranged directly between the farmer and equipment owner. YantraSetu keeps rental bills and manually reported payment statuses; it does not collect money or independently verify those payments.'],
      ['Is a requested time slot immediately confirmed?', 'A request is pending until the owner approves it. Check your booking status before making plans to collect or use the equipment.'],
    ],
    final: {
      eyebrow: 'THE NEXT SEASON STARTS WITH A CONNECTION',
      title: 'Let’s make a good\nday’s work happen.',
      btn: 'Get started with YantraSetu',
      sub: 'Rent equipment. Share opportunity. Grow together.',
    },
    footer: {
      tagline: 'AGRICULTURE, CONNECTED.',
      note: 'Built for the people who keep our fields moving.',
      backToTop: 'Back to top ↑',
    },
  },
  hi: {
    nav: {
      equipment: 'उपकरण',
      how: 'यह कैसे काम करता है',
      estimate: 'किराया अनुमान',
      faq: 'अक्सर पूछे जाने वाले सवाल',
      signIn: 'साइन इन',
      skip: 'सामग्री पर जाएं',
      growTogether: 'साथ मिलकर बढ़ें।',
    },
    hero: {
      eyebrow: 'समुदाय से जुड़ा। आपके खेत के लिए निर्मित।',
      titleLine1: 'सही उपकरण।',
      titleLine2: 'बेहतर अवसर।',
      titleEm: 'साथ मिलकर बढ़ें।',
      desc: 'आपके अगले काम के लिए सही मशीन जरूरी है। आसपास के उपकरण मालिकों से जुड़ें और अपने खेत के काम को सफल बनाएं।',
      findBtn: 'उपकरण खोजें',
      howBtn: 'देखें यह कैसे काम करता है',
      footNear: 'नजदीकी उपकरण से शुरू करें',
      footRecords: 'पारदर्शी किराया रिकॉर्ड',
      sceneLabel: 'खेत में एक बेहतर दिन',
      cardTitle: 'योजना बनाएं। बुक करें। काम शुरू करें।',
      cardSub: 'किराए के लिए एक ही मंच।',
      sceneCaption: 'स्थानीय संपर्क। साझा अवसर।',
    },
    principles: [
      'हर चरण के लिए उपकरण',
      'अपने समय के अनुसार बुकिंग',
      'मीटर आधारित बिलिंग',
      'किसान और मालिक, एक साथ',
    ],
    equipmentHead: {
      eyebrow: '01 / अपनी ज़रूरत चुनें',
      title: 'आपके खेत के लिए अगला कदम क्या है?',
      desc: 'संभावनाओं को जानें। अपने पास वास्तविक लिस्टिंग, दरें और उपलब्धता देखने के लिए साइन इन करें।',
      signInToExplore: 'उपकरण देखने के लिए साइन इन करें',
    },
    equipment: [
      { key: 'tractor', name: 'ट्रैक्टर', tag: 'खेत की मुख्य ज़रूरत', title: 'बड़ा काम। सही शक्ति।', description: 'जमीन तैयार करने से लेकर ढुलाई तक, अपने अगले काम के लिए उपयुक्त ट्रैक्टर खोजें।', uses: ['खेत की तैयारी', 'कृषि परिवहन', 'उपकरण संचालन'], color: 'tractor' },
      { key: 'harvest', name: 'हार्वेस्टर', tag: 'जब समय सबसे कीमती हो', title: 'कटाई के समय का पूरा लाभ उठाएं।', description: 'कटाई उपकरण खोजें और अपनी फसल और मौसम के अनुसार समय तय करें।', uses: ['फसल कटाई', 'मौसमी योजना', 'समय-स्लॉट बुकिंग'], color: 'harvest' },
      { key: 'implement', name: 'कृषि यंत्र', tag: 'अगली फसल की तैयारी', title: 'एक अच्छा मौसम मिट्टी से शुरू होता है।', description: 'खेत के काम के लिए यंत्र खोजें। मालिक से अनुकूलता और अटैचमेंट की पुष्टि करें।', uses: ['मिट्टी तैयार करना', 'खेत की जुताई', 'अटैचमेंट योजना'], color: 'implement' },
      { key: 'sprayer', name: 'स्प्रेयर', tag: 'हर एकड़ की उचित देखभाल', title: 'अपनी फसल को वह देखभाल दें जिसकी उसे ज़रूरत है।', description: 'स्प्रे उपकरण खोजें और मालिक से अपने खेत की जरूरतों पर चर्चा करें।', uses: ['फसल सुरक्षा', 'पूरे खेत में छिड़काव', 'निर्धारित किराया'], color: 'sprayer' },
    ],
    journeysHead: {
      eyebrow: '02 / काम का आसान तरीका',
      title: 'दो पहलू। एक समुदाय।',
    },
    journeys: {
      farmer: {
        label: 'किसानों के लिए',
        title: 'आपका खेत। आपका समय।',
        intro: 'उपकरण ढूंढने में कम समय और खेत में काम करने में अधिक समय लगाएं।',
        steps: [
          ['नजदीकी उपकरण खोजें', 'उपकरण के प्रकार और अपने खेत से दूरी के अनुसार खोजें।'],
          ['समय स्लॉट का अनुरोध करें', 'ज़रूरत का समय चुनें और मालिक की मंजूरी की प्रतीक्षा करें।'],
          ['पारदर्शी बिल के साथ काम पूरा करें', 'मीटर रीडिंग की पुष्टि करें और किराए का स्पष्ट रिकॉर्ड रखें।'],
        ],
        cta: 'अगली मशीन खोजें',
      },
      owner: {
        label: 'उपकरण मालिकों के लिए',
        title: 'खाली खड़े उपकरणों को काम पर लगाएं।',
        intro: 'अपनी लिस्टिंग, बुकिंग अनुरोध और किराए के रिकॉर्ड एक ही जगह संभालें।',
        steps: [
          ['अपनी लिस्टिंग बनाएं', 'अपने उपकरण, स्थान, किराया दर और उपलब्धता जोड़ें।'],
          ['बुकिंग अनुरोध प्रबंधित करें', 'अपने काम के अनुसार बुकिंग स्वीकार या अस्वीकार करें।'],
          ['हर किराए का हिसाब रखें', 'रीडिंग दर्ज करें, बिल बनाएं और किराए की कमाई देखें।'],
        ],
        cta: 'उपकरण सूचीबद्ध करना शुरू करें',
      },
    },
    calc: {
      eyebrow: '03 / बुकिंग से पहले स्पष्टता',
      title: 'थोड़ी सी योजना।\nकिराए का स्पष्ट हिसाब।',
      desc: 'बुक करने से पहले उदाहरण देखें। दर और काम की मात्रा बदलकर किराए का अनुमान लगाएं।',
      note: 'यह केवल एक उदाहरण कैलकुलेटर है, कोई अंतिम कोटेशन नहीं। वास्तविक दरें, उपलब्धता और अंतिम बिल आपकी बुकिंग पर निर्भर करते हैं।',
      cardTitle: 'किराया अनुमान देखें',
      exampleBadge: 'उदाहरण',
      unitLabel: 'मूल्य निर्धारण इकाई',
      perHour: 'प्रति घंटा',
      perAcre: 'प्रति एकड़',
      rateLabel: 'दर प्रति {unit} (₹)',
      workingHours: 'कार्य के घंटे',
      completedAcres: 'पूर्ण एकड़',
      transportLabel: 'परिवहन / मोबिलाइज़ेशन (₹)',
      totalLabel: 'अनुमानित कुल',
      validError: '₹0 से ₹1,00,000 तक की राशि दर्ज करें।',
      directPayment: 'भुगतान सीधे मालिक के साथ तय किया जाता है।',
    },
    faqHead: {
      eyebrow: 'ज़रूरी बातें',
      title: 'खेत में जाने\nसे पहले।',
      desc: 'आपके पहले किराए के लिए सरल उत्तर।',
    },
    faqs: [
      ['क्या मैं उपकरण किराए पर लेने के साथ अपना भी सूचीबद्ध कर सकता हूँ?', 'हाँ। खाता बनाते समय किसान और मालिक दोनों भूमिकाएं चुनें।'],
      ['किराए का अंतिम बिल कैसे बनता है?', 'बुकिंग उपकरण की निर्धारित किराया दर का उपयोग करती है। प्रति घंटा किराए में मीटर रीडिंग और प्रति एकड़ में पूर्ण एकड़ का उपयोग होता है।'],
      ['क्या भुगतान यंत्रसेतु के माध्यम से होता है?', 'भुगतान किसान और मालिक के बीच सीधे तय होता है। यंत्रसेतु केवल बिल और मैन्युअल रिपोर्ट किए गए स्टेटस का रिकॉर्ड रखता है।'],
      ['क्या अनुरोधित समय स्लॉट तुरंत पक्का हो जाता है?', 'अनुरोध तब तक लंबित रहता है जब तक मालिक इसे स्वीकार न कर ले। काम की योजना बनाने से पहले स्थिति जरूर जांचें।'],
    ],
    final: {
      eyebrow: 'अगले सीजन की शुरुआत एक नए संपर्क से',
      title: 'आइए खेत में एक\nसफल दिन बनाएं।',
      btn: 'यंत्रसेतु के साथ शुरू करें',
      sub: 'उपकरण किराए पर लें। अवसर साझा करें। साथ मिलकर बढ़ें।',
    },
    footer: {
      tagline: 'कृषि, परस्पर जुड़ी हुई।',
      note: 'उन लोगों के लिए निर्मित जो हमारे खेतों को आगे बढ़ाते हैं।',
      backToTop: 'वापस ऊपर जाएं ↑',
    },
  },
  pa: {
    nav: {
      equipment: 'ਸਾਜੋ-ਸਾਮਾਨ',
      how: 'ਇਹ ਕਿਵੇਂ ਕੰਮ ਕਰਦਾ ਹੈ',
      estimate: 'ਕਿਰਾਇਆ ਅੰਦਾਜ਼ਾ',
      faq: 'ਅਕਸਰ ਪੁੱਛੇ ਜਾਂਦੇ ਸਵਾਲ',
      signIn: 'ਸਾਈਨ ਇਨ',
      skip: 'ਸਮੱਗਰੀ ਤੇ ਜਾਓ',
      growTogether: 'ਇਕੱਠੇ ਵਧੋ।',
    },
    hero: {
      eyebrow: 'ਭਾਈਚਾਰੇ ਨਾਲ ਜੁੜਿਆ। ਤੁਹਾਡੇ ਖੇਤ ਲਈ ਬਣਿਆ।',
      titleLine1: 'ਵਧੀਆ ਸੰਦ।',
      titleLine2: 'ਵੱਡੇ ਮੌਕੇ।',
      titleEm: 'ਇਕੱਠੇ ਵਧੋ।',
      desc: 'ਤੁਹਾਡੇ ਅਗਲੇ ਕੰਮ ਲਈ ਸਹੀ ਮਸ਼ੀਨ ਜ਼ਰੂਰੀ ਹੈ। ਨੇੜਲੇ ਮਾਲਕਾਂ ਨਾਲ ਜੁੜੋ ਅਤੇ ਆਪਣੇ ਖੇਤ ਦਾ ਕੰਮ ਸੌਖਾ ਕਰੋ।',
      findBtn: 'ਮਸ਼ੀਨਰੀ ਲੱਭੋ',
      howBtn: 'ਦੇਖੋ ਇਹ ਕਿਵੇਂ ਕੰਮ ਕਰਦਾ ਹੈ',
      footNear: 'ਨੇੜਲੇ ਸੰਦਾਂ ਤੋਂ ਸ਼ੁਰੂ ਕਰੋ',
      footRecords: 'ਸਾਫ਼ ਕਿਰਾਇਆ ਰਿਕਾਰਡ',
      sceneLabel: 'ਖੇਤ ਵਿੱਚ ਇੱਕ ਵਧੀਆ ਦਿਨ',
      cardTitle: 'ਯੋਜਨਾ ਬਣਾਓ। ਬੁੱਕ ਕਰੋ। ਕੰਮ ਸ਼ੁਰੂ ਕਰੋ।',
      cardSub: 'ਕਿਰਾਏ ਲਈ ਇੱਕੋ ਥਾਂ।',
      sceneCaption: 'ਸਥਾਨਕ ਸਾਂਝ। ਸਾਂਝੇ ਮੌਕੇ।',
    },
    principles: [
      'ਹਰ ਪੜਾਅ ਲਈ ਸੰਦ',
      'ਆਪਣੇ ਸਮੇਂ ਅਨੁਸਾਰ ਬੁੱਕ ਕਰੋ',
      'ਮੀਟਰ ਆਧਾਰਿਤ ਬਿਲਿੰਗ',
      'ਕਿਸਾਨ ਤੇ ਮਾਲਕ, ਇਕੱਠੇ',
    ],
    equipmentHead: {
      eyebrow: '01 / ਆਪਣੀ ਲੋੜ ਚੁਣੋ',
      title: 'ਤੁਹਾਡੇ ਖੇਤ ਲਈ ਅਗਲਾ ਕੰਮ ਕੀ ਹੈ?',
      desc: 'ਮੌਕੇ ਵੇਖੋ। ਆਪਣੇ ਨੇੜੇ ਅਸਲ ਲਿਸਟਿੰਗ, ਦਰਾਂ ਅਤੇ ਉਪਲਬਧਤਾ ਵੇਖਣ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ।',
      signInToExplore: 'ਮਸ਼ੀਨਰੀ ਵੇਖਣ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ',
    },
    equipment: [
      { key: 'tractor', name: 'ਟਰੈਕਟਰ', tag: 'ਖੇਤ ਦੀ ਮੁੱਖ ਲੋੜ', title: 'ਵੱਡਾ ਕੰਮ। ਸਹੀ ਤਾਕਤ।', description: 'ਜ਼ਮੀਨ ਤਿਆਰ ਕਰਨ ਤੋਂ ਲੈ ਕੇ ਢੋਆ-ਢੁਆਈ ਤੱਕ, ਆਪਣੇ ਅਗਲੇ ਕੰਮ ਲਈ ਸਹੀ ਟਰੈਕਟਰ ਲੱਭੋ।', uses: ['ਜ਼ਮੀਨ ਦੀ ਤਿਆਰੀ', 'ਖੇਤੀ ਢੋਆ-ਢੁਆਈ', 'ਸੰਦ ਚਲਾਉਣਾ'], color: 'tractor' },
      { key: 'harvest', name: 'ਹਾਰਵੈਸਟਰ', tag: 'ਜਦੋਂ ਸਮਾਂ ਸਭ ਤੋਂ ਕੀਮਤੀ ਹੋਵੇ', title: 'ਵਾਢੀ ਦੇ ਸਮੇਂ ਦਾ ਪੂਰਾ ਲਾਹਾ ਲਓ।', description: 'ਵਾਢੀ ਦੀਆਂ ਮਸ਼ੀਨਾਂ ਲੱਭੋ ਅਤੇ ਆਪਣੀ ਫ਼ਸਲ ਤੇ ਮੌਸਮ ਅਨੁਸਾਰ ਸਮਾਂ ਤੈਅ ਕਰੋ।', uses: ['ਫ਼ਸਲ ਵਾਢੀ', 'ਮੌਸਮੀ ਯੋਜਨਾ', 'ਸਮਾਂ-ਸਲਾਟ ਬੁਕਿੰਗ'], color: 'harvest' },
      { key: 'implement', name: 'ਖੇਤੀ ਸੰਦ', tag: 'ਅਗਲੀ ਫ਼ਸਲ ਦੀ ਤਿਆਰੀ', title: 'ਇੱਕ ਵਧੀਆ ਸੀਜ਼ਨ ਮਿੱਟੀ ਤੋਂ ਸ਼ੁਰੂ ਹੁੰਦਾ ਹੈ।', description: 'ਖੇਤ ਦੇ ਕੰਮ ਲਈ ਸੰਦ ਵੇਖੋ। ਮਾਲਕ ਨਾਲ ਅਨੁਕੂਲਤਾ ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ।', uses: ['ਮਿੱਟੀ ਤਿਆਰ ਕਰਨਾ', 'ਖੇਤ ਵਾਹੁਣਾ', 'ਸੰਦ ਜੋੜਨ ਦੀ ਯੋਜਨਾ'], color: 'implement' },
      { key: 'sprayer', name: 'ਸਪਰੇਅਰ', tag: 'ਹਰ ਏਕੜ ਦੀ ਪੂਰੀ ਸੰਭਾਲ', title: 'ਆਪਣੀ ਫ਼ਸਲ ਨੂੰ ਲੋੜੀਂਦੀ ਸੰਭਾਲ ਦਿਓ।', description: 'ਸਪਰੇਅ ਸੰਦ ਲੱਭੋ ਅਤੇ ਮਾਲਕ ਨਾਲ ਆਪਣੇ ਖੇਤ ਦੀਆਂ ਲੋੜਾਂ ਬਾਰੇ ਗੱਲ ਕਰੋ।', uses: ['ਫ਼ਸਲ ਸੁਰੱਖਿਆ', 'ਖੇਤ ਵਿੱਚ ਛਿੜਕਾਅ', 'ਤੈਅਸ਼ੁਦਾ ਕਿਰਾਇਆ'], color: 'sprayer' },
    ],
    journeysHead: {
      eyebrow: '02 / ਕੰਮ ਦਾ ਸੌਖਾ ਤਰੀਕਾ',
      title: 'ਦੋ ਪੱਖ। ਇੱਕ ਭਾਈਚਾਰਾ।',
    },
    journeys: {
      farmer: {
        label: 'ਕਿਸਾਨਾਂ ਲਈ',
        title: 'ਤੁਹਾਡਾ ਖੇਤ। ਤੁਹਾਡਾ ਸਮਾਂ।',
        intro: 'ਸੰਦ ਲੱਭਣ ਵਿੱਚ ਘੱਟ ਸਮਾਂ ਅਤੇ ਖੇਤ ਵਿੱਚ ਕੰਮ ਕਰਨ ਲਈ ਵੱਧ ਸਮਾਂ ਲਗਾਓ।',
        steps: [
          ['ਨੇੜਲੀ ਮਸ਼ੀਨਰੀ ਲੱਭੋ', 'ਕਿਸਮ ਅਤੇ ਆਪਣੇ ਖੇਤ ਤੋਂ ਦੂਰੀ ਅਨੁਸਾਰ ਲੱਭੋ।'],
          ['ਸਮਾਂ ਸਲਾਟ ਦੀ ਬੇਨਤੀ ਕਰੋ', 'ਲੋੜੀਂਦਾ ਸਮਾਂ ਚੁਣੋ ਅਤੇ ਮਾਲਕ ਦੀ ਪ੍ਰਵਾਨਗੀ ਦੀ ਉਡੀਕ ਕਰੋ।'],
          ['ਸਾਫ਼ ਬਿਲ ਨਾਲ ਕੰਮ ਨਿਬੇੜੋ', 'ਮੀਟਰ ਰੀਡਿੰਗ ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ ਅਤੇ ਕਿਰਾਏ ਦਾ ਰਿਕਾਰਡ ਰੱਖੋ।'],
        ],
        cta: 'ਅਗਲੀ ਮਸ਼ੀਨ ਲੱਭੋ',
      },
      owner: {
        label: 'ਮਸ਼ੀਨਰੀ ਮਾਲਕਾਂ ਲਈ',
        title: 'ਖੜ੍ਹੀ ਮਸ਼ੀਨਰੀ ਨੂੰ ਕੰਮ ਲਾਓ।',
        intro: 'ਆਪਣੀ ਲਿਸਟਿੰਗ, ਬੁਕਿੰਗ ਬੇਨਤੀਆਂ ਅਤੇ ਕਿਰਾਏ ਦਾ ਰਿਕਾਰਡ ਇੱਕੋ ਥਾਂ ਰੱਖੋ।',
        steps: [
          ['ਆਪਣੀ ਲਿਸਟਿੰਗ ਬਣਾਓ', 'ਆਪਣੇ ਸੰਦ, ਸਥਾਨ, ਕਿਰਾਇਆ ਦਰ ਅਤੇ ਉਪਲਬਧਤਾ ਦਰਜ ਕਰੋ।'],
          ['ਬੁਕਿੰਗ ਬੇਨਤੀਆਂ ਸੰਭਾਲੋ', 'ਆਪਣੇ ਕੰਮ ਅਨੁਸਾਰ ਬੁਕਿੰਗ ਮਨਜ਼ੂਰ ਜਾਂ ਰੱਦ ਕਰੋ।'],
          ['ਹਰ ਕਿਰਾਏ ਦਾ ਹਿਸਾਬ ਰੱਖੋ', 'ਰੀਡਿੰਗ ਦਰਜ ਕਰੋ, ਬਿਲ ਬਣਾਓ ਅਤੇ ਕਮਾਈ ਵੇਖੋ।'],
        ],
        cta: 'ਸੰਦ ਸੂਚੀਬੱਧ ਕਰਨੇ ਸ਼ੁਰੂ ਕਰੋ',
      },
    },
    calc: {
      eyebrow: '03 / ਬੁੱਕ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਸਪਸ਼ਟਤਾ',
      title: 'ਥੋੜ੍ਹੀ ਜਿਹੀ ਯੋਜਨਾ।\nਕਿਰਾਏ ਦਾ ਸਾਫ਼ ਹਿਸਾਬ।',
      desc: 'ਬੁੱਕ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਮਿਸਾਲ ਵੇਖੋ। ਦਰ ਅਤੇ ਕੰਮ ਦਾ ਅੰਦਾਜ਼ਾ ਲਗਾਓ।',
      note: 'ਇਹ ਕੇਵਲ ਇੱਕ ਅੰਦਾਜ਼ਾ ਹੈ, ਕੋਈ ਪੱਕਾ ਬਿਲ ਨਹੀਂ। ਅਸਲ ਦਰਾਂ ਅਤੇ ਬਿਲ ਬੁਕਿੰਗ ਅਨੁਸਾਰ ਹੋਣਗੇ।',
      cardTitle: 'ਕਿਰਾਇਆ ਅੰਦਾਜ਼ਾ ਵੇਖੋ',
      exampleBadge: 'ਉਦਾਹਰਨ',
      unitLabel: 'ਦਰ ਦੀ ਇਕਾਈ',
      perHour: 'ਪ੍ਰਤੀ ਘੰਟਾ',
      perAcre: 'ਪ੍ਰਤੀ ਏਕੜ',
      rateLabel: 'ਦਰ ਪ੍ਰਤੀ {unit} (₹)',
      workingHours: 'ਕੰਮ ਦੇ ਘੰਟੇ',
      completedAcres: 'ਮੁਕੰਮਲ ਏਕੜ',
      transportLabel: 'ਢੋਆ-ਢੁਆਈ (₹)',
      totalLabel: 'ਕੁੱਲ ਅੰਦਾਜ਼ਾ',
      validError: '₹0 ਤੋਂ ₹1,00,000 ਤੱਕ ਦੀ ਰਕਮ ਦਰਜ ਕਰੋ।',
      directPayment: 'ਭੁਗਤਾਨ ਸਿੱਧਾ ਮਾਲਕ ਨਾਲ ਤੈਅ ਕੀਤਾ ਜਾਂਦਾ ਹੈ।',
    },
    faqHead: {
      eyebrow: 'ਕੁਝ ਜ਼ਰੂਰੀ ਗੱਲਾਂ',
      title: 'ਖੇਤ ਜਾਣ\nਤੋਂ ਪਹਿਲਾਂ।',
      desc: 'ਤੁਹਾਡੇ ਪਹਿਲੇ ਕਿਰਾਏ ਲਈ ਸੌਖੇ ਜਵਾਬ।',
    },
    faqs: [
      ['ਕੀ ਮੈਂ ਮਸ਼ੀਨਰੀ ਕਿਰਾਏ ਤੇ ਲੈਣ ਦੇ ਨਾਲ ਆਪਣੀ ਵੀ ਲਿਸਟ ਕਰ ਸਕਦਾ ਹਾਂ?', 'ਹਾਂ। ਖਾਤਾ ਬਣਾਉਂਦੇ ਸਮੇਂ ਕਿਸਾਨ ਅਤੇ ਮਾਲਕ ਦੋਵੇਂ ਭੂਮਿਕਾਵਾਂ ਚੁਣੋ।'],
      ['ਕਿਰਾਏ ਦਾ ਅੰਤਿਮ ਬਿਲ ਕਿਵੇਂ ਬਣਦਾ ਹੈ?', 'ਬੁਕਿੰਗ ਮਸ਼ੀਨ ਦੀ ਤੈਅ ਕਿਰਾਇਆ ਦਰ ਵਰਤਦੀ ਹੈ। ਪ੍ਰਤੀ ਘੰਟੇ ਵਿੱਚ ਮੀਟਰ ਰੀਡਿੰਗ ਅਤੇ ਪ੍ਰਤੀ ਏਕੜ ਵਿੱਚ ਵਾਹੀ ਜ਼ਮੀਨ ਦਾ ਹਿਸਾਬ ਹੁੰਦਾ ਹੈ।'],
      ['ਕੀ ਭੁਗਤਾਨ ਯੰਤਰਸੇਤੂ ਰਾਹੀਂ ਹੁੰਦਾ ਹੈ?', 'ਭੁਗਤਾਨ ਕਿਸਾਨ ਅਤੇ ਮਾਲਕ ਵਿਚਕਾਰ ਸਿੱਧਾ ਹੁੰਦਾ ਹੈ। ਯੰਤਰਸੇਤੂ ਕੇਵਲ ਬਿਲ ਅਤੇ ਰਿਕਾਰਡ ਰੱਖਦਾ ਹੈ।'],
      ['ਕੀ ਮੰਗਿਆ ਗਿਆ ਸਮਾਂ ਤੁਰੰਤ ਪੱਕਾ ਹੋ ਜਾਂਦਾ ਹੈ?', 'ਬੇਨਤੀ ਉਦੋਂ ਤੱਕ ਉਡੀਕ ਅਧੀਨ ਰਹਿੰਦੀ ਹੈ ਜਦੋਂ ਤੱਕ ਮਾਲਕ ਪ੍ਰਵਾਨ ਨਾ ਕਰੇ। ਕੰਮ ਸ਼ੁਰੂ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਸਥਿਤੀ ਜ਼ਰੂਰ ਵੇਖੋ।'],
    ],
    final: {
      eyebrow: 'ਅਗਲੇ ਸੀਜ਼ਨ ਦੀ ਸ਼ੁਰੂਆਤ ਨਵੀਂ ਸਾਂਝ ਨਾਲ',
      title: 'ਆਓ ਖੇਤ ਵਿੱਚ ਇੱਕ\nਚੰਗਾ ਦਿਨ ਬਣਾਈਏ।',
      btn: 'ਯੰਤਰਸੇਤੂ ਨਾਲ ਸ਼ੁਰੂ ਕਰੋ',
      sub: 'ਮਸ਼ੀਨਰੀ ਕਿਰਾਏ \'ਤੇ ਲਓ। ਮੌਕੇ ਸਾਂਝੇ ਕਰੋ। ਇਕੱਠੇ ਵਧੋ।',
    },
    footer: {
      tagline: 'ਖੇਤੀਬਾੜੀ, ਆਪਸ ਵਿੱਚ ਜੁੜੀ ਹੋਈ।',
      note: 'ਉਹਨਾਂ ਲੋਕਾਂ ਲਈ ਬਣਾਇਆ ਜੋ ਸਾਡੇ ਖੇਤਾਂ ਨੂੰ ਹਰਿਆ-ਭਰਿਆ ਰੱਖਦੇ ਹਨ।',
      backToTop: 'ਉੱਪਰ ਵਾਪਸ ਜਾਓ ↑',
    },
  },
};

const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

export function HomePage({ onSignIn, lang = 'en', setLang }) {
  const [menu, setMenu] = useState(false);
  const [selected, setSelected] = useState(0);
  const [role, setRole] = useState('farmer');
  const [unit, setUnit] = useState('hour');
  const [quantity, setQuantity] = useState(4);
  const [rate, setRate] = useState('650');
  const [transport, setTransport] = useState('250');
  const [faq, setFaq] = useState(null);

  const t = contentByLang[lang] || contentByLang.en;
  const machine = t.equipment[selected] || t.equipment[0];
  const MachineIcon = equipmentIcons[machine.key] || Tractor;
  const journey = t.journeys[role] || t.journeys.farmer;

  const rateNumber = Number(rate);
  const transportNumber = Number(transport);
  const validEstimate = rate !== '' && transport !== '' && Number.isFinite(rateNumber) && rateNumber >= 0 && rateNumber <= 100000 && Number.isFinite(transportNumber) && transportNumber >= 0 && transportNumber <= 100000;

  const unitText = unit === 'hour' ? t.calc.perHour.toLowerCase() : t.calc.perAcre.toLowerCase();

  return (
    <div className="ys-home" id="ys-top">
      <a className="ys-skip" href="#ys-main">{t.nav.skip}</a>
      <header className="ys-nav">
        <a className="ys-logo" href="#ys-top" aria-label="YantraSetu home">
          <span><Sprout size={25} /></span>
          <div>YantraSetu<small>{t.nav.growTogether}</small></div>
        </a>
        <nav className={menu ? 'ys-links is-open' : 'ys-links'} aria-label="Main navigation">
          {[
            [t.nav.equipment, '#ys-equipment'],
            [t.nav.how, '#ys-how'],
            [t.nav.estimate, '#ys-estimate'],
            [t.nav.faq, '#ys-faq'],
          ].map(([label, href]) => (
            <a href={href} key={href} onClick={() => setMenu(false)}>{label}</a>
          ))}
        </nav>
        <div className="ys-nav-actions">
          {setLang && (
            <select
              className="ys-language"
              aria-label="Language"
              value={lang}
              onChange={e => setLang(e.target.value)}
            >
              <option value="en">EN</option>
              <option value="hi">हिन्दी</option>
              <option value="pa">ਪੰਜਾਬੀ</option>
            </select>
          )}
          <button className="ys-btn ys-btn-dark" onClick={onSignIn}>
            {t.nav.signIn} <ArrowUpRight size={16} />
          </button>
          <button
            className="ys-menu"
            aria-label={menu ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      <main id="ys-main">
        {/* Hero Section */}
        <section className="ys-hero">
          <div className="ys-hero-copy">
            <span className="ys-eyebrow"><span className="ys-dot" /> {t.hero.eyebrow}</span>
            <h1>
              {t.hero.titleLine1}<br />
              {t.hero.titleLine2}<br />
              <em>{t.hero.titleEm}</em>
            </h1>
            <p>{t.hero.desc}</p>
            <div className="ys-actions">
              <button className="ys-btn ys-btn-lime" onClick={onSignIn}>
                {t.hero.findBtn} <ArrowUpRight size={19} />
              </button>
              <a className="ys-text-link" href="#ys-how">
                {t.hero.howBtn} <ArrowRight size={17} />
              </a>
            </div>
            <div className="ys-hero-foot">
              <span><MapPin size={15} /> {t.hero.footNear}</span>
              <span><ShieldCheck size={15} /> {t.hero.footRecords}</span>
            </div>
          </div>
          <div className="ys-hero-scene" aria-label="Illustrated tractor in farmland">
            <div className="ys-scene-label"><span className="ys-dot" /> {t.hero.sceneLabel}</div>
            <div className="ys-hill ys-hill-back" />
            <div className="ys-hill ys-hill-front" />
            <TractorArt large />
            <div className="ys-scene-card">
              <span className="ys-scene-icon"><CalendarDays size={21} /></span>
              <div>
                <strong>{t.hero.cardTitle}</strong>
                <small>{t.hero.cardSub}</small>
              </div>
              <ArrowUpRight size={21} />
            </div>
            <span className="ys-scene-caption">{t.hero.sceneCaption}</span>
          </div>
        </section>

        {/* Principles Bar */}
        <div className="ys-principles">
          <span><Tractor /> {t.principles[0]}</span>
          <span><CalendarDays /> {t.principles[1]}</span>
          <span><ShieldCheck /> {t.principles[2]}</span>
          <span><Sprout /> {t.principles[3]}</span>
        </div>

        {/* Equipment Categories */}
        <section className="ys-section" id="ys-equipment">
          <div className="ys-section-head">
            <div>
              <span className="ys-eyebrow">{t.equipmentHead.eyebrow}</span>
              <h2>{t.equipmentHead.title}</h2>
            </div>
            <p>{t.equipmentHead.desc}</p>
          </div>
          <div className="ys-equipment-tabs" aria-label="Equipment categories">
            {t.equipment.map((item, i) => {
              const IconComp = equipmentIcons[item.key] || Tractor;
              return (
                <button
                  key={item.key}
                  aria-pressed={selected === i}
                  className={selected === i ? 'is-selected' : ''}
                  onClick={() => setSelected(i)}
                >
                  <IconComp size={24} />
                  <span>{item.name}</span>
                  <ArrowUpRight size={16} />
                </button>
              );
            })}
          </div>
          <div className={`ys-equipment-detail ys-${machine.color}`}>
            <div className="ys-equipment-visual">
              <MachineIcon size={112} strokeWidth={1} />
              <span>{machine.name.toUpperCase()}</span>
              <span className="ys-visual-number">0{selected + 1}</span>
            </div>
            <div className="ys-equipment-copy" aria-live="polite">
              <span className="ys-eyebrow">{machine.tag}</span>
              <h3>{machine.title}</h3>
              <p>{machine.description}</p>
              <div className="ys-pills">
                {machine.uses.map(use => (
                  <span key={use}><Check size={13} />{use}</span>
                ))}
              </div>
              <button className="ys-text-link" onClick={onSignIn}>
                {t.equipmentHead.signInToExplore} <ArrowUpRight size={18} />
              </button>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="ys-how-wrap" id="ys-how">
          <div className="ys-section">
            <div className="ys-section-head">
              <div>
                <span className="ys-eyebrow">{t.journeysHead.eyebrow}</span>
                <h2>{t.journeysHead.title}</h2>
              </div>
              <div className="ys-role-switch" aria-label="Choose your perspective">
                {Object.entries(t.journeys).map(([key, value]) => (
                  <button
                    key={key}
                    aria-pressed={role === key}
                    onClick={() => setRole(key)}
                  >
                    {value.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="ys-journey" aria-live="polite">
              <div>
                <h3>{journey.title}</h3>
                <p>{journey.intro}</p>
                <button className="ys-btn ys-btn-dark" onClick={onSignIn}>
                  {journey.cta} <ArrowUpRight size={17} />
                </button>
              </div>
              <ol>
                {journey.steps.map(([title, body], i) => (
                  <li key={title}>
                    <span>0{i + 1}</span>
                    <div>
                      <h4>{title}</h4>
                      <p>{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Rental Estimate Calculator */}
        <section className="ys-section ys-calculator" id="ys-estimate">
          <div>
            <span className="ys-eyebrow">{t.calc.eyebrow}</span>
            <h2>{t.calc.title.split('\n').map((line, idx) => (
              <React.Fragment key={idx}>{line}{idx === 0 && <br />}</React.Fragment>
            ))}</h2>
            <p>{t.calc.desc}</p>
            <div className="ys-estimate-note">
              <ShieldCheck size={22} />
              <p>{t.calc.note}</p>
            </div>
          </div>
          <div className="ys-estimate-card">
            <div className="ys-estimate-top">
              <h3>{t.calc.cardTitle}</h3>
              <span>{t.calc.exampleBadge}</span>
            </div>
            <div className="ys-estimate-inputs">
              <label>
                {t.calc.unitLabel}
                <select value={unit} onChange={e => setUnit(e.target.value)}>
                  <option value="hour">{t.calc.perHour}</option>
                  <option value="acre">{t.calc.perAcre}</option>
                </select>
              </label>
              <label>
                {t.calc.rateLabel.replace('{unit}', unitText)}
                <input
                  type="number"
                  min="0"
                  max="100000"
                  step="1"
                  value={rate}
                  onChange={e => setRate(e.target.value)}
                />
              </label>
            </div>
            <label className="ys-range-label" htmlFor="ys-quantity">
              {unit === 'hour' ? t.calc.workingHours : t.calc.completedAcres}
              <strong>{quantity} {unit === 'hour' ? (lang === 'hi' ? 'घंटे' : lang === 'pa' ? 'ਘੰਟੇ' : 'hours') : (lang === 'hi' ? 'एकड़' : lang === 'pa' ? 'ਏਕੜ' : 'acres')}</strong>
            </label>
            <input
              id="ys-quantity"
              type="range"
              min="1"
              max="24"
              value={quantity}
              onChange={e => setQuantity(Number(e.target.value))}
            />
            <label className="ys-transport">
              {t.calc.transportLabel}
              <input
                type="number"
                min="0"
                max="100000"
                step="1"
                value={transport}
                onChange={e => setTransport(e.target.value)}
              />
            </label>
            <div className="ys-total" aria-live="polite">
              <div>
                <span>{t.calc.totalLabel}</span>
                <small>
                  {validEstimate
                    ? `${quantity} × ${money(rateNumber)} + ${money(transportNumber)}`
                    : t.calc.validError}
                </small>
              </div>
              <strong>{validEstimate ? money(quantity * rateNumber + transportNumber) : '—'}</strong>
            </div>
            <p>{t.calc.directPayment}</p>
          </div>
        </section>

        {/* FAQs */}
        <section className="ys-section ys-faq" id="ys-faq">
          <div>
            <span className="ys-eyebrow">{t.faqHead.eyebrow}</span>
            <h2>{t.faqHead.title.split('\n').map((line, idx) => (
              <React.Fragment key={idx}>{line}{idx === 0 && <br />}</React.Fragment>
            ))}</h2>
            <p>{t.faqHead.desc}</p>
          </div>
          <div>
            {t.faqs.map(([q, a], i) => (
              <div className="ys-faq-item" key={q}>
                <h3>
                  <button
                    aria-expanded={faq === i}
                    aria-controls={`ys-answer-${i}`}
                    onClick={() => setFaq(faq === i ? null : i)}
                  >
                    {q}
                    {faq === i ? <Minus size={18} /> : <Plus size={18} />}
                  </button>
                </h3>
                <div id={`ys-answer-${i}`} hidden={faq !== i}>
                  <p>{a}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="ys-final">
          <Sprout size={42} strokeWidth={1.3} />
          <span className="ys-eyebrow">{t.final.eyebrow}</span>
          <h2>{t.final.title.split('\n').map((line, idx) => (
            <React.Fragment key={idx}>{line}{idx === 0 && <br />}</React.Fragment>
          ))}</h2>
          <button className="ys-btn ys-btn-lime" onClick={onSignIn}>
            {t.final.btn} <ArrowUpRight size={18} />
          </button>
          <p>{t.final.sub}</p>
        </section>
      </main>

      <footer className="ys-footer">
        <a className="ys-logo" href="#ys-top">
          <Sprout />
          <div>YantraSetu<small>{t.footer.tagline}</small></div>
        </a>
        <p>{t.footer.note}</p>
        <a href="#ys-top">{t.footer.backToTop}</a>
      </footer>
    </div>
  );
}
