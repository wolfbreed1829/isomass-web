import {createHandler} from './lib/handler.js';
import {createSupabaseStore} from './lib/supabase-store.js';
const store=createSupabaseStore(Deno.env.get('SUPABASE_URL'),Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
Deno.serve(createHandler(store));
