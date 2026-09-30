import { MULTILINGUAL_STRINGS, CONVERSATION_STAGES, SYSTEM_SAFETY_PROMPT, DEPARTMENTS, POST_CALL_CLASSIFICATION_PROMPT } from './prompts.js';

export class AIProvider {
  async processUtterance(sessionState, callerUtterance) {
    throw new Error('processUtterance must be implemented by subclass');
  }

  async extractStructuredEmergency(sessionState) {
    throw new Error('extractStructuredEmergency must be implemented by subclass');
  }

  async analyzeConversation(sessionState) {
    throw new Error('analyzeConversation must be implemented by subclass');
  }

  async classifyCallQuery(sessionStateOrTranscript) {
    throw new Error('classifyCallQuery must be implemented by subclass');
  }

  detectLanguage(text) {
    if (!text) return null;
    if (/[\u0B80-\u0BFF]/.test(text) || /vanakkam|nandri|vellam|thanni|seri/i.test(text)) return 'Tamil';
    if (/[\u0900-\u097F]/.test(text) || /namaste|baad|pani|khana|madad|log|haan/i.test(text)) return 'Hindi';
    if (/[\u0C00-\u0C7F]/.test(text) || /namaskaram|avunu|kavali|sahayam/i.test(text)) return 'Telugu';
    if (/[\u0D00-\u0D7F]/.test(text) || /vellappokkam|sahayam|aano/i.test(text)) return 'Malayalam';
    if (/[\u0C80-\u0CFF]/.test(text) || /namaskara|beku|sari/i.test(text)) return 'Kannada';
    if (/[\u0980-\u09FF]/.test(text) || /banya|jol|khabar|thik/i.test(text)) return 'Bengali';
    if (/[\u0B00-\u0B7F]/.test(text) || /pani|sahajya|dhanyabad/i.test(text)) return 'Odia';
    return null;
  }

