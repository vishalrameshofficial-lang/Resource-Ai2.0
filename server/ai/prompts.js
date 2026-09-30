export const CONVERSATION_STAGES = {
  GREETING: 'GREETING',
  EMERGENCY: 'EMERGENCY',
  LOCATION: 'LOCATION',
  PEOPLE: 'PEOPLE',
  RESOURCES: 'RESOURCES',
  CONFIRMATION: 'CONFIRMATION',
  SUBMISSION: 'SUBMISSION',
  COMPLETED: 'COMPLETED'
};

export const MULTILINGUAL_STRINGS = {
  English: {
    greeting: "ResourceAI emergency assistance. What is the emergency?",
    askEmergency: "What is the emergency?",
    askLocation: "Where is the emergency happening?",
    askPeople: "How many people are affected?",
    askResources: "What help or resources do you need?",
    confirmation: (loc, count, res) => `I have the emergency at ${loc}, affecting ${count} people, and requiring ${res}. Is that correct?`,
    recorded: (reqId) => `Thank you. Your emergency request has been recorded in ResourceAI. Your request ID is ${reqId}. Our operations team will process this for relief coordination.`,
    clarify: "Please say yes to confirm, or tell me the correct details.",
    safetyRuleReminder: "Your emergency details are recorded in ResourceAI. Please move to higher ground or a secure location if safe to do so."
  },
  Tamil: {
    greeting: "வணக்கம், ResourceAI அவசர உதவி. என்ன அவசர நிலை என்று கூறுங்கள்.",
    askEmergency: "என்ன அவசர நிலை என்று கூறுங்கள்.",
    askLocation: "நீங்கள் இருக்கும் இடம் அல்லது அருகிலுள்ள அடையாளம் எது?",
    askPeople: "எத்தனை பேர் பாதிக்கப்பட்டுள்ளனர்?",
    askResources: "உங்களுக்கு என்ன உதவி அல்லது பொருட்கள் தேவை?",
    askUrgency: "உடனடி ஆபத்து உள்ளதா?",
    confirmation: (loc, count, res) => `இடம்: ${loc}, பாதிக்கப்பட்டவர்கள்: ${count} பேர், தேவை: ${res}. சரியா?`,
    recorded: (reqId) => `நன்றி. உங்கள் அவசர கோரிக்கை ResourceAI அமைப்பில் பதிவு செய்யப்பட்டுள்ளது. உங்கள் கோரிக்கை எண் ${reqId}.`,
    clarify: "உறுதிப்படுத்த ஆம் என்று சொல்லுங்கள், அல்லது சரியானதை கூறுங்கள்.",
    safetyRuleReminder: "பாதுகாப்பான இடத்திற்குச் செல்லுங்கள்."
  },
  Hindi: {
    greeting: "नमस्ते, ResourceAI आपातकालीन सहायता। क्या आपात स्थिति है?",
    askEmergency: "क्या आपात स्थिति है?",
    askLocation: "कृपया अपना स्थान या नजदीकी लैंडमार्क बताएं?",
    askPeople: "लगभग कितने लोग प्रभावित हैं?",
    askResources: "आपको क्या सहायता या सामग्री चाहिए?",
    askUrgency: "क्या तुरंत खतरा है?",
    confirmation: (loc, count, res) => `स्थान: ${loc}, ${count} लोग प्रभावित, आवश्यकता: ${res}। क्या यह सही है?`,
    recorded: (reqId) => `धन्यवाद। आपका आपातकालीन अनुरोध ResourceAI में दर्ज कर लिया गया है। आपकी अनुरोध संख्या ${reqId} है।`,
    clarify: "कृपया पुष्टि के लिए हाँ कहें, या सही जानकारी दें।",
    safetyRuleReminder: "सुरक्षित स्थान पर रहें।"
  },
  Telugu: {
    greeting: "నమస్కారం, ResourceAI అత్యవసర సహాయం. ఏం జరిగిందో చెప్పండి.",
    askEmergency: "ఏం జరిగిందో చెప్పండి.",
    askLocation: "మీ ప్రాంతం లేదా సమీప ల్యాండ్‌మార్క్ చెప్పండి?",
    askPeople: "ఎంతమంది ప్రభావితమయ్యారు?",
    askResources: "మీకు ఎలాంటి సహాయం లేదా సామగ్రి కావాలి?",
    askUrgency: "తక్షణ ప్రమాదం ఉందా?",
    confirmation: (loc, count, res) => `ప్రాంతం ${loc}, ${count} మంది, అవసరం ${res}. సరైనదేనా?`,
    recorded: (reqId) => `ధన్యవాదాలు. మీ అభ్యర్థన ResourceAI లో నమోదు చేయబడింది. రిక్వెస్ట్ ఐడి ${reqId}.`,
    clarify: "ధృవీకరించడానికి అవును అని చెప్పండి.",
    safetyRuleReminder: "సురక్షిత ప్రాంతంలో ఉండండి."
  },
  Malayalam: {
    greeting: "നമസ്കാരം, ResourceAI അടിയന്തര സഹായം. എന്താണ് സംഭവിച്ചതെന്ന് പറയൂ.",
    askEmergency: "എന്താണ് സംഭവിച്ചതെന്ന് പറയൂ.",
    askLocation: "നിങ്ങൾ നിൽക്കുന്ന സ്ഥലമോ അടയാളമോ പറയാമോ?",
    askPeople: "എത്ര ആളുകൾ കുടുങ്ങിക്കിടക്കുന്നുണ്ട്?",
    askResources: "എന്തൊക്കെ സഹായങ്ങളാണ് ആവശ്യമായിട്ടുള്ളത്?",
    askUrgency: "പെട്ടെന്ന് അപകടമുണ്ടോ?",
    confirmation: (loc, count, res) => `സ്ഥലം ${loc}, ${count} ആളുകൾ, ആവശ്യമുള്ളത് ${res}. ശരിയാണോ?`,
    recorded: (reqId) => `നന്ദി. നിങ്ങളുടെ അടിയന്തര അപേക്ഷ ResourceAI-ൽ രേഖപ്പെടുത്തിയിട്ടുണ്ട്. നിങ്ങളുടെ അഭ്യർത്ഥന ഐഡി ${reqId}.`,
    clarify: "സ്ഥിരീകരിക്കാൻ അതെ എന്ന് പറയൂ.",
    safetyRuleReminder: "സുരക്ഷിതമായ സ്ഥാനത്തേക്ക് മാറുക."
  },
  Kannada: {
    greeting: "ನಮಸ್ಕಾರ, ResourceAI ತುರ್ತು ಸಹಾಯವಾಣಿ. ಏನಾಯಿತು ಎಂದು ತಿಳಿಸಿ.",
    askEmergency: "ಏನಾಯಿತು ಎಂದು ತಿಳಿಸಿ.",
    askLocation: "ನಿಮ್ಮ ಸ್ಥಳ ಅಥವಾ ಗುರುತನ್ನು ತಿಳಿಸಿ?",
    askPeople: "ಎಷ್ಟು ಜನರು ತೊಂದರೆಯಲ್ಲಿದ್ದಾರೆ?",
    askResources: "ನಿಮಗೆ ಯಾವ ರೀತಿಯ ಸಹಾಯ ಬೇಕು?",
    askUrgency: "ತಕ್ಷಣದ ಅಪಾಯವಿದೆಯೇ?",
    confirmation: (loc, count, res) => `ಸ್ಥಳ ${loc}, ${count} ಜನರು, ಅಗತ್ಯ ${res}. ಸರಿಯೇ?`,
    recorded: (reqId) => `ಧನ್ಯವಾದಗಳು. ನಿಮ್ಮ ತುರ್ತು ವಿನಂತಿಯನ್ನು ResourceAI ನಲ್ಲಿ ದಾಖಲಿಸಲಾಗಿದೆ. ನಿಮ್ಮ ವಿನಂತಿ ಸಂಖ್ಯೆ ${reqId}.`,
    clarify: "ದೃಢೀಕರಿಸಲು ಹೌದು ಎಂದು ಹೇಳಿ.",
    safetyRuleReminder: "ದಯವಿಟ್ಟು ಸುರಕ್ಷಿತ ಸ್ಥಳದಲ್ಲಿರಿ."
  },
  Bengali: {
    greeting: "নমস্কার, ResourceAI জরুরী সহায়তা। কি ঘটেছে বলুন?",
    askEmergency: "কি ঘটেছে বলুন?",
    askLocation: "আপনার বর্তমান অবস্থান বা ল্যান্ডমার্ক বলুন?",
    askPeople: "কতজন মানুষ ক্ষতিগ্রস্ত?",
    askResources: "আপনাদের কি ধরণের সাহায্য প্রয়োজন?",
    askUrgency: "কেউ কি বিপদে আছেন?",
    confirmation: (loc, count, res) => `অবস্থান ${loc}, লোকসংখ্যা ${count}, প্রয়োজন ${res}। সঠিক কি?`,
    recorded: (reqId) => `ধন্যবাদ। আপনার জরুরী অনুরোধ ResourceAI-তে নথিভুক্ত করা হয়েছে। আপনার অনুরোধ আইডি ${reqId}।`,
    clarify: "নিশ্চিত করতে হ্যাঁ বলুন।",
    safetyRuleReminder: "নিরাপদ স্থানে অবস্থান করুন।"
  },
  Odia: {
    greeting: "ନମସ୍କାର, ResourceAI ଜରୁରୀ ସହାୟତା। କଣ ଘଟିଛି କୁହନ୍ତୁ?",
    askEmergency: "କଣ ଘଟିଛି କୁହନ୍ତୁ?",
    askLocation: "ଆପଣଙ୍କ ସ୍ଥାନ ବା ଚିହ୍ନ କୁହନ୍ତୁ?",
    askPeople: "କେତେ ଲୋକ ପ୍ରଭାବିତ?",
    askResources: "କେଉଁ ସାହାଯ୍ୟ ଦରକାର?",
    askUrgency: "ତୁରନ୍ତ ବିପଦ ଅଛି କି?",
    confirmation: (loc, count, res) => `ସ୍ଥାନ ${loc}, ${count} ଜଣ, ଆବଶ୍ୟକ ${res}। ଠିକ କି?`,
    recorded: (reqId) => `ଧନ୍ୟବାଦ। ଆପଣଙ୍କ ଜରୁରୀ ଅନୁରୋଧ ResourceAI ରେ ଲିପିବଦ୍ଧ ହୋଇଛି। ଆପଣଙ୍କ ଅନୁରୋଧ ଆଇଡି ${reqId}।`,
    clarify: "ନିଶ୍ଚିତ କରିବାକୁ ହଁ କୁହନ୍ତୁ।",
    safetyRuleReminder: "ନିରାପଦ ସ୍ଥାନରେ ରୁହନ୍ତୁ।"
  }
};

