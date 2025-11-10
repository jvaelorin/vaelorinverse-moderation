# VaelorinVerse Content Moderation System

Automated content moderation for Memorial Wall tributes and Whispers of the Veil with **crisis detection**, **auto-rejection of offensive content**, and **urgent alerts**.

---

## 🚨 Features

### 1. **Crisis Detection & Auto-Response**
- Detects self-harm and suicidal language
- Detects threats of violence toward others
- **Automatically shows crisis resources** (988 Lifeline, Crisis Text Line, etc.)
- **Sends urgent email alerts** to admin
- Flags submission as `urgent-review` for immediate attention

### 2. **Offensive Content Auto-Rejection**
- Detects hate speech, slurs, and harassment
- **Automatically rejects** submissions with offensive content
- Provides clear rejection message with guidelines
- Does NOT save to main database (logged separately)

### 3. **Disrespectful Content Filtering (Memorial Wall)**
- Detects trolling and disrespectful language about death
- Auto-rejects inappropriate memorial tributes
- Maintains sacred space for honoring loved ones

### 4. **Different Handling for Each Type**
- **Whispers**: Crisis detection + offensive content filtering
- **Memorial Tributes**: All above + disrespectful content filtering

---

## 📁 File Structure

```
vaelorinverse-moderation/
├── netlify/
│   └── functions/
│       ├── submit-whisper.js          # Whisper submission endpoint
│       ├── submit-tribute.js          # Memorial tribute endpoint
│       └── utils/
│           └── contentModeration.js   # Core moderation logic
├── package.json                       # Dependencies
├── netlify.toml                       # Netlify configuration
├── .env.example                       # Environment variables template
└── README.md                          # This file
```

---

## 🔧 Setup Instructions

### Step 1: Get Firebase Admin Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **eternal-veil-tributes**
3. Click ⚙️ **Project Settings** → **Service Accounts**
4. Click **Generate New Private Key**
5. Download the JSON file
6. You'll need these values:
   - `project_id`
   - `client_email`
   - `private_key`

### Step 2: Set Up Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your Firebase Admin credentials:
   ```env
   FIREBASE_PROJECT_ID=eternal-veil-tributes
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@eternal-veil-tributes.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"
   ```

3. Add your admin email for urgent alerts:
   ```env
   ADMIN_EMAIL=your-email@example.com
   ```

4. **(Optional)** Add SendGrid API key for email alerts:
   ```env
   SENDGRID_API_KEY=SG.your_api_key_here
   ```

### Step 3: Install Dependencies

```bash
cd vaelorinverse-moderation
npm install
```

### Step 4: Deploy to Netlify

#### Option A: Deploy via Netlify CLI

1. Install Netlify CLI globally:
   ```bash
   npm install -g netlify-cli
   ```

2. Login to Netlify:
   ```bash
   netlify login
   ```

3. Initialize the project:
   ```bash
   netlify init
   ```

4. Add environment variables to Netlify:
   ```bash
   netlify env:set FIREBASE_PROJECT_ID "eternal-veil-tributes"
   netlify env:set FIREBASE_CLIENT_EMAIL "your-service-account@project.iam.gserviceaccount.com"
   netlify env:set FIREBASE_PRIVATE_KEY "-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----\n"
   netlify env:set ADMIN_EMAIL "your-email@example.com"
   netlify env:set SENDGRID_API_KEY "SG.your_key"
   ```

5. Deploy:
   ```bash
   netlify deploy --prod
   ```

#### Option B: Deploy via Netlify Dashboard

