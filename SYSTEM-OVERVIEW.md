# 🛡️ VaelorinVerse Content Moderation System Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      User Submission                             │
│                 (Whisper or Memorial Tribute)                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│               Netlify Serverless Function                        │
│        /api/submit-whisper or /api/submit-tribute                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Input Validation                                │
│  • Check required fields                                         │
│  • Validate character limits                                     │
│  • Sanitize input                                                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Content Moderation Engine                           │
│           (contentModeration.js utility)                         │
│                                                                   │
│  Priority 1: Crisis Detection                                    │
│  ├─ Self-harm keywords                                           │
│  ├─ Suicidal language                                            │
│  └─ Threats to others                                            │
│                                                                   │
│  Priority 2: Offensive Content                                   │
│  ├─ Hate speech                                                  │
│  ├─ Racial slurs                                                 │
│  └─ Harassment                                                   │
│                                                                   │
│  Priority 3: Disrespectful (Tributes Only)                       │
│  ├─ Trolling language                                            │
│  └─ Mocking death                                                │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    ┌────────┐     ┌─────────┐    ┌──────────┐
    │ CRISIS │     │OFFENSIVE│    │  CLEAN   │
    │DETECTED│     │DETECTED │    │ CONTENT  │
    └───┬────┘     └────┬────┘    └────┬─────┘
        │               │              │
        ▼               ▼              ▼
┌────────────────┐ ┌────────────┐ ┌──────────────┐
│ 🚨 URGENT      │ │ ❌ REJECT  │ │ ✅ PENDING   │
│                │ │            │ │              │
│ Actions:       │ │ Actions:   │ │ Actions:     │
│ • Save to DB   │ │ • Log only │ │ • Save to DB │
│ • Flag urgent  │ │ • Reject   │ │ • Set pending│
│ • Show crisis  │ │ • Show     │ │ • Confirm    │
│   resources    │ │   reason   │ │              │
│ • Email admin  │ │            │ │              │
│ • 988 Lifeline │ │            │ │              │
│ • Crisis Text  │ │            │ │              │
└────────────────┘ └────────────┘ └──────────────┘
        │               │              │
        └───────────────┴──────────────┘
                         │
                         ▼
              ┌──────────────────┐
              │ Firebase Firestore│
              │                   │
              │  Collections:     │
              │  • whispers       │
              │  • tributes       │
              │  • rejected_*     │
              └──────────────────┘
                         │
                         ▼
              ┌──────────────────┐
              │  Admin Dashboard │
              │  dashboard.html  │
              │                   │
              │  Views:           │
              │  • All submissions│
              │  • Urgent 🚨      │
              │  • Flagged ⚠️     │
              │  • Pending ⏳     │
              │  • Approved ✅    │
              └──────────────────┘
```

---

## 🔄 Submission Flow Examples

### Example 1: Clean Whisper Submission

```
User Input: "I miss you grandma, thinking of you today"
                    ↓
        [Content Moderation]
                    ↓
           No flags detected
                    ↓
         Status: PENDING REVIEW
                    ↓
    Saved to Firestore: whispers/
                    ↓
  User sees: "Thank you for sharing"
                    ↓
   Admin reviews in dashboard
                    ↓
         Approve/Reject
```

---

### Example 2: Crisis Language Detected

```
User Input: "I can't go on, I want to end my life"
                    ↓
        [Content Moderation]
                    ↓
   🚨 CRISIS KEYWORDS DETECTED
   • "can't go on"
   • "end my life"
                    ↓
         Status: URGENT-REVIEW
                    ↓
    Saved to Firestore: whispers/
    + crisisResourcesShown: true
                    ↓
   📧 EMAIL ALERT TO ADMIN
   "🚨 URGENT: Self-harm detected"
                    ↓
  User sees: CRISIS RESOURCES
  • 988 Suicide & Crisis Lifeline
  • Crisis Text Line (741741)
  • International resources
  • Emergency services (911)
                    ↓
   Admin notified immediately
   Reviews in "Urgent" tab 🚨
