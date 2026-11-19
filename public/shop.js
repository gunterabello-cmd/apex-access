(() => {
 const panel=document.querySelector('#accountDialog');
 const form=document.querySelector('#credentials');
 const note=document.querySelector('#accountMessage');
 const history=document.querySelector('#orderHistory');
 const checkout=document.querySelector('#checkout');
 const account=document.querySelector('#accountButton');
 let settings, session, buying=false, processing=false;
 const fmt=p=>'£'+(p/100).toFixed(2);
 const storageKey='apex-account-v1';
 function saveSession(value){
   session=value;
   if(value)sessionStorage.setItem(storageKey,JSON.stringify(value));
   else sessionStorage.removeItem(storageKey);
   account.textContent=value?'My orders':'Sign in';
 }
 function showPanel(){
   cart(false);
   if(!panel.open)panel.showModal();
   note.textContent='';
   form.hidden=Boolean(session);
   document.querySelector('#accountActions').hidden=!session;
   history.replaceChildren();
 }
 async function request(url,options={}){
   const r=await fetch(url,options);
   const data=await r.json().catch(()=>({}));
   if(!r.ok){
     if(r.status===401 && url.startsWith('/api/'))saveSession(null);
     throw new Error(data.error_description||data.msg||(typeof data.error==='string'?data.error:'The service could not complete your request.'));
   }
   return data;
 }
 function authHeaders(){return {'Content-Type':'application/json',Authorization:'Bearer '+session.access_token};}
 function checkoutId(){
   const contents=JSON.stringify(basket.map(p=>p.name));
   const old=JSON.parse(sessionStorage.getItem('apex-attempt')||'null');
   if(old?.contents===contents && old?.user===session.user.id)return old.id;
   const id=crypto.randomUUID();
   sessionStorage.setItem('apex-attempt',JSON.stringify({contents,id,user:session.user.id}));return id;
 }
 async function pay(){
   if(processing)return;
   if(!basket.length){document.querySelector('.cart-note').textContent='Add a product first.';return;}
   buying=true;showPanel();
   if(!settings){note.textContent='Account services are unavailable. Please try again later.';return;}
   if(!session){note.textContent='Sign in or create an account to continue.';return;}
   if(!settings.live){note.textContent='The shop is not accepting payments yet.';return;}
   processing=true;checkout.disabled=true;note.textContent='Preparing your crypto invoice…';
   try{
     const {url}=await request('/api/checkout',{method:'POST',headers:authHeaders(),body:JSON.stringify({id:checkoutId(),products:basket.map(p=>p.name),expectedTotal:basket.reduce((sum,p)=>sum+Math.round(p.price*100),0)})});
     location.assign(url);
   }catch(e){note.textContent=e.message;form.hidden=Boolean(session);}
   finally{processing=false;checkout.disabled=false;}
 }
 async function showOrders(){
   buying=false;showPanel();
   if(!settings){note.textContent='Account services are unavailable. Please try again later.';return;}
   if(!session)return;
   try{
     const rows=await request('/api/orders',{headers:authHeaders()});
     const last=JSON.parse(sessionStorage.getItem('apex-attempt')||'null');
     if(last && rows.some(row=>row.id===last.id && ['failed','expired','paid','refunded'].includes(row.status)))sessionStorage.removeItem('apex-attempt');
     if(!rows.length)note.textContent='Your orders will appear here after checkout.';
     for(const row of rows){
       const section=document.createElement('article');
       const title=document.createElement('strong');title.textContent=row.items.map(x=>x.name).join(', ');
       const info=document.createElement('p');info.textContent=fmt(row.total_pence)+' · '+row.status.replaceAll('_',' ')+' · '+new Date(row.created_at).toLocaleDateString('en-GB');
       section.append(title,info);
       if(row.status==='awaiting_payment' && row.invoice_url){const a=document.createElement('a');a.href=row.invoice_url;a.textContent='Open invoice';section.append(a);}
       if(row.status==='paid'){
         const delivery=document.createElement('p');delivery.textContent=row.delivery_note||'Payment received. Your delivery details will appear here.';section.append(delivery);
       }
       history.append(section);
     }
   }catch(e){note.textContent=e.message;form.hidden=Boolean(session);}
 }
 form.addEventListener('submit',async event=>{
   event.preventDefault();
   if(!settings){note.textContent='Account services are unavailable.';return;}
   const signup=event.submitter?.value==='signup';
   const actions=[...form.querySelectorAll('button')];actions.forEach(b=>b.disabled=true);
   note.textContent=signup?'Creating account…':'Signing in…';
   try{
     const data=await request(settings.url+'/auth/v1/'+(signup?'signup':'token?grant_type=password'),{
       method:'POST',headers:{apikey:settings.key,'Content-Type':'application/json'},body:JSON.stringify({email:form.email.value.trim(),password:form.password.value})
     });
     form.password.value='';
     if(!data.access_token){note.textContent='Check your email to confirm your account, then sign in here.';return;}
     saveSession({access_token:data.access_token,user:{id:data.user.id}});
     if(buying)await pay();else await showOrders();
   }catch(e){note.textContent=e.message;}
   finally{actions.forEach(b=>b.disabled=false);}
 });
 document.querySelector('#logOut').onclick=async()=>{
   try{if(session)await fetch(settings.url+'/auth/v1/logout',{method:'POST',headers:{...authHeaders(),apikey:settings.key}});}finally{saveSession(null);sessionStorage.removeItem('apex-attempt');showPanel();}
 };
 account.onclick=showOrders;checkout.onclick=pay;
 document.querySelector('#closeAccount').onclick=()=>panel.close();
 try{saveSession(JSON.parse(sessionStorage.getItem(storageKey)||'null'));}catch{saveSession(null);}
 // Restore the basket across verification and the payment provider's redirect.
 try{basket=JSON.parse(sessionStorage.getItem('apex-basket')||'[]').map(name=>products.find(p=>p.name===name)).filter(Boolean);renderBasket();}catch{}
 new MutationObserver(()=>sessionStorage.setItem('apex-basket',JSON.stringify(basket.map(p=>p.name)))).observe(document.querySelector('#cartItems'),{childList:true});
 const hash=new URLSearchParams(location.hash.slice(1));
 if(hash.has('access_token')||hash.has('error_description'))window.history.replaceState({},'',location.pathname+location.search);
 request('/api/config').then(value=>{
   settings=value;
   for(const product of products){if(Number.isInteger(value.prices[product.name]))product.price=value.prices[product.name]/100;}
   render();renderBasket();
   document.querySelector('.cart-note').textContent=value.live?'Pay once in cryptocurrency. Coin, network and fees are shown on the invoice.':'Checkout opens when the shop starts accepting payments.';
 }).catch(()=>{document.querySelector('.cart-note').textContent='Checkout is currently unavailable.';}).finally(()=>{
   if(new URLSearchParams(location.search).has('orders')){
     sessionStorage.removeItem('apex-attempt');showOrders();
     window.history.replaceState({},'',location.pathname);
   }
 });
})();