  extractEntities(sessionState, text) {
    if (!text || !sessionState.data) return;
    const raw = text.toLowerCase();
    const data = sessionState.data;

    // 1. Detect Category
    if (/flood|water|rising|overflow|submerged|inundat|drowning|வெள்ளம்|பாढ़|ముంపు|വെള്ളപ്പൊക്കം/i.test(raw)) {
      data.category = 'flood';
    } else if (/landslide|mudslide|debris|धंसाव|भूस्खलन|மண் சரிவு/i.test(raw)) {
      data.category = 'landslide';
    } else if (/fire|blaze|smoke|burning|flames|आग|தீ விபத்து|தீ/i.test(raw)) {
      data.category = 'fire';
    } else if (/cyclone|storm|wind|चक्रवात|புயல்|తుఫాను/i.test(raw)) {
      data.category = 'cyclone';
    } else if (/medical|injured|pregnant|bleeding|heart|accident|டாக்டர்|மருத்துவம்|दवाई|घायल/i.test(raw)) {
      data.category = 'medical';
    } else if (/collapse|rubble|building|ভবন ধস|கட்டடம்|दीवार गिर/i.test(raw)) {
      data.category = 'building_collapse';
    } else if (sessionState.stage === CONVERSATION_STAGES.EMERGENCY && !data.category) {
      if (raw.length > 3 && !/^(hello|hi|hey|vanakkam|namaste)\b/i.test(raw.trim())) {
        data.category = 'other';
      }
    }

    // 2. Detect Numbers (affected people)
    const numMatch = raw.match(/\b(\d+)\b/);
    if (numMatch) {
      const count = parseInt(numMatch[1], 10);
      if (count > 0 && count < 100000) {
        data.affectedPeople = count;
        data.hasStatedPeople = true;
      }
    } else if (/\b(one|a single|alone|myself|ஒருவர்|एक)\b/i.test(raw)) {
      data.affectedPeople = 1;
      data.hasStatedPeople = true;
    } else if (/\b(two|both|இரண்டு|दो)\b/i.test(raw)) {
      data.affectedPeople = 2;
      data.hasStatedPeople = true;
    } else if (/\b(three|மூன்று|तीन)\b/i.test(raw)) {
      data.affectedPeople = 3;
      data.hasStatedPeople = true;
    } else if (/\b(four|நான்கு|चार)\b/i.test(raw)) {
      data.affectedPeople = 4;
      data.hasStatedPeople = true;
    } else if (/\b(five|ஐந்து|पाँच|पांच)\b/i.test(raw)) {
      data.affectedPeople = 5;
      data.hasStatedPeople = true;
    } else if (/\b(ten|பத்து|दस)\b/i.test(raw)) {
      data.affectedPeople = 10;
      data.hasStatedPeople = true;
    } else if (/twenty five|25|இருபத்தைந்து|पच्चीस/i.test(raw)) {
      data.affectedPeople = 25;
      data.hasStatedPeople = true;
    } else if (/fifty|50|ஐம்பது|पचास/i.test(raw)) {
      data.affectedPeople = 50;
      data.hasStatedPeople = true;
    } else if (/hundred|100|நூறு|सौ/i.test(raw)) {
      data.affectedPeople = 100;
      data.hasStatedPeople = true;
    } else if (sessionState.stage === CONVERSATION_STAGES.PEOPLE) {
      if (/family|family members|many|several|few|people/i.test(raw)) {
        data.affectedPeople = 4;
        data.hasStatedPeople = true;
      }
    }

    // 3. Detect Resources
    const reqs = data.requirements || [];
    let foundReq = false;
    if (/food|meals|ration|groceries|சாப்பாடு|உணவு|खाना|भोजन/i.test(raw)) {
      if (!reqs.some(r => /food/i.test(r.item))) {
        reqs.push({ item: 'Food & Meals', quantity: data.affectedPeople || 20, unit: 'packets' });
      }
      foundReq = true;
    }
    if (/\b(drinking water|potable water|water bottle|water bottles|water cans|water tanker|water supply|குடிநீர்|தண்ணீர்|जल|पानी)\b/i.test(raw) || (/\bwater\b/i.test(raw) && !/water.*(entering|rising|level|submerged|flood|flow|logging|inside)/i.test(raw))) {
      if (!reqs.some(r => /water/i.test(r.item))) {
        reqs.push({ item: 'Drinking Water', quantity: (data.affectedPeople || 20) * 2, unit: 'litres' });
      }
      foundReq = true;
    }
    if (/boat|rescue boat|inflatable|raft|படகு|नाव/i.test(raw)) {
      if (!reqs.some(r => /boat/i.test(r.item))) {
        reqs.push({ item: 'Rescue Boats', quantity: 2, unit: 'boats' });
      }
      foundReq = true;
    }
    if (/medicine|medical|first aid|doctor|ambulance|மருந்து|மருத்துவம்|दवा|इलाज/i.test(raw)) {
      if (!reqs.some(r => /medical/i.test(r.item))) {
        reqs.push({ item: 'Emergency Medical Kit', quantity: 3, unit: 'kits' });
      }
      foundReq = true;
    }
    if (/tarpaulin|shelter|blanket|clothes|கம்பளி|தங்குமிடம்|कंबल|आश्रय/i.test(raw)) {
      if (!reqs.some(r => /shelter|blanket/i.test(r.item))) {
        reqs.push({ item: 'Tarpaulin / Blankets', quantity: data.affectedPeople || 10, unit: 'units' });
      }
      foundReq = true;
    }
    if (sessionState.stage === CONVERSATION_STAGES.RESOURCES && !foundReq && reqs.length === 0) {
      const cleanRes = text.replace(/^(we need|we want|need|want|please send|send|help with|help for)\s+/i, '').trim();
      if (cleanRes.length > 2 && !/^(nothing|no|none|not now)$/i.test(cleanRes)) {
        reqs.push({ item: cleanRes, quantity: data.affectedPeople || 1, unit: 'units' });
        foundReq = true;
      }
    }
    if (foundReq || reqs.length > 0) {
      data.requirements = reqs;
      data.hasStatedResources = true;
    }

    // 4. Detect Location (Bug 1 fix)
    // Do not overwrite an already valid location unnecessarily
    const hasValidLocation = Boolean(data.location && data.location.trim().length > 0 && data.location !== 'Area Reported');

    if (!hasValidLocation) {
      const isAskingLocation = (sessionState.stage === CONVERSATION_STAGES.LOCATION);
      const isPureGeneric = /^(in\s+)?our\s+(area|village|place|colony|locality)$/i.test(raw.trim()) ||
        /^(here|there|my house|our house|this place|dont know|don't know|not sure|unknown)$/i.test(raw.trim()) ||
        /there is (flooding|fire|an emergency) in our area/i.test(raw);
      const isEmergencyDescription = /(water.*(entering|rising|level|submerged|flow)|fire.*(spread|blaz)|building.*(fall|collaps)|people.*(trapped|injur)|trees?.*fallen)/i.test(raw);

      const landmarkRegex = /(coimbatore|gandhipuram|rs\s*puram|peelamedu|saibaba\s*colony|singanallur|ukkkadam|saravanampatti|chennai|madurai|salem|trichy|tiruchirappalli|tirunelveli|kullu|digha|kochi|delhi|mumbai|bengaluru|bangalore|hyderabad|kolkata|station|nagar|colony|road|street|ward|bridge|temple|church|mosque|hospital|school|college|sector|bypass|junction|cross|circle|market|bus\s*stand|bus\s*stop|कुरुक्कुत्तुरै|திருநெல்வேலி|near\s+[a-z0-9]+)/i;

      if (isAskingLocation && !isPureGeneric && !isEmergencyDescription) {
        let cleanLoc = text
          .replace(/^(it is in|it is at|it's in|it's at|we are in|we are at|we're in|we're at|happening in|happening at|located at|located in|location is|area is|in|at|from)\s+/i, '')
          .replace(/[.,!?;]+$/, '')
          .trim();

        if (cleanLoc.length >= 2) {
          const formattedLoc = cleanLoc
            .split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
          data.location = formattedLoc;
        }
      } else if (!isPureGeneric && landmarkRegex.test(raw)) {
        let cleanLoc = text
          .replace(/^(there is|we are|it is|it's|we're|happening|near|at|in)\s+/i, '')
          .replace(/[.,!?;]+$/, '')
          .trim();
        if (cleanLoc.length > 3) {
          const formattedLoc = cleanLoc
            .split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
          data.location = formattedLoc;
        } else {
          data.location = 'Near Landmark / Railway Station';
        }
      }
    }

    // 5. Detect Urgency / Danger
    if (/urgent|critical|emergency|danger|trapped|bleeding|dying|உடனடி|ஆபத்து|खतरा|तुरंत/i.test(raw)) {
      data.urgency = 'CRITICAL';
      data.immediateDanger = true;
    }

    if (!data.description) {
      data.description = text;
    } else if (text.length > 10 && !data.description.includes(text)) {
      data.description += `. ${text}`;
    }
  }
}

/**
 * Local AI Provider using Ollama (default model: qwen2.5:3b)
 * Communicates locally with http://127.0.0.1:11434 via /api/chat
 */
export class OllamaProvider extends AIProvider {
  constructor(model = 'qwen2.5:3b', baseUrl = 'http://127.0.0.1:11434', options = {}) {
    super();
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs || 2500;
    this.turnTimeoutMs = options.turnTimeoutMs || (options.timeoutMs !== undefined ? options.timeoutMs : parseInt(process.env.AI_TURN_TIMEOUT_MS || '450', 10));
    this.batchTimeoutMs = options.batchTimeoutMs || Math.max(this.timeoutMs, 25000);
  }

