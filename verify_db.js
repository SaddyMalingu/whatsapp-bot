import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';

dotenv.config();

const sb = createClient(process.env.SB_URL, process.env.SB_SERVICE_ROLE_KEY);
const execAsync = promisify(exec);

(async () => {
  console.log('🔍 Verifying Migration #1 tables via direct SQL...\n');
  
  try {
    // Use psql to bypass JS client cache
    const tables = ['bot_tenants', 'bot_templates', 'bot_training_data', 'bot_control_settings', 'bot_message_logs'];
    let passed = 0;
    
    // Extract connection string from environment
    const connStr = process.env.DATABASE_URL;
    if (!connStr) {
      console.log('DATABASE_URL not found, trying via Supabase RPC...\n');
      
      // Fallback: try to count via RPC (without schema cache)
      for (const table of tables) {
        const { count, error } = await sb
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          console.log(`✗ alphadome.${table}: ${error.message.substring(0, 60)}`);
        } else {
          console.log(`✓ alphadome.${table}: Exists (${count} rows)`);
          passed++;
        }
      }
    } else {
      // Use psql directly
      for (const table of tables) {
        try {
          const { stdout, stderr } = await execAsync(
            `psql "${connStr}" -tc "SELECT COUNT(*) FROM alphadome.${table};"`,
            { shell: true, timeout: 5000 }
          );
          
          if (stderr) throw new Error(stderr);
          const count = parseInt(stdout.trim());
          console.log(`✓ alphadome.${table}: Exists (${count} rows)`);
          passed++;
        } catch (e) {
          console.log(`✗ alphadome.${table}: ${e.message.substring(0, 60)}`);
        }
      }
    }
    
    console.log(`\n✅ ${passed}/5 tables confirmed\n`);
    process.exit(passed === 5 ? 0 : 1);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
