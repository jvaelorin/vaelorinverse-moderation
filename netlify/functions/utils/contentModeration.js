/**
 * Content Moderation Utility
 * Detects crisis language, self-harm, threats, and offensive content.
 *
 * Two-pass design:
 *   1. Keyword detection (instant, free, always runs first)
 *   2. OpenAI Moderation (meaning-based, catches quiet language keywords miss)
 *
 * SAFETY PROPERTY: If OpenAI fails for any reason, keyword detection still
 * protects. This never "fails open" (never lets content through unmoderated
 * because of an API error).
 *
 * NOTE: moderateContent is now ASYNC. The calling functions
 * (submit-whisper.js and submit-tribute.js) MUST use:
 *     const moderation = await moderateContent(text, type);
 */

// Crisis/Self-Harm Keywords (HIGH PRIORITY)
const CRISIS_PATTERNS = [
  // Self-harm
  /\b(kill myself|suicide|end my life|take my life|want to die|should i die)\b/i,
  /\b(cutting myself|hurt myself|harm myself|self harm)\b/i,
  /\b(no reason to live|better off dead|worthless|can't go on)\b/i,
  /\b(goodbye cruel world|final goodbye|last message)\b/i,

  // Harm to others
  /\b(kill (them|him|her|you|everyone)|murder|shoot up|mass shooting)\b/i,
  /\b(going to hurt|planning to attack|weapon|gun|knife|bomb)\b/i,
  /\b(they deserve to die|make them pay|revenge)\b/i,

  // Immediate danger
  /\b(right now|tonight|today|soon|can't wait)\b.*\b(die|kill|end it|hurt)\b/i,
  /\b(pills|overdose|hanging|jump off|bridge)\b/i,
];

// Offensive Content Keywords
const OFFENSIVE_PATTERNS = [
  // Racial slurs and hate speech (partial list - add more as needed)
  /\b(n[i1]gg[ae]r|n[i1]gg[ae]|f[a@]gg[o0]t|ch[i1]nk|sp[i1]c|k[i1]ke)\b/i,
  /\b(wetb[a@]ck|beaner|gook|sand n[i1]gg[ae]r|towelhead)\b/i,

  // Hateful language
  /\b(hate (blacks|whites|asians|hispanics|jews|muslims|christians|gays|trans))\b/i,
  /\b((blacks|whites|asians|hispanics|jews|muslims) (are|should) (die|burn|suffer))\b/i,

  // Sexist/misogynistic slurs
  /\b(wh[o0]re|sl[u*]t|c[u*]nt|b[i1]tch)\b.*\b(women|girls|female)\b/i,

  // Homophobic/transphobic
  /\b(f[a@]g|dyke|tr[a@]nny)\b/i,
  /\b((gays|trans) (should|deserve to|need to) (die|burn|suffer))\b/i,

  // General harassment
  /\b(kill yourself|kys|neck yourself|rope yourself)\b/i,
  /\b(subhuman|degenerate|vermin|scum)\b.*\b(race|religion|people)\b/i,
];

// Disrespectful/Trolling Content (for memorial wall specifically)
const DISRESPECTFUL_PATTERNS = [
  /\b(lol|lmao|haha|rofl)\b.*\b(dead|died|death|rip)\b/i,
  /\b(glad|happy|celebrate)\b.*\b(dead|died|death)\b/i,
  /\b(deserved|had it coming|good riddance)\b/i,
  /\b(fake|lying|scam|fraud|attention)\b.*\b(memorial|tribute|grief)\b/i,
  /\b(rot in hell|burn in hell|hope (they|he|she) suffered)\b/i,
];

/**
 * Check content for crisis/self-harm language
 * @param {string} text - Text to analyze
 * @returns {Object} - { isCrisis: boolean, matches: string[], reason: string }
 */
function checkForCrisisContent(text) {
  const matches = [];
  let reason = '';

  for (const pattern of CRISIS_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      matches.push(match[0]);
    }
  }

  if (matches.length > 0) {
    // Determine if it's self-harm or harm to others
    const selfHarmIndicators = /(myself|my life|i want|i should|i can't)/i;
    const othersHarmIndicators = /(them|him|her|you|everyone|they|shoot up|attack)/i;

    if (selfHarmIndicators.test(text)) {
      reason = 'Self-harm or suicidal language detected';
    } else if (othersHarmIndicators.test(text)) {
      reason = 'Threats of violence toward others detected';
    } else {
      reason = 'Crisis language detected';
    }
  }

  return {
    isCrisis: matches.length > 0,
    matches,
    reason
  };
}

/**
 * Check content for offensive/hate speech
 * @param {string} text - Text to analyze
 * @returns {Object} - { isOffensive: boolean, matches: string[], reason: string }
 */
function checkForOffensiveContent(text) {
  const matches = [];
  let reason = '';

  for (const pattern of OFFENSIVE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      matches.push(match[0]);
    }
  }

  if (matches.length > 0) {
    reason = 'Offensive language, hate speech, or slurs detected';
  }

  return {
    isOffensive: matches.length > 0,
    matches,
    reason
  };
}

/**
 * Check content for disrespectful language (memorial-specific)
 * @param {string} text - Text to analyze
 * @returns {Object} - { isDisrespectful: boolean, matches: string[], reason: string }
 */
function checkForDisrespectfulContent(text) {
  const matches = [];
  let reason = '';

  for (const pattern of DISRESPECTFUL_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      matches.push(match[0]);
    }
  }

  if (matches.length > 0) {
    reason = 'Disrespectful or trolling language detected';
  }

  return {
    isDisrespectful: matches.length > 0,
    matches,
    reason
  };
}

