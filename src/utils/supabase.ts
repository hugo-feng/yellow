import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://spnfwedzbfcqdfgczhzu.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_Fd9UdLl0X5zQvPcZKRDYGA_7NNQprde'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
