// Test script for AutoServe AI functions
// Run with: node test-deployment.js

const SUPABASE_URL = 'https://your-project.supabase.co'; // Replace with your URL
const SUPABASE_ANON_KEY = 'your-anon-key'; // Replace with your anon key

async function testAIDiagnostics() {
  console.log('🔧 Testing AI Diagnostics...');
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-diagnostics`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        symptoms: 'Engine making strange noise and vibrating',
        vehicle: {
          make: 'Maruti',
          model: 'Swift',
          year: 2020,
          fuel_type: 'Petrol',
          mileage: 45000
        }
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ AI Diagnostics working!');
      console.log('Faults found:', data.faults?.length || 0);
      console.log('Services recommended:', data.recommended_service_ids?.length || 0);
      console.log('Pro tip:', data.proTip);
    } else {
      console.log('❌ AI Diagnostics failed:', data.error);
    }
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

async function testAIChat() {
  console.log('💬 Testing AI Chat...');
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-diagnostics`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'chat',
        history: [
          { role: 'user', content: 'Hello! I need help with my car.' }
        ],
        context: {
          customer: { name: 'Test User' },
          vehicles: [
            { id: 'test-vehicle-1', label: 'Maruti Swift', registration: 'MH01AB1234', mileage: 45000 }
          ],
          services: [
            { id: 'oil-change', name: 'Oil Change', category: 'Maintenance', price: 1500 }
          ]
        }
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ AI Chat working!');
      console.log('Reply:', data.reply);
      if (data.booking_intent) {
        console.log('🎯 Booking intent detected:', data.booking_intent);
      }
    } else {
      console.log('❌ AI Chat failed:', data.error);
    }
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

async function runTests() {
  console.log('🧪 AutoServe Deployment Tests');
  console.log('==============================');
  console.log('');
  
  if (SUPABASE_URL.includes('your-project') || SUPABASE_ANON_KEY.includes('your-anon')) {
    console.log('❌ Please update SUPABASE_URL and SUPABASE_ANON_KEY in this file first!');
    return;
  }
  
  await testAIDiagnostics();
  console.log('');
  await testAIChat();
  
  console.log('');
  console.log('🎉 Tests complete! Check the results above.');
}

runTests();