/**
 * Database seeding script
 * Populates initial data for development/testing
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedOrganizations() {
  const orgs = [
    { name: 'Acme Corp', slug: 'acme', plan: 'pro' },
    { name: 'TechStart Inc', slug: 'techstart', plan: 'business' },
    { name: 'Global Solutions', slug: 'global', plan: 'enterprise' },
  ];
  
  for (const org of orgs) {
    const { data, error } = await supabase
      .from('organizations')
      .upsert({ ...org, created_at: Date.now(), updated_at: Date.now() })
      .select();
    
    if (error) console.error('Error seeding org:', error);
    else console.log(`Seeded organization: ${org.name}`);
  }
}

async function seedUsers() {
  const users = [
    { email: 'admin@acme.com', name: 'Admin User', role: 'owner' },
    { email: 'user@techstart.com', name: 'Regular User', role: 'member' },
  ];
  
  for (const user of users) {
    const { data, error } = await supabase
      .from('users')
      .upsert({ ...user, created_at: Date.now(), updated_at: Date.now() })
      .select();
    
    if (error) console.error('Error seeding user:', error);
    else console.log(`Seeded user: ${user.email}`);
  }
}

async function seedVerifiedFacts() {
  const facts = [
    { claim: 'The Earth revolves around the Sun', verdict: 'TRUE', confidence: 0.99 },
    { claim: 'Water boils at 100 degrees Celsius at sea level', verdict: 'TRUE', confidence: 0.98 },
    { claim: 'The Great Wall of China is visible from space', verdict: 'FALSE', confidence: 0.95 },
    { claim: 'Humans only use 10% of their brain', verdict: 'FALSE', confidence: 0.92 },
    { claim: 'The first computer was invented in 1945', verdict: 'SUSPICIOUS', confidence: 0.65 },
  ];
  
  for (const fact of facts) {
    const { data, error } = await supabase
      .from('verified_facts')
      .upsert({ ...fact, created_at: Date.now(), last_verified_at: Date.now(), verification_count: 1 })
      .select();
    
    if (error) console.error('Error seeding fact:', error);
    else console.log(`Seeded fact: ${fact.claim.substring(0, 30)}...`);
  }
}

async function main() {
  console.log('🌱 Seeding database...');
  
  await seedOrganizations();
  await seedUsers();
  await seedVerifiedFacts();
  
  console.log('✅ Seeding complete!');
}

main().catch(console.error);