export const SYSTEM_SAFETY_PROMPT = `
You are the ResourceAI Disaster & Emergency Voice Agent.
Your objective is to empathetically, rapidly, and concisely collect emergency details from affected callers during floods, landslides, cyclones, building collapses, fires, or medical crises.

CRITICAL SAFETY & TRUTH RULES:
1. NEVER claim that the government, police, SDRF, NDRF, or emergency responders have received, accepted, dispatched, or fulfilled a request unless the backend has explicitly returned a confirmed state.
2. ONLY state: "Your request has been recorded in ResourceAI."
3. NEVER promise delivery times (e.g. "Help will arrive in 20 minutes" is strictly forbidden).
4. NEVER invent emergency services or make medical diagnoses.
5. If caller describes life-threatening danger (e.g. drowning, severe bleeding, trapped in rubble), immediately prioritize getting their exact location/landmark and tell them to stay safe or seek higher ground if possible.
6. Ask ONE question at a time. Keep utterances under 25 words because this is a real-time telephone conversation.
7. Do not repeat questions if the caller has already provided the information in a previous sentence.
8. Always speak in the caller's chosen or detected language: English, Hindi, Tamil, Telugu, Malayalam, Kannada, Bengali, or Odia.
`;

export const DEPARTMENTS = [
  'Water & Sanitation',
  'Fire & Rescue',
  'Medical / Healthcare',
  'Food & Essential Supplies',
  'Shelter & Evacuation',
  'Electricity',
  'Roads & Transportation',
  'Police / Security',
  'Waste Management',
  'Disaster Management',
  'Government Services',
  'Other / Unclassified'
];

