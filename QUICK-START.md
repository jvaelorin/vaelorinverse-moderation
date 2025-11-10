# 🚀 Quick Start Guide

Get your content moderation system up and running in under 10 minutes!

---

## Step 1: Get Firebase Service Account Key (2 minutes)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select **eternal-veil-tributes** project
3. Click ⚙️ (Settings) → **Project Settings**
4. Click **Service Accounts** tab
5. Click **Generate New Private Key** button
6. Save the downloaded JSON file (keep it secure!)

From the JSON file, you'll need:
- `project_id`
- `client_email`
- `private_key`

---

## Step 2: Deploy to Netlify (3 minutes)

### Option A: Deploy via GitHub (Recommended)

1. **Create a new GitHub repository**
   ```bash
   cd vaelorinverse-moderation
   git init
   git add .
   git commit -m "Initial commit: Content moderation system"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/vaelorinverse-moderation.git
   git push -u origin main
   ```

2. **Deploy on Netlify**
   - Go to [app.netlify.com](https://app.netlify.com/)
   - Click **Add new site** → **Import an existing project**
   - Choose **GitHub** and select your repository
   - Click **Deploy site**

3. **Add Environment Variables**
   - Go to **Site settings** → **Environment variables**
   - Click **Add a variable**
   - Add these (from your Firebase JSON file):

   | Key | Value |
   |-----|-------|
   | `FIREBASE_PROJECT_ID` | `eternal-veil-tributes` |
   | `FIREBASE_CLIENT_EMAIL` | From JSON: `client_email` |
   | `FIREBASE_PRIVATE_KEY` | From JSON: `private_key` (entire string including `-----BEGIN PRIVATE KEY-----`) |
   | `ADMIN_EMAIL` | Your email for urgent alerts |

4. **Redeploy**
   - Go to **Deploys** tab
   - Click **Trigger deploy** → **Deploy site**

### Option B: Deploy via Netlify CLI (Manual)

1. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Login to Netlify**
   ```bash
   netlify login
   ```

3. **Initialize the project**
   ```bash
   cd vaelorinverse-moderation
   netlify init
   ```

4. **Set environment variables**
   ```bash
   netlify env:set FIREBASE_PROJECT_ID "eternal-veil-tributes"
   netlify env:set FIREBASE_CLIENT_EMAIL "your-service-account@project.iam.gserviceaccount.com"
   netlify env:set FIREBASE_PRIVATE_KEY "-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"
   netlify env:set ADMIN_EMAIL "your-email@example.com"
   ```

5. **Deploy**
   ```bash
   npm install
   netlify deploy --prod
   ```

---

## Step 3: Test Your Endpoints (2 minutes)

Once deployed, your site will have a URL like `https://your-site-name.netlify.app`

### Test Whisper Submission
```bash
curl -X POST https://your-site-name.netlify.app/api/submit-whisper \
  -H "Content-Type: application/json" \
  -d '{"text": "This is a test whisper"}'
```

Expected response:
```json
{
  "success": true,
  "message": "Your whisper has been received and is pending review. Thank you for sharing.",
  "whisperId": "abc123..."
}
```

### Test Tribute Submission
```bash
curl -X POST https://your-site-name.netlify.app/api/submit-tribute \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Name", "message": "Test tribute message"}'
```

Expected response:
```json
{
  "success": true,
  "message": "Your tribute has been received and is pending review. Thank you for honoring their memory.",
  "tributeId": "xyz789..."
}
```

### Test Crisis Detection
```bash
curl -X POST https://your-site-name.netlify.app/api/submit-whisper \
  -H "Content-Type: application/json" \
  -d '{"text": "I want to end my life"}'
```

Expected response (should include crisis resources):
```json
{
  "success": true,
  "urgent": true,
  "message": "We're concerned about your wellbeing...",
  "resources": [...]
}
```

### Test Offensive Content Rejection
```bash
curl -X POST https://your-site-name.netlify.app/api/submit-whisper \
  -H "Content-Type: application/json" \
  -d '{"text": "kill yourself"}'
```

Expected response (should be rejected):
```json
{
  "rejected": true,
  "message": "Your whisper could not be accepted.",
  "reason": "Offensive language, hate speech, or slurs detected"
}
```

---

## Step 4: Update Your Website Forms (3 minutes)

Copy the example forms from the `examples/` folder and update the API URL:

### For Whispers Form:
```javascript
const response = await fetch('https://YOUR-SITE-NAME.netlify.app/api/submit-whisper', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text })
});
```

### For Memorial Tribute Form:
```javascript
const response = await fetch('https://YOUR-SITE-NAME.netlify.app/api/submit-tribute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, message, email })
});
```

---

## ✅ You're Done!

Your content moderation system is now live with:

- ✅ **Crisis detection** → Auto-responds with 988 Lifeline and resources
- ✅ **Offensive content filtering** → Auto-rejects hate speech/slurs
- ✅ **Disrespectful content filtering** → Auto-rejects trolling on memorial wall
- ✅ **Urgent email alerts** → Notifies you of crisis submissions
- ✅ **Clean content approval** → Pending review in your dashboard

---

## 📧 Optional: Set Up Email Alerts

### SendGrid Setup (Recommended)

1. Sign up at [SendGrid.com](https://sendgrid.com/)
2. Create an API key (Settings → API Keys)
3. Add to Netlify environment variables:
   ```bash
   netlify env:set SENDGRID_API_KEY "SG.your_api_key_here"
   ```

4. Install SendGrid in your project:
   ```bash
   npm install @sendgrid/mail
   ```

5. Uncomment the SendGrid code in `submit-whisper.js` and `submit-tribute.js`:
   ```javascript
   const sgMail = require('@sendgrid/mail');
   sgMail.setApiKey(process.env.SENDGRID_API_KEY);
   await sgMail.send(emailData);
   ```

6. Redeploy:
   ```bash
   netlify deploy --prod
   ```

---

## 🔍 Verify Everything Works

### Check Firebase
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Open **Firestore Database**
3. Submit a test whisper/tribute
4. Check that it appears in the `whispers` or `tributes` collection

### Check Admin Dashboard
1. Go to your admin dashboard: `https://vaelorinverse.com/admin/dashboard.html`
2. Login with your credentials
3. Check that submissions appear in the appropriate tabs
4. Verify that urgent submissions show with 🚨 badge

### Check Email Alerts (if configured)
1. Submit a test with crisis language
2. Check your admin email for urgent alert
3. Verify email contains submission details and dashboard link

---

## 🎯 Next Steps

1. **Customize keywords** in `netlify/functions/utils/contentModeration.js`
2. **Adjust character limits** in submit functions
3. **Add more crisis resources** if needed
4. **Monitor submissions** regularly via dashboard
5. **Review rejected content** in `rejected_whispers` and `rejected_tributes` collections

---

## 🆘 Troubleshooting

### Functions not deploying?
```bash
# Check Netlify deploy logs
netlify logs:function submit-whisper
netlify logs:function submit-tribute
```

### Firebase errors?
- Verify environment variables are set correctly
- Check that private key includes the full `-----BEGIN/END PRIVATE KEY-----` block
- Ensure service account has Firestore permissions

### CORS errors?
- Check that your website domain is allowed
- Verify headers in `netlify.toml`

### Not receiving emails?
- Check SendGrid API key is valid
- Verify ADMIN_EMAIL is correct
- Check spam folder
- Review Netlify function logs

---

## 📞 Support

For issues:
1. Check Netlify function logs
2. Review Firebase Firestore rules
3. Test with curl commands above
4. Check browser console for errors

---

**You're all set! 🎉**

Your VaelorinVerse content moderation system is protecting your community and providing life-saving resources when needed.
