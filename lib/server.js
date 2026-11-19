export function reject(status,message){throw Object.assign(new Error(message),{status});}
export function config(key){return process.env[key] || reject(503,'Store configuration is incomplete.');}
export function endpoint(method,handler){
  return async(req,res)=>{
    res.setHeader('Cache-Control','private, no-store');
    if(req.method!==method){res.setHeader('Allow',method);return res.status(405).end();}
    try{await handler(req,res);}catch(err){
      res.status(err.status||503).json({error:err.status ? err.message : 'Service unavailable. Please try again.'});
    }
  };
}
export async function user(req){
  const token=req.headers.authorization;
  if(!/^Bearer [^\s]+$/.test(token||''))reject(401,'Sign in to continue.');
  const result=await fetch(config('SUPABASE_URL')+'/auth/v1/user',{headers:{apikey:config('SUPABASE_ANON_KEY'),Authorization:token}});
  if(!result.ok)reject(result.status>=500?503:401,'Please sign in again.');
  const identity=await result.json();
  if(!identity.email_confirmed_at)reject(403,'Verify your email to buy.');
  return identity.id;
}
export async function orders(query,method='GET',data,conflict=false){
  const key=config('SUPABASE_SERVICE_ROLE_KEY');
  const result=await fetch(config('SUPABASE_URL')+'/rest/v1/apex_orders?'+query,{
    method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'+(conflict?',resolution=ignore-duplicates':'')},
    body:data===undefined?undefined:JSON.stringify(data)
  });
  if(!result.ok)reject(503,'Order storage is unavailable.');
  return result.json();
}
export async function gateway(path,body){
  const result=await fetch('https://api.nowpayments.io/v1/'+path,{
    method:body?'POST':'GET',headers:{'x-api-key':config('NOWPAYMENTS_API_KEY'),'Content-Type':'application/json'},
    body:body?JSON.stringify(body):undefined
  });
  if(!result.ok)reject(502,'The payment provider could not complete this request.');
  return result.json();
}
export const uuid=/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