/**
 * OpenAI Moderation check — catches meaning/intent that keyword patterns miss
 * (e.g. "I can't do this anymore", "everyone would be better off without me").
 *
 * This is a CONTENT CLASSIFIER, not a clinical tool. It improves detection
 * breadth; it does not make the system clinically validated.
 *
 * Never throws. On any failure returns { flagged:false, selfHarm:false, error:true }
 * so the caller falls back to keyword-only protection.
 *
 * @param {string} text - Text to analyze
 * @returns {Promise<Object>} - { flagged, selfHarm, error }
 */
async function checkWithOpenAI(text) {
  // If no API key is configured, skip gracefully (keyword detection still runs).
  if (!process.env.OPENAI_API_KEY) {
    return { flagged: false, selfHarm: false, error: true };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'omni-moderation-latest',
        input: text
      })
    });

    if (!response.ok) {
      console.error('OpenAI moderation HTTP error:', response.status);
      return { flagged: false, selfHarm: false, error: true };
    }

    const result = await response.json();
    const first = result.results && result.results[0] ? result.results[0] : {};
    const categories = first.categories || {};
    const scores = first.category_scores || {};

    // Self-harm signal — meaning-based, catches quiet language.
    // Uses both the boolean category flags and a score threshold (0.5)
    // so borderline-but-meaningful cases still surface.
    const selfHarm =
      categories['self-harm'] === true ||
      categories['self-harm/intent'] === true ||
      categories['self-harm/instructions'] === true ||
      (scores['self-harm'] || 0) > 0.5 ||
      (scores['self-harm/intent'] || 0) > 0.5;

    return {
      flagged: first.flagged === true,
      selfHarm: !!selfHarm,
      error: false
    };
  } catch (err) {
    // Network failure, timeout, etc. — fall back to keywords, never fail open.
    console.error('OpenAI moderation call failed:', err.message);
    return { flagged: false, selfHarm: false, error: true };
  }
}

/**
 * Comprehensive content moderation — ASYNC.
 *
 * Order of operations:
 *   1. Keyword crisis check (instant). If hit, flag urgent immediately.
 *   2. Keyword offensive / disrespectful check. If hit, reject.
 *   3. OpenAI meaning-based self-harm check (only for content that passed step 1).
 *      If hit, flag urgent.
 *   4. Otherwise, clean -> pending review.
 *
 * @param {string} text - Text to moderate
 * @param {string} type - 'whisper' or 'tribute'
 * @returns {Promise<Object>} - Moderation result with action, status, and reason
 */