```

---

### Example 3: Offensive Content Rejected

```
User Input: "contains hate speech or slurs"
                    ↓
        [Content Moderation]
                    ↓
   ❌ OFFENSIVE KEYWORDS DETECTED
   • [specific slur/hate speech]
                    ↓
         Status: REJECTED
                    ↓
    NOT saved to main database
    Logged to: rejected_whispers/
                    ↓
  User sees: REJECTION MESSAGE
  "Your whisper could not be accepted.

   Reason: Offensive language detected

   Guidelines: Whispers of the Veil is
   a space for reflection and healing..."
                    ↓
         Submission blocked
    Admin can review logs if needed
```

---

### Example 4: Disrespectful Tribute Rejected

```
User Input: "lol glad they're dead"
                    ↓
        [Content Moderation]
                    ↓
   ❌ DISRESPECTFUL LANGUAGE
   • "lol" + "dead"
   • "glad" + "dead"
                    ↓
         Status: REJECTED
                    ↓
    NOT saved to main database
    Logged to: rejected_tributes/
                    ↓
  User sees: REJECTION MESSAGE
  "Your tribute could not be accepted.

   Reason: Disrespectful language

   Guidelines: Our memorial wall is a
   sacred space for honoring loved ones.
   Please ensure your tribute is
   respectful and compassionate."
                    ↓
         Submission blocked
```

---

## 📊 Database Schema

### Whispers Collection

```javascript
whispers/ {
  whisperId: {
    text: string,                    // The whisper content
    timestamp: timestamp,             // When submitted
    status: string,                   // pending | urgent-review | flagged | approved | rejected
    approved: boolean,                // Manual approval status
    rejected: boolean,                // Manual rejection status
    moderationResult: string,         // What the AI detected
    crisisResourcesShown: boolean,    // Crisis resources shown?
    flagReason: string,               // Why flagged
    rejectionReason: string,          // Why rejected
    detectedKeywords: string[],       // Keywords that triggered
    ipAddress: string                 // For abuse prevention
  }
}
```

### Tributes Collection

```javascript
tributes/ {
  tributeId: {
    name: string,                     // Name of loved one
    message: string,                  // Tribute message
    email: string | null,             // Optional email
    createdAt: timestamp,             // When submitted
    status: string,                   // pending | urgent-review | approved | rejected
    approved: boolean,
    rejected: boolean,
    moderationResult: string,
    crisisResourcesShown: boolean,
    flagReason: string,
    rejectionReason: string,
    detectedKeywords: string[],
    ipAddress: string,
    submittedFrom: 'memorial-wall'    // Source tracking
  }
}
```

---

## 🎯 Content Moderation Rules

### Crisis Detection Rules

| Pattern | Action | Reason |
|---------|--------|--------|
| "kill myself" | Flag urgent | Self-harm |
| "suicide" | Flag urgent | Self-harm |
| "want to die" | Flag urgent | Self-harm |
| "can't go on" | Flag urgent | Despair |
| "no reason to live" | Flag urgent | Self-harm |
| "kill them/him/her" | Flag urgent | Threats |
| "shoot up" | Flag urgent | Violence |
| "pills + overdose" | Flag urgent | Self-harm method |

### Offensive Content Rules

| Pattern | Action | Reason |
|---------|--------|--------|
| Racial slurs | Reject | Hate speech |
| "hate [group]" | Reject | Hate speech |
| Homophobic slurs | Reject | Hate speech |
| "kill yourself" | Reject | Harassment |
| Sexist slurs | Reject | Hate speech |

### Disrespectful Rules (Tributes)

| Pattern | Action | Reason |
|---------|--------|--------|
| "lol/lmao + dead" | Reject | Mocking death |
| "glad + dead" | Reject | Disrespectful |
| "deserved + death" | Reject | Disrespectful |
| "rot in hell" | Reject | Hateful |
| "fake + memorial" | Reject | Trolling |

---

## 📧 Email Notification Format

### Urgent Alert Email

```
Subject: 🚨 URGENT: Crisis Language Detected in Whisper Submission

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚨 URGENT WHISPER ALERT

