/**
 * Database backup script
 * Exports data to R2 storage
 */

import { createClient } from '@supabase/supabase-js';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function backupTable(tableName: string): Promise<void> {
  console.log(`Backing up ${tableName}...`);
  
  const { data, error } = await supabase
    .from(tableName)
    .select('*');
  
  if (error) {
    console.error(`Error backing up ${tableName}:`, error);
    return;
  }
  
  const backupData = JSON.stringify(data, null, 2);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const key = `backups/${timestamp}/${tableName}.json`;
  
  await r2Client.send(new PutObjectCommand({
    Bucket: 'truth-engine-backups',
    Key: key,
    Body: backupData,
    ContentType: 'application/json',
  }));
  
  console.log(`✅ Backed up ${tableName} (${data.length} records) to ${key}`);
}

async function main() {
  console.log('💾 Starting database backup...');
  
  const tables = [
    'organizations',
    'users',
    'verification_jobs',
    'verified_facts',
    'subscriptions',
    'api_keys',
  ];
  
  for (const table of tables) {
    await backupTable(table);
  }
  
  console.log('✅ Backup complete!');
}

main().catch(console.error);
