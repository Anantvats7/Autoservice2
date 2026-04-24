# AutoServe Deployment Guide

## 🚀 Complete GitHub + Supabase + Vercel Integration

### Prerequisites
- GitHub repository for your AutoServe project
- Supabase project (existing)
- Vercel account
- Node.js 18+ installed locally

---

## 1. Get Supabase Credentials

### A. Supabase Access Token
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click your profile → **Access Tokens**
3. Click **Generate new token**
4. Name it "GitHub Actions" 
5. Copy the token (starts with `sbp_`)

### B. Supabase Project ID
1. In your Supabase project dashboard
2. Go to **Settings** → **General**
3. Copy the **Reference ID** (looks like `abcdefghijklmnop`)

### C. Lovable API Key
1. Go to [Lovable Dashboard](https://lovable.dev)
2. Navigate to **API Keys** section
3. Copy your existing API key (starts with `lvbl_`)

---

## 2. Set GitHub Repository Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add these:

```
SUPABASE_ACCESS_TOKEN = sbp_your_token_here
SUPABASE_PROJECT_ID = your_project_ref_id_here  
LOVABLE_API_KEY = lvbl_your_api_key_here
```

### Optional: For Vercel Auto-Deploy
If you want GitHub to also deploy to Vercel automatically:

```
VERCEL_TOKEN = your_vercel_token
VERCEL_ORG_ID = your_vercel_org_id
VERCEL_PROJECT_ID = your_vercel_project_id
```

---

## 3. Deploy Edge Functions to Supabase

### Option A: Automatic (Recommended)
1. Push your code to GitHub main/master branch
2. GitHub Actions will automatically deploy your functions
3. Check the **Actions** tab to see deployment progress

### Option B: Manual Deploy
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Deploy functions
supabase functions deploy --project-ref YOUR_PROJECT_ID

# Set environment variables
supabase secrets set LOVABLE_API_KEY="your_lovable_api_key"
```

---

## 4. Deploy Frontend to Vercel

### Option A: Vercel Dashboard (Easiest)
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **New Project**
3. Import your GitHub repository
4. Vercel will auto-detect it's a Vite project
5. Add environment variables:
   ```
   VITE_SUPABASE_URL = https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY = your_anon_key
   ```
6. Click **Deploy**

### Option B: Vercel CLI
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

---

## 5. Test Your Deployment

### Test Edge Functions
```bash
# Test AI Diagnostics
curl -X POST https://your-project.supabase.co/functions/v1/ai-diagnostics \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"symptoms": "Engine making noise", "vehicle": {"make": "Maruti", "model": "Swift"}}'

# Test AI Chat
curl -X POST https://your-project.supabase.co/functions/v1/ai-diagnostics \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"mode": "chat", "history": [{"role": "user", "content": "Hello"}]}'
```

### Test Frontend
1. Visit your Vercel URL
2. Try logging in with demo accounts
3. Test AI Assistant chat
4. Test booking through chat
5. Test all AI features

---

## 6. Automatic Deployments

Once set up, your deployments will be automatic:

- **Push to GitHub** → Edge functions deploy to Supabase
- **Push to GitHub** → Frontend deploys to Vercel (if configured)
- **No manual steps needed!**

---

## 🔧 Troubleshooting

### Edge Function Deployment Issues
```bash
# Check function logs
supabase functions logs ai-diagnostics --project-ref YOUR_PROJECT_ID

# Test locally first
supabase functions serve --project-ref YOUR_PROJECT_ID
```

### Frontend Build Issues
```bash
# Test build locally
npm run build
npm run preview
```

### Environment Variables
Make sure all environment variables are set correctly:
- Supabase URL and keys
- Lovable API key
- Vercel tokens (if using auto-deploy)

---

## 📱 Production Checklist

- [ ] Edge functions deployed and working
- [ ] Frontend deployed to Vercel
- [ ] Environment variables configured
- [ ] AI features working (chat, diagnostics, booking)
- [ ] Database migrations applied
- [ ] Demo accounts seeded
- [ ] GitHub Actions working
- [ ] All tests passing

---

## 🎉 You're Live!

Your AutoServe platform is now deployed with:
- ✅ AI-powered chat assistant with booking capability
- ✅ AI diagnostics and recommendations  
- ✅ AI insights for managers
- ✅ Automatic deployments via GitHub
- ✅ Production-ready infrastructure

Share your Vercel URL and start testing! 🚗✨