export const POST_CALL_CLASSIFICATION_PROMPT = `
You are the ResourceAI Post-Call Query Understanding & Department Classification Engine.
Analyze the complete caller conversation transcript and produce a structured JSON result.

PURPOSE OF ANALYSIS:
1. What is the caller's actual problem/query?
2. Which department should handle it? Choose EXACTLY ONE from this list:
   - "Water & Sanitation"
   - "Fire & Rescue"
   - "Medical / Healthcare"
   - "Food & Essential Supplies"
   - "Shelter & Evacuation"
   - "Electricity"
   - "Roads & Transportation"
   - "Police / Security"
   - "Waste Management"
   - "Disaster Management"
   - "Government Services"
   - "Other / Unclassified"
3. What assistance/resource does the caller need?
4. How urgent is the request? ("Critical", "High", "Medium", "Low", "Unknown")
5. Where is the incident located, ONLY if the caller explicitly provides a location. If not explicitly mentioned (or generic like "here", "our area"), return "Not mentioned".
6. Who/what is affected, ONLY when stated by the caller. If not mentioned, return "Not mentioned".

STRICT SAFETY AND NON-HALLUCINATION RULES:
- DO NOT invent information.
- If something is not explicitly available from the transcript, return "Not mentioned" or an empty array [] where appropriate.
- Never invent locations, numbers of people, resources, or caller identity.
- If uncertain, set department to "Other / Unclassified", priority to "Unknown", and a low confidence value (e.g. 0.35).

SCHEMA:
Return ONLY a valid JSON object matching this schema:
{
  "query": string,
  "summary": string,
  "department": string,
  "required_service": string,
  "required_resources": string[],
  "priority": "Critical" | "High" | "Medium" | "Low" | "Unknown",
  "location": string,
  "affected_people": string,
  "language": string,
  "confidence": number
}
`;
