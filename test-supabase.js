require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Testing connection to", supabaseUrl);
  try {
    const start = Date.now();
    const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
    console.log(`Response time: ${Date.now() - start}ms`);
    if (error) {
      console.error("Supabase Error:", error);
    } else {
      console.log("Success! Profile count:", data);
    }
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}

test();