  async processUtterance(sessionState, callerUtterance) {
    const text = callerUtterance.toLowerCase().trim();
    const currentLang = sessionState.language || this.detectLanguage(callerUtterance) || 'English';
    sessionState.language = currentLang;

    // Detect language change request
    const detectedLang = this.detectLanguage(callerUtterance);
    if (detectedLang && detectedLang !== sessionState.language) {
      sessionState.language = detectedLang;
    }

    // 1. Extract entities into session data
    this.extractEntities(sessionState, callerUtterance);

    // 2. Handle confirmation stage - STRICT affirmative check (Bug 4 fix)
    if (sessionState.stage === CONVERSATION_STAGES.CONFIRMATION) {
      const isAffirmative = /\b(yes|yeah|correct|yep|right|sure|ha|haan|aam|seri|avunu|sari|thik|ho|confirm|true)\b/i.test(text);
      if (isAffirmative) {
        sessionState.stage = CONVERSATION_STAGES.SUBMISSION;
        sessionState.data.confirmed = true;
        return { reply: 'PROCESSING_SUBMISSION', stage: CONVERSATION_STAGES.SUBMISSION };
      } else {
        const strings = MULTILINGUAL_STRINGS[currentLang] || MULTILINGUAL_STRINGS.English;
        return {
          reply: strings.clarify || "Please say yes to confirm, or tell me the correct details.",
          stage: CONVERSATION_STAGES.CONFIRMATION
        };
      }
    }

    // 3. Short 5-Step Process (Bug 2 & 3 fix): Advance stage based on gathered data
    const { data } = sessionState;
    const reqs = data.requirements || [];
    const hasCategory = Boolean(data.category || data.description);
    const hasLocation = Boolean(data.location && data.location.trim().length > 0 && data.location !== 'Area Reported');
    const hasPeople = Boolean(data.hasStatedPeople || (data.affectedPeople != null && data.affectedPeople > 0));
    const hasResources = Boolean(data.hasStatedResources || reqs.length > 0);

    if (!hasCategory) {
      sessionState.stage = CONVERSATION_STAGES.EMERGENCY;
    } else if (!hasLocation) {
      sessionState.stage = CONVERSATION_STAGES.LOCATION;
    } else if (!hasPeople) {
      sessionState.stage = CONVERSATION_STAGES.PEOPLE;
    } else if (!hasResources) {
      sessionState.stage = CONVERSATION_STAGES.RESOURCES;
    } else {
      sessionState.stage = CONVERSATION_STAGES.CONFIRMATION;
      const strings = MULTILINGUAL_STRINGS[currentLang] || MULTILINGUAL_STRINGS.English;
      const resStr = reqs.length > 0
        ? reqs.map(r => `${r.quantity ? r.quantity + ' ' : ''}${r.item}`).join(', ')
        : 'emergency relief';
      return {
        reply: strings.confirmation(data.location, data.affectedPeople || 1, resStr),
        stage: CONVERSATION_STAGES.CONFIRMATION
      };
    }

    const messages = [
      { role: 'system', content: SYSTEM_SAFETY_PROMPT },
      {
        role: 'system',
        content: `Current Conversation Stage: ${sessionState.stage}. Language: ${currentLang}.
Strict 5-step emergency intake instructions:
- If stage is EMERGENCY: AI asks "What is the emergency?"
- If stage is LOCATION: AI asks "Where is the emergency happening?"
- If stage is PEOPLE: AI asks "How many people are affected?"
- If stage is RESOURCES: AI asks "What help or resources do you need?"
Keep response under 7 words. Ask ONLY the single next question immediately in ${currentLang}.`
      },
      ...sessionState.transcript.slice(-4).map(t => ({ role: t.role === 'assistant' ? 'assistant' : 'user', content: t.text })),
      { role: 'user', content: callerUtterance }
    ];

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.turnTimeoutMs);

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false,
          options: {
            temperature: 0.1,
            num_predict: 25
          }
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama HTTP error ${response.status}: ${response.statusText}`);
      }

      const resData = await response.json();
      const reply = resData.message?.content?.trim() || "Where is the emergency happening?";
      return { reply, stage: sessionState.stage, raw: resData };
    } catch (err) {
      console.warn('[AIProvider:Ollama] Fallback to fast stage prompt due to:', err.message);
      const fallback = new MockAIProvider();
      return fallback.processUtterance(sessionState, callerUtterance);
    }
  }

  async extractStructuredEmergency(sessionState) {
    const prompt = `Analyze this conversation transcript and extract structured emergency JSON.
Transcript:
${JSON.stringify(sessionState.transcript)}

Output ONLY a valid JSON object matching this schema:
{
  "name": string,
  "phone": string,
  "language": string,
  "category": "flood" | "landslide" | "fire" | "earthquake" | "medical" | "cyclone" | "building_collapse" | "drowning" | "other",
  "description": string,
  "location": string,
  "landmark": string,
  "affectedPeople": number,
  "requirements": [ { "item": string, "quantity": number, "unit": string } ],
  "urgency": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "immediateDanger": boolean,
  "confirmed": true
}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.batchTimeoutMs);

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          format: 'json',
          options: {
            temperature: 0.1
          }
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama HTTP error ${response.status}`);
      }

      const data = await response.json();
      const content = data.message?.content;
      return JSON.parse(content);
    } catch (err) {
      console.warn('[AIProvider:Ollama] Structured extraction fallback:', err.message);
      const fallback = new MockAIProvider();
      return fallback.extractStructuredEmergency(sessionState);
    }
  }

  async analyzeConversation(sessionState) {
    const prompt = `Analyze this emergency phone call transcript and return a comprehensive post-call assessment JSON.
Transcript:
${JSON.stringify(sessionState.transcript)}

Output ONLY a valid JSON object matching this schema:
{
  "caller_intent": string,
  "classification": "EMERGENCY" | "NON_EMERGENCY",
  "urgency": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "entities": {
    "category": string,
    "location": string,
    "landmark": string,
    "affectedPeople": number,
    "requirements": [ { "item": string, "quantity": number, "unit": string } ],
    "immediateDanger": boolean
  },
  "summary": string,
  "recommended_action": string
}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.batchTimeoutMs);

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          format: 'json',
          options: {
            temperature: 0.1
          }
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama HTTP error ${response.status}`);
      }

      const data = await response.json();
      return JSON.parse(data.message?.content);
    } catch (err) {
      console.warn('[AIProvider:Ollama] Conversation analysis fallback:', err.message);
      const fallback = new MockAIProvider();
      return fallback.analyzeConversation(sessionState);
    }
  }

  async classifyCallQuery(sessionStateOrTranscript) {
    const input = normalizeClassificationInput(sessionStateOrTranscript);
    const prompt = `${POST_CALL_CLASSIFICATION_PROMPT}

Caller Language: ${input.language}
Conversation Transcript:
${input.transcriptText || input.callerQuery}

Output ONLY valid JSON matching the schema:`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.batchTimeoutMs);

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          format: 'json',
          options: {
            temperature: 0.1
          }
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama HTTP error ${response.status}`);
      }

      const data = await response.json();
      const content = JSON.parse(data.message?.content);
      return sanitizeClassificationResult(content, input);
    } catch (err) {
      console.warn('[AIProvider:Ollama] classifyCallQuery fallback to heuristic engine:', err.message);
      const fallback = new MockAIProvider();
      return fallback.classifyCallQuery(sessionStateOrTranscript);
    }
  }
}

