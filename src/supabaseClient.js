import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bmohchmbqaxvtfgfsgne.supabase.co'
// Use your actual Anon Key here
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY 

// Make sure the word "export" is here!
export const supabase = createClient(supabaseUrl, supabaseKey)