1. Go to [Netlify](https://app.netlify.com/)
2. Click **Add new site** → **Import an existing project**
3. Connect your Git repository
4. Go to **Site settings** → **Environment variables**
5. Add all variables from `.env.example`
6. Deploy!

---

## 🔗 API Endpoints

Once deployed, your endpoints will be:

### Submit Whisper
```
POST https://your-site.netlify.app/api/submit-whisper

Body:
{
  "text": "whisper content here"
}

Responses:
- 200: Success (clean or urgent with crisis resources)
- 400: Rejected (offensive content) or validation error
- 500: Server error
```

### Submit Tribute
```
POST https://your-site.netlify.app/api/submit-tribute

Body:
{
  "name": "Name of loved one",
  "message": "tribute message",
  "email": "optional@email.com"
}

Responses:
- 200: Success (clean or urgent with crisis resources)
- 400: Rejected (offensive/disrespectful) or validation error
- 500: Server error
```

---

## 📧 Email Notifications Setup

### Option 1: SendGrid (Recommended)

1. Sign up at [SendGrid](https://sendgrid.com/)
2. Create an API key
3. Add to environment variables:
   ```env
   SENDGRID_API_KEY=SG.your_key_here
   ```
4. Uncomment the SendGrid code in the functions:
   ```javascript
   const sgMail = require('@sendgrid/mail');
   sgMail.setApiKey(process.env.SENDGRID_API_KEY);
   await sgMail.send(emailData);
   ```
5. Install SendGrid package:
   ```bash
   npm install @sendgrid/mail
   ```

### Option 2: Mailgun

1. Sign up at [Mailgun](https://www.mailgun.com/)
2. Get your API key and domain
3. Add to environment variables
4. Install and configure Mailgun SDK

### Option 3: Netlify Forms

Use Netlify's built-in form handling for simple email notifications.

---

## 🧪 Testing Locally

1. Run Netlify Dev:
   ```bash
   netlify dev
   ```

2. Test endpoints:
   ```bash
   # Test whisper submission
   curl -X POST http://localhost:8888/api/submit-whisper \
     -H "Content-Type: application/json" \
     -d '{"text": "test whisper"}'

   # Test tribute submission
   curl -X POST http://localhost:8888/api/submit-tribute \
     -H "Content-Type: application/json" \
     -d '{"name": "Test Name", "message": "test message"}'
   ```

3. Test crisis detection:
   ```bash
   curl -X POST http://localhost:8888/api/submit-whisper \
     -H "Content-Type: application/json" \
     -d '{"text": "I want to end my life"}'
   ```
   Should return crisis resources.

4. Test offensive content rejection:
   ```bash
   curl -X POST http://localhost:8888/api/submit-whisper \
     -H "Content-Type: application/json" \
     -d '{"text": "offensive slur here"}'
   ```
   Should return rejection message.

---

## 🎨 Frontend Integration

Update your submission forms to use the new endpoints:

### Whispers Form Example

```javascript
async function submitWhisper(text) {
  try {
    const response = await fetch('https://your-site.netlify.app/api/submit-whisper', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text })
    });

    const result = await response.json();

    if (response.ok) {
      if (result.urgent) {
        // Show crisis resources
        displayCrisisResources(result.resources);
      } else {
        // Show success message
        showMessage(result.message);
      }
    } else {
      // Show rejection message
      showError(result.message, result.reason);
    }
  } catch (error) {
    console.error('Error:', error);
    showError('Failed to submit. Please try again.');
  }
}
```

### Memorial Tribute Form Example

```javascript
async function submitTribute(name, message, email) {
  try {
    const response = await fetch('https://your-site.netlify.app/api/submit-tribute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, message, email })
    });

    const result = await response.json();

    if (response.ok) {
      if (result.urgent) {
        displayCrisisResources(result.resources);
      } else {
        showMessage(result.message);
      }
    } else {
      showError(result.message, result.reason);
    }
  } catch (error) {
    console.error('Error:', error);
    showError('Failed to submit. Please try again.');
  }
}
```

---

## 🔍 How It Works

### Content Moderation Flow

```
User submits content
        ↓
Validate input (length, required fields)
        ↓
Run content moderation
        ↓
    ┌───┴───┐
    │ Check │
    └───┬───┘
        ├─→ Crisis detected? → Flag urgent + Show crisis resources + Email admin
        ├─→ Offensive? → Reject + Show guidelines
        ├─→ Disrespectful? (tributes only) → Reject + Show guidelines
        └─→ Clean? → Save as pending review
```

### Moderation Categories

1. **Crisis/Self-Harm** (Priority 1)
   - Status: `urgent-review`
   - Action: Save + Alert + Show resources
   - Admin notified immediately

2. **Offensive Content** (Priority 2)
   - Status: `rejected`
   - Action: Reject + Don't save to main DB
   - User sees rejection reason

3. **Disrespectful** (Priority 3, tributes only)
   - Status: `rejected`
   - Action: Reject + Don't save to main DB
   - User sees guidelines

4. **Clean Content**
   - Status: `pending`
   - Action: Save for manual review
   - User sees confirmation

---

## 🛠️ Customization

### Add More Keywords

Edit [netlify/functions/utils/contentModeration.js](netlify/functions/utils/contentModeration.js):

```javascript
const CRISIS_PATTERNS = [
  // Add your patterns here
  /\b(new keyword pattern)\b/i,
];
```

### Adjust Character Limits

Edit the validation in submit functions:

```javascript
// In submit-whisper.js or submit-tribute.js
if (trimmedText.length > 280) {  // Change this number
  return { statusCode: 400, ... };
}
```

### Customize Response Messages

Edit the `getCrisisResources()` and `getRejectionMessage()` functions in [contentModeration.js](netlify/functions/utils/contentModeration.js).

---

## 📊 Database Collections

### Main Collections
- `tributes` - Approved/pending memorial tributes
- `whispers` - Approved/pending whispers

### Monitoring Collections
- `rejected_tributes` - Auto-rejected tributes (logged for review)
- `rejected_whispers` - Auto-rejected whispers (logged for review)

### Document Fields

**Tributes:**
```javascript
{
  name: string,
  message: string,
  email: string | null,
  createdAt: timestamp,
  status: 'pending' | 'urgent-review' | 'approved' | 'rejected',
  approved: boolean,
  rejected: boolean,
  moderationResult: string,
  crisisResourcesShown: boolean,      // If crisis detected
  flagReason: string,                  // If flagged
  rejectionReason: string,             // If rejected
  detectedKeywords: string[]           // Keywords that triggered action
}
```

**Whispers:**
```javascript
{
  text: string,
  timestamp: timestamp,
  status: 'pending' | 'urgent-review' | 'flagged' | 'approved' | 'rejected',
  approved: boolean,
  rejected: boolean,
  moderationResult: string,
  crisisResourcesShown: boolean,
  flagReason: string,
  rejectionReason: string,
  detectedKeywords: string[]
}
```

---

## 🚀 Deployment Checklist

- [ ] Firebase Admin credentials configured
- [ ] Environment variables set in Netlify
- [ ] Admin email configured for alerts
- [ ] Email service (SendGrid/Mailgun) configured
- [ ] Functions deployed successfully
- [ ] Test crisis detection
- [ ] Test offensive content rejection
- [ ] Test clean content submission
- [ ] Frontend forms updated to use new endpoints
- [ ] Dashboard shows urgent alerts properly

---

## 🆘 Crisis Resources Shown to Users

When crisis language is detected, users automatically see:

- **988 Suicide & Crisis Lifeline**: Call or text 988
- **Crisis Text Line**: Text HOME to 741741
- **International Resources**: https://www.iasp.info/resources/Crisis_Centres/
- **Emergency Services**: 911 or local emergency number

---

## 🔐 Security Notes

- All Firebase credentials stored as environment variables (never in code)
- CORS headers configured for security
- Rate limiting recommended (add via Netlify or Cloudflare)
- Input validation on all submissions
- IP addresses logged for abuse prevention

---

## 📝 License

MIT License - Feel free to use and modify for your project.

---

## 💬 Support

For issues or questions:
1. Check the Netlify function logs
2. Review Firebase Firestore for submission data
3. Test moderation logic with sample inputs
4. Check email service logs for delivery issues

---

**Built with ❤️ for VaelorinVerse**