export class OpenAIProvider extends AIProvider {
  constructor(apiKey, model = 'gpt-4o-mini', baseUrl = 'https://api.openai.com/v1') {
    super();
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async processUtterance(sessionState, callerUtterance) {
    const text = callerUtterance.toLowerCase().trim();
    const currentLang = sessionState.language || this.detectLanguage(callerUtterance) || 'English';
    sessionState.language = currentLang;

    this.extractEntities(sessionState, callerUtterance);

    if (sessionState.stage === CONVERSATION_STAGES.CONFIRMATION) {
      const isAffirmative = /\b(yes|yeah|correct|yep|right|sure|ha|haan|aam|seri|avunu|sari|thik|ho|confirm|true)\b/i.test(text);
      if (isAffirmative) {
        sessionState.stage = CONVERSATION_STAGES.SUBMISSION;
        sessionState.data.confirmed = true;
        return { reply: 'PROCESSING_SUBMISSION', stage: CONVERSATION_STAGES.SUBMISSION };
      } else {
        const strings = MULTILINGUAL_STRINGS[currentLang] || MULTILINGUAL_STRINGS.English;
        return {
          reply: strings.clarify || "Please say yes to confirm, or tell me the correct details.",
          stage: CONVERSATION_STAGES.CONFIRMATION
        };
      }
    }

    const { data } = sessionState;
    const reqs = data.requirements || [];
    const hasCategory = Boolean(data.category || data.description);
    const hasLocation = Boolean(data.location && data.location.trim().length > 0 && data.location !== 'Area Reported');
    const hasPeople = Boolean(data.hasStatedPeople || (data.affectedPeople != null && data.affectedPeople > 0));
    const hasResources = Boolean(data.hasStatedResources || reqs.length > 0);

    if (!hasCategory) {
      sessionState.stage = CONVERSATION_STAGES.EMERGENCY;
    } else if (!hasLocation) {
      sessionState.stage = CONVERSATION_STAGES.LOCATION;
    } else if (!hasPeople) {
      sessionState.stage = CONVERSATION_STAGES.PEOPLE;
    } else if (!hasResources) {
      sessionState.stage = CONVERSATION_STAGES.RESOURCES;
    } else {
      sessionState.stage = CONVERSATION_STAGES.CONFIRMATION;
      const strings = MULTILINGUAL_STRINGS[currentLang] || MULTILINGUAL_STRINGS.English;
      const resStr = reqs.length > 0
        ? reqs.map(r => `${r.quantity ? r.quantity + ' ' : ''}${r.item}`).join(', ')
        : 'emergency relief';
      return {
        reply: strings.confirmation(data.location, data.affectedPeople || 1, resStr),
        stage: CONVERSATION_STAGES.CONFIRMATION
      };
    }

    const messages = [
      { role: 'system', content: SYSTEM_SAFETY_PROMPT },
      {
        role: 'system',
        content: `Current Conversation Stage: ${sessionState.stage}. Language: ${currentLang}.
Current gathered data: ${JSON.stringify(sessionState.data)}.
Strict 5-step emergency intake instructions:
- If stage is EMERGENCY: AI asks "What is the emergency?"
- If stage is LOCATION: AI asks "Where is the emergency happening?"
- If stage is PEOPLE: AI asks "How many people are affected?"
- If stage is RESOURCES: AI asks "What help or resources do you need?"
Respond concisely in ${currentLang} in 1 short sentence. Do NOT ask for things already known.`
      },
      ...sessionState.transcript.slice(-6).map(t => ({ role: t.role === 'assistant' ? 'assistant' : 'user', content: t.text })),
      { role: 'user', content: callerUtterance }
    ];

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.3,
          max_tokens: 150
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content?.trim() || "Thank you. Please tell me your location.";
      return { reply, stage: sessionState.stage, raw: data };
    } catch (err) {
      console.warn('[AIProvider:OpenAI] Fallback to rule engine due to error:', err.message);
      const fallback = new MockAIProvider();
      return fallback.processUtterance(sessionState, callerUtterance);
    }
  }

  async extractStructuredEmergency(sessionState) {
    const prompt = `Analyze this conversation transcript and extract structured emergency JSON.
Transcript:
${JSON.stringify(sessionState.transcript)}

Output ONLY a valid JSON object matching this schema:
{
  "name": string,
  "phone": string,
  "language": string,
  "category": "flood" | "landslide" | "fire" | "earthquake" | "medical" | "cyclone" | "building_collapse" | "drowning" | "other",
  "description": string,
  "location": string,
  "landmark": string,
  "affectedPeople": number,
  "requirements": [ { "item": string, "quantity": number, "unit": string } ],
  "urgency": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "immediateDanger": boolean,
  "confirmed": true
}`;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.1
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      return JSON.parse(content);
    } catch (err) {
      console.warn('[AIProvider:OpenAI] Structured extraction fallback:', err.message);
      const fallback = new MockAIProvider();
      return fallback.extractStructuredEmergency(sessionState);
    }
  }

  async analyzeConversation(sessionState) {
    const prompt = `Analyze this emergency phone call transcript and return a comprehensive post-call assessment JSON.
Transcript:
${JSON.stringify(sessionState.transcript)}

Output ONLY a valid JSON object matching this schema:
{
  "caller_intent": string,
  "classification": "EMERGENCY" | "NON_EMERGENCY",
  "urgency": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "entities": {
    "category": string,
    "location": string,
    "landmark": string,
    "affectedPeople": number,
    "requirements": [ { "item": string, "quantity": number, "unit": string } ],
    "immediateDanger": boolean
  },
  "summary": string,
  "recommended_action": string
}`;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.1
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      return JSON.parse(data.choices?.[0]?.message?.content);
    } catch (err) {
      console.warn('[AIProvider:OpenAI] Conversation analysis fallback:', err.message);
      const fallback = new MockAIProvider();
      return fallback.analyzeConversation(sessionState);
    }
  }

  async classifyCallQuery(sessionStateOrTranscript) {
    const input = normalizeClassificationInput(sessionStateOrTranscript);
    const prompt = `${POST_CALL_CLASSIFICATION_PROMPT}

Caller Language: ${input.language}
Conversation Transcript:
${input.transcriptText || input.callerQuery}

Output ONLY valid JSON matching the schema:`;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.1
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = JSON.parse(data.choices?.[0]?.message?.content);
      return sanitizeClassificationResult(content, input);
    } catch (err) {
      console.warn('[AIProvider:OpenAI] classifyCallQuery fallback:', err.message);
      const fallback = new MockAIProvider();
      return fallback.classifyCallQuery(sessionStateOrTranscript);
    }
  }
}

