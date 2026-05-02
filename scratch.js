const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://qnkoktlfviyqvzukhiba.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFua29rdGxmdml5cXZ6dWtoaWJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2Njg1MjMsImV4cCI6MjA5MzI0NDUyM30.wR4z3Ry8tsAgRUTyAYFnk2MOIXAEZj9YoZNUkMSVBWM'
);

async function test() {
  const { data, error } = await supabase
    .from('household_invitations')
    .select('*');
  console.log('Data:', data);
  console.log('Error:', error);
}

test();
