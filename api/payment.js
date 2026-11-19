import {createHmac,timingSafeEqual} from 'node:crypto';
import {config,endpoint,orders,gateway,reject,uuid} from '../lib/server.js';
function sorted(value){
 if(Array.isArray(value))return value.map(sorted);
 if(value && typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,sorted(value[k])]));
 return value;
}
export default endpoint('POST',async(req,res)=>{
 const signature=req.headers['x-nowpayments-sig'];
 if(typeof signature!=='string'||!/^[a-f0-9]{128}$/i.test(signature)||!req.body)reject(401,'Invalid signature.');
 const expected=createHmac('sha512',config('NOWPAYMENTS_IPN_SECRET')).update(JSON.stringify(sorted(req.body))).digest();
 if(!timingSafeEqual(expected,Buffer.from(signature,'hex')))reject(401,'Invalid signature.');
 const pid=String(req.body.payment_id);
 if(!/^\d+$/.test(pid))reject(400,'Invalid payment.');
 const payment=await gateway('payment/'+pid);
 if(!uuid.test(payment.order_id)||String(payment.payment_id)!==pid)reject(400,'Invalid order.');
 const [order]=await orders('id=eq.'+payment.order_id);
 if(!order||!order.invoice_id)reject(503,'Invoice pending reconciliation.');
 if(String(payment.invoice_id)!==order.invoice_id||String(payment.price_currency).toLowerCase()!=='gbp'||Math.round(Number(payment.price_amount)*100)!==order.total_pence)reject(409,'Payment details do not match.');
 const state={finished:'paid',partially_paid:'partially_paid',expired:'expired',failed:'failed',refunded:'refunded'}[payment.payment_status];
 if(state){
   let where='id=eq.'+order.id;
   if(state==='refunded')where+='&payment_id=eq.'+pid;
   else where+=state==='paid'?'&status=neq.refunded':'&status=not.in.(paid,refunded)';
   await orders(where,'PATCH',{status:state,payment_id:pid});
 }
 res.json({received:true});
});