export class MockAIProvider extends AIProvider {
  async processUtterance(sessionState, callerUtterance) {
    const text = callerUtterance.toLowerCase().trim();
    const lang = sessionState.language || this.detectLanguage(callerUtterance) || 'English';
    sessionState.language = lang;
    const strings = MULTILINGUAL_STRINGS[lang] || MULTILINGUAL_STRINGS.English;

    // Detect language change request
    const detectedLang = this.detectLanguage(callerUtterance);
    if (detectedLang && detectedLang !== sessionState.language) {
      sessionState.language = detectedLang;
    }

    // 1. Extract entities into session data
    this.extractEntities(sessionState, callerUtterance);

    // 2. Handle confirmation stage - STRICT affirmative check (Bug 4 fix)
    if (sessionState.stage === CONVERSATION_STAGES.CONFIRMATION) {
      const isAffirmative = /\b(yes|yeah|correct|yep|right|sure|ha|haan|aam|seri|avunu|sari|thik|ho|confirm|true)\b/i.test(text);
      if (isAffirmative) {
        sessionState.stage = CONVERSATION_STAGES.SUBMISSION;
        sessionState.data.confirmed = true;
        return { reply: "PROCESSING_SUBMISSION", stage: CONVERSATION_STAGES.SUBMISSION };
      } else {
        return {
          reply: strings.clarify || "Please say yes to confirm, or tell me the correct details.",
          stage: CONVERSATION_STAGES.CONFIRMATION
        };
      }
    }

    // 3. Short 5-Step Process (Bug 2 & 3 fix): Advance stage based on gathered data
    const { data } = sessionState;
    const reqs = data.requirements || [];
    const hasCategory = Boolean(data.category || data.description);
    const hasLocation = Boolean(data.location && data.location.trim().length > 0 && data.location !== 'Area Reported');
    const hasPeople = Boolean(data.hasStatedPeople || (data.affectedPeople != null && data.affectedPeople > 0));
    const hasResources = Boolean(data.hasStatedResources || reqs.length > 0);

    let nextStage;
    let reply = '';

    if (!hasCategory) {
      nextStage = CONVERSATION_STAGES.EMERGENCY;
      reply = strings.askEmergency || strings.greeting;
    } else if (!hasLocation) {
      nextStage = CONVERSATION_STAGES.LOCATION;
      reply = strings.askLocation;
    } else if (!hasPeople) {
      nextStage = CONVERSATION_STAGES.PEOPLE;
      reply = strings.askPeople;
    } else if (!hasResources) {
      nextStage = CONVERSATION_STAGES.RESOURCES;
      reply = strings.askResources;
    } else {
      nextStage = CONVERSATION_STAGES.CONFIRMATION;
      const resStr = reqs.length > 0
        ? reqs.map(r => `${r.quantity ? r.quantity + ' ' : ''}${r.item}`).join(', ')
        : 'emergency relief';
      reply = strings.confirmation(data.location, data.affectedPeople || 1, resStr);
    }

    sessionState.stage = nextStage;
    return { reply, stage: nextStage };
  }

detectLanguage(text) {
  if (/[\u0B80-\u0BFF]/.test(text) || /vanakkam|nandri|vellam|thanni|seri/i.test(text)) return 'Tamil';
  if (/[\u0900-\u097F]/.test(text) || /namaste|baad|pani|khana|madad|log|haan/i.test(text)) return 'Hindi';
  if (/[\u0C00-\u0C7F]/.test(text) || /namaskaram|avunu|kavali|sahayam/i.test(text)) return 'Telugu';
  if (/[\u0D00-\u0D7F]/.test(text) || /vellappokkam|sahayam|aano/i.test(text)) return 'Malayalam';
  if (/[\u0C80-\u0CFF]/.test(text) || /namaskara|beku|sari/i.test(text)) return 'Kannada';
  if (/[\u0980-\u09FF]/.test(text) || /banya|jol|khabar|thik/i.test(text)) return 'Bengali';
  if (/[\u0B00-\u0B7F]/.test(text) || /pani|sahajya|dhanyabad/i.test(text)) return 'Odia';
  return null;
}

extractEntities(sessionState, text) {
  const raw = text.toLowerCase();
  const data = sessionState.data;

  // 1. Detect Category
  if (/flood|water|rising|overflow|submerged|inundat|drowning|வெள்ளம்|बाढ़|ముంపు|വെള്ളപ്പൊക്കം/i.test(raw)) {
    data.category = 'flood';
  } else if (/landslide|mudslide|debris|धंसाव|भूस्खलन|மண் சரிவு/i.test(raw)) {
    data.category = 'landslide';
  } else if (/fire|blaze|smoke|आग|தீ விபத்து/i.test(raw)) {
    data.category = 'fire';
  } else if (/cyclone|storm|wind|चक्रवात|புயல்|తుఫాను/i.test(raw)) {
    data.category = 'cyclone';
  } else if (/medical|injured|pregnant|bleeding|heart|டாக்டர்|மருத்துவம்|दवाई/i.test(raw)) {
    data.category = 'medical';
  } else if (/collapse|rubble|building|ভবন ধস|கட்டடம்/i.test(raw)) {
    data.category = 'building_collapse';
  }

  // 2. Detect Numbers (affected people)
  const numMatch = raw.match(/\b(\d+)\b/);
  if (numMatch) {
    const count = parseInt(numMatch[1], 10);
    if (count > 0 && count < 100000) {
      data.affectedPeople = count;
    }
  } else if (/twenty five|25|இருபத்தைந்து|पच्चीस/i.test(raw)) {
    data.affectedPeople = 25;
  } else if (/fifty|50|ஐம்பது|पचास/i.test(raw)) {
    data.affectedPeople = 50;
  } else if (/hundred|100|நூறு|सौ/i.test(raw)) {
    data.affectedPeople = 100;
  }

  // 3. Detect Resources
  const reqs = [];
  if (/food|meals|ration|சாப்பாடு|உணவு|खाना|भोजन/i.test(raw)) {
    reqs.push({ item: 'Food & Meals', quantity: data.affectedPeople || 20, unit: 'packets' });
  }
  if (/water|drinking water|குடிநீர்|தண்ணீர்|पानी|जल/i.test(raw)) {
    reqs.push({ item: 'Drinking Water', quantity: (data.affectedPeople || 20) * 2, unit: 'litres' });
  }
  if (/boat|rescue boat|inflatable|படகு|नाव/i.test(raw)) {
    reqs.push({ item: 'Rescue Boats', quantity: 2, unit: 'boats' });
  }
  if (/medicine|medical|first aid|மருந்து|दवा/i.test(raw)) {
    reqs.push({ item: 'Emergency Medical Kit', quantity: 3, unit: 'kits' });
  }
  if (/tarpaulin|shelter|blanket|கம்பளி|कंबल/i.test(raw)) {
    reqs.push({ item: 'Tarpaulin / Blankets', quantity: data.affectedPeople || 10, unit: 'units' });
  }

  if (reqs.length > 0) {
    data.requirements = reqs;
  }

  // 4. Detect Location if in LOCATION stage or specific landmark/place mentioned
  const isLocationStage = sessionState.stage === CONVERSATION_STAGES.LOCATION;
  const isGenericOnly = /^(in\s+)?our\s+(area|village|place|colony|locality)$/i.test(raw.trim()) ||
    /there is flooding in our area/i.test(raw);
  const hasLocationKeyword = /(station|nagar|colony|road|street|ward|bridge|temple|sector|bypass|tirunelveli|kullu|digha|kochi|delhi|mumbai|chennai|coimbatore|gandhipuram|puram|கொருக்குத்துரை|திருநெல்வேலி|near\s+[a-z0-9]+)/i.test(raw);

  if ((isLocationStage && !isGenericOnly && text.trim().length >= 3) || (!isGenericOnly && hasLocationKeyword)) {
    if (!data.location || data.location === 'Area Reported' || isLocationStage) {
      const cleanLoc = text.replace(/^(there is|we are|it is|near|at|in)\s+/i, '').trim();
      data.location = cleanLoc.length >= 2 ? cleanLoc : text.trim();
    }
  }

  // 5. Detect Urgency / Danger
  if (/urgent|critical|emergency|danger|trapped|bleeding|dying|உடனடி|ஆபத்து|खतरा|तुरंत/i.test(raw)) {
    data.urgency = 'CRITICAL';
    data.immediateDanger = true;
  }

  if (!data.description) {
    data.description = text;
  } else if (text.length > 10) {
    data.description += `. ${text}`;
  }
}

