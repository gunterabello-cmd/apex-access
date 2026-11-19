import {catalogue} from '../lib/catalogue.js';
import {endpoint,config} from '../lib/server.js';
export default endpoint('GET',async(req,res)=>res.json({
 prices:catalogue,url:config('SUPABASE_URL'),key:config('SUPABASE_ANON_KEY'),live:process.env.LIVE_SALES_ENABLED==='true'
}));