async function moderateContent(text, type = 'whisper') {
  const crisis = checkForCrisisContent(text);
  const offensive = checkForOffensiveContent(text);
  const disrespectful = type === 'tribute' ? checkForDisrespectfulContent(text) : { isDisrespectful: false };

  // Priority 1: Keyword crisis content (urgent review, auto-respond with resources)
  if (crisis.isCrisis) {
    return {
      action: 'flag-urgent',
      status: 'urgent-review',
      reason: crisis.reason,
      flagReason: crisis.reason,
      crisisResourcesShown: true,
      approved: false,
      matches: crisis.matches
    };
  }

  // Priority 2: Offensive content (auto-reject)
  if (offensive.isOffensive) {
    return {
      action: 'reject',
      status: 'rejected',
      reason: offensive.reason,
      rejectionReason: offensive.reason,
      approved: false,
      rejected: true,
      matches: offensive.matches
    };
  }

  // Priority 3: Disrespectful content for tributes (auto-reject)
  if (disrespectful.isDisrespectful) {
    return {
      action: 'reject',
      status: 'rejected',
      reason: disrespectful.reason,
      rejectionReason: disrespectful.reason,
      approved: false,
      rejected: true,
      matches: disrespectful.matches
    };
  }

  // Priority 4: OpenAI meaning-based self-harm check (catches quiet language)
  const ai = await checkWithOpenAI(text);

  if (ai.selfHarm) {
    return {
      action: 'flag-urgent',
      status: 'urgent-review',
      reason: 'Possible self-harm language detected (AI moderation)',
      flagReason: 'Possible self-harm language detected (AI moderation)',
      crisisResourcesShown: true,
      approved: false,
      matches: ['ai-moderation-flag']
    };
  }

  // Clean content - pending review
  return {
    action: 'approve-pending',
    status: 'pending',
    reason: ai.error
      ? 'Passed keyword moderation (AI check unavailable)'
      : 'Content passed automated moderation',
    approved: false,
    rejected: false
  };
}

/**
 * Get crisis resources message
 * @returns {Object} - Crisis resources information
 */
function getCrisisResources() {
  return {
    message: `We're concerned about your wellbeing. If you're in crisis or experiencing thoughts of self-harm, please reach out to these resources immediately:`,
    resources: [
      {
        name: '988 Suicide & Crisis Lifeline',
        phone: '988',
        description: '24/7 crisis support in English and Spanish'
      },
      {
        name: 'Crisis Text Line',
        phone: 'Text HOME to 741741',
        description: '24/7 crisis support via text'
      },
      {
        name: 'International Association for Suicide Prevention',
        url: 'https://www.iasp.info/resources/Crisis_Centres/',
        description: 'Find crisis centers worldwide'
      },
      {
        name: 'Emergency Services',
        phone: '911 (US) or your local emergency number',
        description: 'For immediate danger'
      }
    ],
    closingMessage: 'Your message has been received and will be reviewed. Please know that you are not alone, and help is available.'
  };
}

/**
 * Get rejection message for user
 * @param {string} reason - Rejection reason
 * @param {string} type - Type of submission
 * @returns {Object} - Rejection message
 */
function getRejectionMessage(reason, type = 'whisper') {
  const typeLabel = type === 'tribute' ? 'tribute' : 'whisper';

  return {
    rejected: true,
    message: `Your ${typeLabel} could not be accepted.`,
    reason: reason,
    guidelines: type === 'tribute'
      ? `Our memorial wall is a sacred space for honoring loved ones. Please ensure your tribute is respectful, compassionate, and free from hate speech, slurs, or harassment.`
      : `Whispers of the Veil is a space for reflection and healing. We cannot accept content containing hate speech, slurs, or harassment.`,
    canResubmit: true
  };
}

module.exports = {
  moderateContent,
  checkForCrisisContent,
  checkForOffensiveContent,
  checkForDisrespectfulContent,
  checkWithOpenAI,
  getCrisisResources,
  getRejectionMessage
};