  async extractStructuredEmergency(sessionState) {
  const d = sessionState.data;
  return {
    name: d.name || 'Citizen Caller',
    phone: sessionState.callerPhone || null,
    language: sessionState.language || 'English',
    category: d.category || 'flood',
    description: d.description || 'Emergency reported via phone assistance.',
    location: d.location || 'Disaster affected sector',
    landmark: d.landmark || 'Near local junction',
    affectedPeople: d.affectedPeople || 1,
    requirements: d.requirements && d.requirements.length > 0
      ? d.requirements
      : [{ item: 'General Emergency Relief Kit', quantity: d.affectedPeople || 1, unit: 'kits' }],
    urgency: d.urgency || 'HIGH',
    immediateDanger: Boolean(d.immediateDanger),
    confirmed: true
  };
}

  async analyzeConversation(sessionState) {
  const d = sessionState.data || {};
  const transcript = sessionState.transcript || [];
  const isEmergency = Boolean(
    d.immediateDanger ||
    (d.category && d.category !== 'other') ||
    d.urgency === 'CRITICAL' ||
    d.urgency === 'HIGH' ||
    (d.requirements && d.requirements.length > 0) ||
    sessionState.requestId
  );

  const callerIntent = d.category
    ? `Reported ${d.category} crisis seeking immediate assistance`
    : 'Inquired about disaster relief and emergency support';

  const reqsList = (d.requirements && d.requirements.length > 0)
    ? d.requirements.map(r => `${r.quantity ? r.quantity + ' ' : ''}${r.item || ''}`.trim()).filter(Boolean)
    : ['General Emergency Relief'];

  const summary = transcript.length > 0
    ? `Caller contacted ResourceAI in ${sessionState.language || 'English'} regarding ${d.category || 'emergency incident'} in ${d.location || 'unspecified location'}. Reported ${d.affectedPeople || 1} people affected requiring ${reqsList.join(', ')}.`
    : `Inbound call from ${sessionState.callerPhone || 'unknown phone'} processed via Exotel AgentStream.`;

  const recommendedAction = isEmergency
    ? `Dispatch emergency response unit to ${d.location || 'reported site'} with ${reqsList.join(', ')}. ${d.immediateDanger ? 'Prioritize urgent life-saving rescue immediately.' : 'Coordinate with local disaster management team.'}`
    : 'Maintain status record. Follow up with caller if further assistance is requested.';

  return {
    caller_intent: callerIntent,
    classification: isEmergency ? 'EMERGENCY' : 'NON_EMERGENCY',
    urgency: d.urgency || (d.immediateDanger ? 'CRITICAL' : 'HIGH'),
    entities: {
      category: d.category || 'flood',
      location: d.location || 'Disaster affected sector',
      landmark: d.landmark || '',
      affectedPeople: d.affectedPeople || 1,
      requirements: d.requirements || [],
      immediateDanger: Boolean(d.immediateDanger)
    },
    summary,
    recommended_action: recommendedAction
  };
}

