import {endpoint,user,config,orders,gateway,reject,uuid} from '../lib/server.js';
import {catalogue} from '../lib/catalogue.js';
export default endpoint('POST',async(req,res)=>{
 const uid=await user(req);
 if(process.env.LIVE_SALES_ENABLED!=='true')reject(503,'The shop is not accepting payments yet.');
 config('NOWPAYMENTS_IPN_SECRET');config('NOWPAYMENTS_API_KEY');
 const origin=new URL(config('APP_ORIGIN')).origin;
 if(!origin.startsWith('https://'))reject(503,'HTTPS checkout is required.');
 const {id,products}=req.body||{};
 if(!uuid.test(id)||!Array.isArray(products)||!products.length||products.length>40)reject(400,'Invalid basket.');
 const items=products.map(name=>{if(typeof name!=='string'||!Object.hasOwn(catalogue,name))reject(400,'Unknown product.');return {name,pence:catalogue[name]};});
 const total=items.reduce((sum,item)=>sum+item.pence,0);
 if(req.body.expectedTotal!==total)reject(409,'Prices changed. Reload to review the new total.');
 const inserted=await orders('on_conflict=id','POST',{id,user_id:uid,items,total_pence:total},true);
 if(!inserted.length){
   const [existing]=await orders('id=eq.'+id+'&user_id=eq.'+uid);
   if(!existing||JSON.stringify(existing.items.map(x=>x.name))!==JSON.stringify(products))reject(409,'Your basket has changed. Start a new checkout.');
   if(existing.status==='awaiting_payment'&&existing.invoice_url)return res.json({url:existing.invoice_url});
   reject(409,'Check your orders before trying again.');
 }
 let invoice;
 try{
   invoice=await gateway('invoice',{price_amount:(total/100).toFixed(2),price_currency:'gbp',order_id:id,order_description:'Apex Access order '+id,ipn_callback_url:origin+'/api/payment',success_url:origin+'/?orders=1',cancel_url:origin+'/?orders=1'});
 }catch(error){
   await orders('id=eq.'+id+'&status=eq.awaiting_payment','PATCH',{status:'failed'});
   throw error;
 }
 const url=new URL(invoice.invoice_url);
 if(url.protocol!=='https:'||!(url.hostname==='nowpayments.io'||url.hostname.endsWith('.nowpayments.io'))||!invoice.id)reject(502,'Invalid payment invoice.');
 await orders('id=eq.'+id,'PATCH',{invoice_id:String(invoice.id),invoice_url:url.href});
 res.json({url:url.href});
});
