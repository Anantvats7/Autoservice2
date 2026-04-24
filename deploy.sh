#!/bin/bash

# AutoServe Deployment Script
# Run this after setting up GitHub secrets

echo "🚀 AutoServe Deployment Script"
echo "================================"

# Check if required tools are installed
command -v supabase >/dev/null 2>&1 || { echo "❌ Supabase CLI not installed. Run: npm install -g supabase"; exit 1; }
command -v vercel >/dev/null 2>&1 || { echo "❌ Vercel CLI not installed. Run: npm install -g vercel"; exit 1; }

# Get project details
read -p "Enter your Supabase Project ID: " PROJECT_ID
read -p "Enter your Lovable API Key: " LOVABLE_API_KEY

echo ""
echo "📦 Deploying Edge Functions to Supabase..."

# Deploy functions
supabase functions deploy --project-ref $PROJECT_ID

if [ $? -eq 0 ]; then
    echo "✅ Edge functions deployed successfully!"
else
    echo "❌ Edge function deployment failed!"
    exit 1
fi

# Set secrets
echo "🔐 Setting environment variables..."
supabase secrets set --project-ref $PROJECT_ID LOVABLE_API_KEY="$LOVABLE_API_KEY"

if [ $? -eq 0 ]; then
    echo "✅ Environment variables set successfully!"
else
    echo "❌ Failed to set environment variables!"
    exit 1
fi

echo ""
echo "🌐 Deploying Frontend to Vercel..."

# Deploy to Vercel
vercel --prod

if [ $? -eq 0 ]; then
    echo "✅ Frontend deployed successfully!"
else
    echo "❌ Frontend deployment failed!"
    exit 1
fi

echo ""
echo "🎉 Deployment Complete!"
echo "========================"
echo ""
echo "✅ Edge Functions: Deployed to Supabase"
echo "✅ Frontend: Deployed to Vercel"
echo "✅ Environment Variables: Configured"
echo ""
echo "🧪 Test your deployment:"
echo "1. Visit your Vercel URL"
echo "2. Try the AI Assistant chat"
echo "3. Test booking through chat"
echo "4. Check manager AI insights"
echo ""
echo "📊 Monitor your functions:"
echo "supabase functions logs ai-diagnostics --project-ref $PROJECT_ID"