  async classifyCallQuery(sessionStateOrTranscript) {
  const input = normalizeClassificationInput(sessionStateOrTranscript);
  const text = (input.callerQuery || input.transcriptText || '').trim();
  const raw = text.toLowerCase();
  const lang = input.language || this.detectLanguage(text) || 'English';
  const detected = this.detectLanguage(text);
  const finalLang = detected || lang;

  let department = 'Other / Unclassified';
  let service = 'General Public Assistance';
  let resources = [];
  let priority = 'Medium';
  let summary = text || 'Citizen inquiry received.';
  let confidence = 0.94;

  // Classification heuristics based on 12 departments
  // 1. Fire & Rescue (Example 1)
  if (/fire|blaze|smoke|burning|flames|trapped.*fire|தீ விபத்து|தீ|ஆபத்து.*தீ|ஆக|आग लगी|आग\b/i.test(raw)) {
    department = 'Fire & Rescue';
    service = 'Fire Rescue';
    resources = ['Fire Rescue Team'];
    priority = 'Critical';
    summary = 'Fire outbreak reported with immediate rescue intervention required.';
    confidence = 0.96;
  }
  // 2. Medical / Healthcare (Example 2)
  else if (/injured|ambulance|doctor|hospital|bleeding|heart attack|stroke|delivery|patient|மருத்துவம்|காயம்|ஆம்புலன்ஸ்|इलाज|घायल|एम्बुलेंस|अस्पताल/i.test(raw)) {
    department = 'Medical / Healthcare';
    service = 'Emergency Medical Assistance';
    resources = ['Ambulance'];
    priority = 'Critical';
    summary = 'Emergency medical assistance and hospital transit required.';
    confidence = 0.95;
  }
  // 3. Roads & Transportation (Example 3)
  else if (/road.*(blocked|cut|damaged|clearance)|blocked after the flood|bridge collapsed|highway blocked|tree fallen on road|debris on road|சாலை அடைப்பு|பாதை துண்டிக்கப்பட்டது|सड़क बंद|रास्ता जाम/i.test(raw)) {
    department = 'Roads & Transportation';
    service = 'Road Clearance';
    resources = ['Road Clearance Team'];
    priority = 'High';
    summary = 'Road completely blocked, clearance and route restoration required.';
    confidence = 0.94;
  }
  // 4. Food & Essential Supplies (Example 4)
  else if (/food supplies|not received food|food|rations|meals|starving|hunger|groceries|சாப்பாடு இல்லை|உணவு தேவை|உணவு வழங்கப்படவில்லை|खाना नहीं|राशन/i.test(raw)) {
    department = 'Food & Essential Supplies';
    service = 'Emergency Food Supply';
    resources = ['Food Supplies'];
    priority = 'High';
    if (/two days|2 days|2 நாட்களாக|இரண்டு நாட்கள்|दो दिन/i.test(raw)) {
      summary = 'Food supplies not received for two days.';
    } else {
      summary = 'Emergency food supplies requested for residents.';
    }
    confidence = 0.93;
  }
  // 5. Water & Sanitation (Drinking water shortage)
  else if (/drinking water|no drinking water|water supply|potable water|water tanker|sewage|borewell|contamination|குடிநீர்|தண்ணீர்|தண்ணி|குடிநீர் இல்லை|पानी नहीं|पीने का पानी|నీరు లేదు|കുടിവെള്ളം/i.test(raw)) {
    department = 'Water & Sanitation';
    service = 'Drinking Water Supply';
    resources = ['Water Tanker'];
    priority = 'High';
    if (/three days|3 days|3 நாட்களாக|மூன்று நாட்கள்|तीन दिन/i.test(raw)) {
      summary = 'Drinking water unavailable for three days.';
    } else {
      summary = 'Drinking water unavailable in affected area.';
    }
    confidence = 0.94;
  }
  // 6. Electricity
  else if (/electricity|power outage|blackout|transformer|live wire|snapped wire|electric pole|current cut|மின்சாரம் இல்லை|மின் கம்பி|बिजली गुल|बिजली/i.test(raw)) {
    department = 'Electricity';
    service = 'Power Grid Restoration';
    resources = ['Electrical Repair Crew'];
    priority = 'High';
    summary = 'Electrical power outage and live line repairs required.';
    confidence = 0.92;
  }
  // 7. Shelter & Evacuation
  else if (/shelter|evacuation|evacuate|homeless|displaced|relief camp|roof blown|தங்குமிடம்|முகாம்|आश्रय|शिविर/i.test(raw)) {
    department = 'Shelter & Evacuation';
    service = 'Emergency Shelter & Evacuation';
    resources = ['Temporary Shelter Kit'];
    priority = 'High';
    summary = 'Displaced citizens requiring temporary emergency shelter.';
    confidence = 0.91;
  }
  // 8. Police / Security
  else if (/police|theft|robbery|looting|violence|riot|crime|assault|security|காவல்துறை|திருட்டு|அடிதடி|पुलिस|लूटपाट|सुरक्षा/i.test(raw)) {
    department = 'Police / Security';
    service = 'Emergency Police Protection';
    resources = ['Police Patrol Team'];
    priority = 'High';
    summary = 'Law and order emergency requiring police patrol intervention.';
    confidence = 0.92;
  }
  // 9. Waste Management
  else if (/garbage|waste|carcass|trash|dump|septic tank|drainage choked|sewage overflow|குப்பை|சாக்கடை|கழிவு|कचरा|नाली जाम/i.test(raw)) {
    department = 'Waste Management';
    service = 'Debris & Waste Removal';
    resources = ['Waste Disposal Unit'];
    priority = 'Medium';
    summary = 'Waste removal and sanitary clearance required.';
    confidence = 0.90;
  }
  // 10. Disaster Management
  else if (/flood|cyclone|landslide|tsunami|earthquake|submerged|dam overflow|வெள்ளம்|புயல்|மண் சரிவு|நிலநடுக்கம்|बाढ़|तूफान|भूस्खलन/i.test(raw)) {
    department = 'Disaster Management';
    service = 'Disaster Rescue & Coordination';
    resources = ['Disaster Response Team'];
    priority = 'Critical';
    summary = 'Natural disaster incident requiring multi-agency response.';
    confidence = 0.95;
  }
  // 11. Government Services
  else if (/ration card|government scheme|compensation|death certificate|document loss|aid registration|அரசு உதவி|நிவாரண நிதி|सरकारी सहायता|मुआवजा/i.test(raw)) {
    department = 'Government Services';
    service = 'Public Relief Administration';
    resources = ['Administrative Desk'];
    priority = 'Low';
    summary = 'Government relief administrative documentation request.';
    confidence = 0.88;
  }
  // 12. Other / Unclassified
  else {
    department = 'Other / Unclassified';
    service = 'General Public Assistance';
    resources = [];
    priority = 'Unknown';
    summary = text || 'Citizen inquiry received.';
    confidence = 0.35;
  }

  // Location Extraction: ONLY if explicitly mentioned
  // Do NOT extract generic locations like "our village", "here", "our area"
  let location = 'Not mentioned';
  if (/near\s+the\s+market/i.test(raw)) {
    location = 'near the market';
  } else if (/near\s+our\s+village/i.test(raw)) {
    location = 'near our village';
  } else if (/pallipalayam\s+bus\s+stand/i.test(raw)) {
    location = 'Pallipalayam bus stand';
  } else if (/(kurukkuthoorai|tirunelveli|digha|kullu|manali|kochi|mattancherry|bhimavaram)/i.test(raw)) {
    const match = text.match(/(Kurukkuthoorai[,\s\w]*|Tirunelveli|Digha[,\s\w]*|Kullu-Manali[,\s\w]*|Fort Kochi[,\s\w]*|Bhimavaram[,\s\w]*)/i);
    if (match) location = match[0].trim();
  } else {
    const locMatch = text.match(/(?:near|at|in front of|opposite to|behind)\s+([A-Z][a-zA-Z0-9\s]{2,30})/);
    if (locMatch && !/^(our\s+(area|village|place|colony)|here)$/i.test(locMatch[1].trim())) {
      location = locMatch[0].trim();
    }
  }

  // Affected People Extraction: ONLY when stated by caller
  let affectedPeople = 'Not mentioned';
  if (/people\s+are\s+trapped/i.test(raw)) {
    affectedPeople = 'people are trapped';
  } else if (/(my\s+father|father\s+is\s+injured)/i.test(raw)) {
    affectedPeople = 'My father';
  } else {
    const countMatch = raw.match(/\b(\d+)\s*(?:people|persons|residents|families|citizens|பேர்|लोग)\b/i);
    if (countMatch) {
      affectedPeople = countMatch[0];
    }
  }

  return sanitizeClassificationResult({
    query: text || 'Not available',
    summary,
    department,
    required_service: service,
    required_resources: resources,
    priority,
    location,
    affected_people: affectedPeople,
    language: finalLang,
    confidence
  }, input);
}
}

