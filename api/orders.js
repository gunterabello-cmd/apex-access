import {endpoint,user,orders} from '../lib/server.js';
export default endpoint('GET',async(req,res)=>{
 const id=await user(req);
 const rows=await orders('user_id=eq.'+id+'&select=id,items,total_pence,status,delivery_note,created_at,invoice_url&order=created_at.desc&limit=100');
 res.json(rows.map(row=>({...row,delivery_note:row.status==='paid'?row.delivery_note:null})));
});