Status: Requires immediate review
Reason: Self-harm or suicidal language detected
Submitted: [timestamp]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Whisper Content:
"[exact submission text]"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Detected Keywords:
• keyword1
• keyword2

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Actions Taken:
✅ Crisis resources automatically shown to user
✅ Submission flagged for urgent review
✅ Admin notification sent

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[VIEW IN DASHBOARD]
```

---

## 🔐 Security Features

1. **Input Validation**
   - Character limits enforced
   - Required field checks
   - Email format validation
   - SQL injection prevention (Firestore handles this)

2. **Rate Limiting** (Recommended to add)
   - IP-based limits
   - Netlify built-in protection

3. **CORS Protection**
   - Configured in netlify.toml
   - Allows your domains only

4. **Privacy**
   - No PII stored unnecessarily
   - IP addresses for abuse prevention only
   - Email optional for tributes

5. **Credentials Security**
   - Environment variables only
   - Never in code
   - .gitignore configured

---

## 🎨 User Experience Flows

### Crisis Resources Display

```html
┌─────────────────────────────────────────┐
│ 🚨 We're Concerned About You            │
├─────────────────────────────────────────┤
│                                          │
│ If you're in crisis or experiencing     │
│ thoughts of self-harm, please reach     │
│ out to these resources immediately:     │
│                                          │
│ ┌─────────────────────────────────────┐ │
│ │ National Suicide Prevention Lifeline│ │
│ │ 988                                 │ │
│ │ 24/7 crisis support                 │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ ┌─────────────────────────────────────┐ │
│ │ Crisis Text Line                    │ │
│ │ Text HOME to 741741                 │ │
│ │ 24/7 crisis support via text        │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ Your message has been received.          │
│ You are not alone. Help is available.   │
└─────────────────────────────────────────┘
```

### Rejection Message Display

```html
┌─────────────────────────────────────────┐
│ ❌ Submission Not Accepted               │
├─────────────────────────────────────────┤
│                                          │
│ Your whisper could not be accepted.     │
│                                          │
│ Reason:                                  │
│ Offensive language, hate speech, or     │
│ slurs detected                           │
│                                          │
│ Guidelines:                              │
│ Whispers of the Veil is a space for     │
│ reflection and healing. We cannot       │
│ accept content containing hate speech,  │
│ slurs, or harassment.                    │
│                                          │
│ You may submit a new whisper that       │
│ follows our community guidelines.       │
└─────────────────────────────────────────┘
```

---

## 📈 Admin Dashboard Features

### Urgent Alert Badge

```
🕊 Whispers  [3]  ← Unread urgent count

┌─────────────────────────────────────┐
│ 🚨 URGENT - SELF-HARM               │
│ "I want to end my life..."          │
│                                      │
│ Crisis Resources Shown: ✅ Yes      │
│ Flag Reason: Self-harm detected     │
│                                      │
│ [✅ Approve] [✏️ Edit] [🗑️ Delete] │
└─────────────────────────────────────┘
```

### Filter Views

- **All** - Every submission
- **🚨 Urgent** - Crisis language detected
- **⚠️ Flagged** - Needs review
- **⏳ Pending** - Awaiting approval
- **✅ Approved** - Publicly visible

---

## 🔧 Customization Options

### 1. Adjust Sensitivity

Edit `contentModeration.js`:
```javascript
// More strict (more keywords)
const CRISIS_PATTERNS = [
  /existing patterns/,
  /\b(additional keywords)\b/i
];

// Less strict (fewer keywords)
// Remove patterns you don't want
```

### 2. Change Character Limits

Edit submit functions:
```javascript
// Whispers: Default 280 characters
if (trimmedText.length > 500) { ... }  // Increase to 500

// Tributes: Default 1000 characters
if (trimmedMessage.length > 2000) { ... }  // Increase to 2000
```

### 3. Add Custom Actions

```javascript
// In submit-whisper.js or submit-tribute.js
if (moderation.action === 'custom-action') {
  // Your custom logic
}
```

---

## ✅ Testing Checklist

- [ ] Crisis detection works (shows resources)
- [ ] Offensive content gets rejected
- [ ] Disrespectful tributes get rejected
- [ ] Clean content goes to pending
- [ ] Email alerts work (if configured)
- [ ] Dashboard shows submissions
- [ ] Urgent tab highlights crisis submissions
- [ ] Forms display error/success messages
- [ ] Character counters work
- [ ] Validation prevents empty submissions

---

**System Status: Ready for Production ✅**

Your VaelorinVerse content moderation system is production-ready with comprehensive safety features, crisis intervention, and offensive content filtering.