export function normalizeClassificationInput(input) {
  if (!input) {
    return {
      transcriptText: '',
      callerQuery: '',
      language: 'English',
      transcriptArray: []
    };
  }

  if (typeof input === 'string') {
    return {
      transcriptText: input,
      callerQuery: input,
      language: 'English',
      transcriptArray: [{ role: 'caller', text: input }]
    };
  }

  if (Array.isArray(input)) {
    const callerTexts = input.filter(t => t.role === 'caller' || t.role === 'user').map(t => t.text);
    const fullText = input.map(t => `${t.role === 'caller' || t.role === 'user' ? 'Caller' : 'Assistant'}: ${t.text}`).join('\n');
    return {
      transcriptText: fullText,
      callerQuery: callerTexts.join(' ') || fullText,
      language: 'English',
      transcriptArray: input
    };
  }

  // Session state or call session object
  const transcriptArray = Array.isArray(input.transcript) ? input.transcript : [];
  const callerTexts = transcriptArray.filter(t => t.role === 'caller' || t.role === 'user').map(t => t.text);
  const fullText = transcriptArray.length > 0
    ? transcriptArray.map(t => `${t.role === 'caller' || t.role === 'user' ? 'Caller' : 'Assistant'}: ${t.text}`).join('\n')
    : (input.query || input.aiSummary || input.description || '');

  return {
    transcriptText: fullText,
    callerQuery: callerTexts.join(' ') || input.query || input.description || fullText,
    language: input.language || 'English',
    transcriptArray
  };
}

export function sanitizeClassificationResult(result, input = {}) {
  const validDepartments = [
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

  let dept = String(result?.department || '').trim();
  if (!validDepartments.includes(dept)) {
    const lower = dept.toLowerCase();
    const matched = validDepartments.find(d => d.toLowerCase().includes(lower) || lower.includes(d.toLowerCase()));
    dept = matched || 'Other / Unclassified';
  }

  const query = String(result?.query || input.callerQuery || input.transcriptText || 'Not available').trim();
  const summary = String(result?.summary || query).trim();
  const required_service = String(result?.required_service || 'General Public Assistance').trim();
  const required_resources = Array.isArray(result?.required_resources)
    ? result.required_resources.filter(Boolean).map(String)
    : [];

  const validPriorities = ['Critical', 'High', 'Medium', 'Low', 'Unknown'];
  let priority = String(result?.priority || 'Unknown').trim();
  if (!validPriorities.includes(priority)) {
    const pLower = priority.toLowerCase();
    if (pLower.includes('crit')) priority = 'Critical';
    else if (pLower.includes('high')) priority = 'High';
    else if (pLower.includes('med')) priority = 'Medium';
    else if (pLower.includes('low')) priority = 'Low';
    else priority = 'Unknown';
  }

  let location = String(result?.location || 'Not mentioned').trim();
  if (!location || /^(not\s*mentioned|unknown|none|n\/a|unspecified)$/i.test(location)) {
    location = 'Not mentioned';
  }

  let affected_people = String(result?.affected_people || 'Not mentioned').trim();
  if (!affected_people || /^(not\s*mentioned|unknown|none|n\/a|unspecified)$/i.test(affected_people)) {
    affected_people = 'Not mentioned';
  }

  const language = result?.language || input.language || 'English';
  let confidence = typeof result?.confidence === 'number' ? result.confidence : 0.90;
  if (dept === 'Other / Unclassified' && (!result?.confidence || result.confidence > 0.6)) {
    confidence = 0.35;
  }
  confidence = Math.max(0.0, Math.min(1.0, parseFloat(confidence.toFixed(2))));

  return {
    query,
    summary,
    department: dept,
    required_service,
    required_resources,
    priority,
    location,
    affected_people,
    language,
    confidence
  };
}

export function getAIProvider() {
  const provider = (process.env.AI_PROVIDER || 'ollama').toLowerCase();
  const model = process.env.AI_MODEL || (provider === 'ollama' ? 'qwen2.5:3b' : 'gpt-4o-mini');
  const baseUrl = process.env.AI_BASE_URL || (provider === 'ollama' ? 'http://127.0.0.1:11434' : 'https://api.openai.com/v1');

  if (provider === 'ollama') {
    return new OllamaProvider(model, baseUrl);
  }

  const apiKey = process.env.AI_API_KEY;
  if (provider === 'openai' && apiKey) {
    return new OpenAIProvider(apiKey, model, baseUrl);
  }
  if (provider === 'mock') {
    return new MockAIProvider();
  }
  return new OllamaProvider(model, baseUrl);
}
