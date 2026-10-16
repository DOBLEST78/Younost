/* PostgreSQL работает реально в PGlite. Supabase Auth/Storage здесь — протокольные заглушки,
   чтобы не создавать аккаунты и не тратить место в настоящем проекте пользователя. */
const {database}=require('./sql-base.cjs');const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),{spawn,execFileSync}=require('node:child_process');
async function main(){
 let count=await require('./sql-tests.cjs').run();const {db,rpc}=await database();
 const ok=(value,label)=>{assert(value,label);console.log('✓ '+label);count++;};
 const users=new Map(),tokens=new Map(),objects=new Map();let counter=0;
 const create=async(email,password,data)=>{const id=randomUUID();await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data)VALUES($1,$2,$3)',[id,email,JSON.stringify(data||{})]);const u={id,email,password,identities:[{id:randomUUID()}]};users.set(id,u);return u;};
 const session=u=>{const access_token='test-access-'+(++counter),refresh_token='test-refresh-'+counter;tokens.set(access_token,u.id);tokens.set(refresh_token,u.id);return{access_token,refresh_token,expires_in:3600,user:{id:u.id,email:u.email}};};
 const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
 const stub=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://local');const chunks=[];for await(const b of req)chunks.push(b);const raw=Buffer.concat(chunks);let body={};if(req.headers['content-type']?.includes('json')&&raw.length)body=JSON.parse(raw);
   const secret=req.headers.apikey==='sb_secret_test',pub=req.headers.apikey==='sb_publishable_test';
   if(!secret&&!pub)return send(res,401,{code:'bad_key'});
   if(req.headers.authorization==='Bearer sb_secret_test')throw Error('New secret key incorrectly used as JWT');
   if(url.pathname==='/rest/v1/rpc/yunost_api'){if(!secret)return send(res,403,{});try{return send(res,200,await rpc(body.p_action,body.p_actor,body.p_data));}catch(e){return send(res,e.code?.startsWith('PT')?+e.code.slice(2):500,{code:e.code,message:e.message});}}
   if(url.pathname==='/auth/v1/signup'){
    if([...users.values()].some(u=>u.email===body.email))return send(res,422,{code:'email_exists'});
    const u=await create(body.email,body.password,body.data);return send(res,200,{user:{id:u.id,email:u.email}});
   }
   if(url.pathname==='/auth/v1/token'){
    const u=url.searchParams.get('grant_type')==='refresh_token'?users.get(tokens.get(body.refresh_token)):[...users.values()].find(u=>u.email===body.email&&u.password===body.password);
    return u?send(res,200,session(u)):send(res,400,{code:'invalid_credentials'});
   }
   if(url.pathname==='/auth/v1/user'){
    const u=users.get(tokens.get(req.headers.authorization?.replace('Bearer ','')));return u?send(res,200,{id:u.id,email:u.email}):send(res,401,{code:'bad_jwt'});
   }
   if(url.pathname==='/auth/v1/logout')return send(res,200,{});
   if(url.pathname.startsWith('/auth/v1/admin/users/')){assert(secret);const id=url.pathname.split('/').pop();await db.query('DELETE FROM auth.users WHERE id=$1',[id]);users.delete(id);return send(res,200,{});}
   if(url.pathname.startsWith('/storage/v1/object/')){
    assert(secret);let object=url.pathname.replace('/storage/v1/object/','').replace('authenticated/','').replace('yunost-media/','');
    if(req.method==='POST'){objects.set(object,{data:raw,type:req.headers['content-type']});return send(res,200,{Key:object});}
    if(req.method==='DELETE'){for(const p of body.prefixes)objects.delete(p);return send(res,200,[]);}
    const obj=objects.get(object);if(!obj)return send(res,404,{});res.writeHead(200,{'Content-Type':obj.type});return res.end(obj.data);
   }
   send(res,404,{path:url.pathname});
  }catch(e){console.error('STUB',e.message);send(res,500,{message:e.message});}
 });
 await new Promise(resolve=>stub.listen(0,'127.0.0.1',resolve));
 const owner=await create('owner@example.test','Test-password-42',{});await rpc('owner_setup',null,{id:owner.id,email:owner.email,fullName:'Owner Test User'});
 const actor=await create('member@example.test','Test-password-42',{yunost_profile:{fullName:'Test Member Person',phone:'+79990000000',birthDate:'2000-01-01',about:'Test user',experience:''}});
 await rpc('review',owner.id,{id:actor.id,decision:'accepted'});await db.query('UPDATE yunost.profiles SET apples=1000 WHERE id=$1',[actor.id]);
 for(const dir of ['images','models'])for(const file of fs.readdirSync('src/Yunost.Web/SeedAssets/'+dir))if(file.endsWith('.webp')||file.endsWith('.glb'))objects.set((dir==='images'?'site/':'models/')+file,{data:fs.readFileSync('src/Yunost.Web/SeedAssets/'+dir+'/'+file),type:file.endsWith('.glb')?'model/gltf-binary':'image/webp'});
 const binary=process.env.DOTNET_BIN||'dotnet';
 const server=spawn(binary,['bin/Debug/net10.0/Yunost.Web.dll'],{cwd:path.resolve('src/Yunost.Web'),env:{...process.env,ASPNETCORE_ENVIRONMENT:'Development',ASPNETCORE_URLS:'http://127.0.0.1:5087',Supabase__Url:'http://127.0.0.1:'+stub.address().port,Supabase__PublishableKey:'sb_publishable_test',Supabase__SecretKey:'sb_secret_test',DataProtection__Path:path.resolve('verification/output/keys')}});
 let logs='';server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
 const base='http://127.0.0.1:5087';
 try{
  for(let i=0;i<120;i++){try{if((await fetch(base+'/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));if(i===119)throw Error(logs);}
  const client=()=>{let cookie='';return async(url,method='GET',body,headers={})=>{const r=await fetch(base+'/api/'+url,{method,headers:{'X-Yunost-Request':'1','Content-Type':'application/json',Cookie:cookie,...headers},body:body===undefined?undefined:JSON.stringify(body)});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return{status:r.status,data:await r.json(),cookie};};};
  const guest=client(),admin=client(),member=client();
  ok((await guest('shop/products')).status===401,'HTTP shop requires login');
  let a=await admin('auth/login','POST',{email:owner.email,password:owner.password});ok(a.status===200&&a.data.user.role==='owner','Owner login through ASP.NET');
  ok(a.cookie.includes('yunost.session=')&&!a.cookie.includes('test-access'),'Session cookie encrypted');
  ok((await admin('manage/members','GET',undefined,{'X-Yunost-Request':'1'})).data.items.length===2,'Admin members API');
  ok((await admin('manage/team/'+actor.id+'/role','PATCH',{role:'admin'},{Origin:'https://foreign.example'})).status===403,'Cross-origin writes rejected');
  ok((await guest('auth/login','POST',{email:owner.email,password:'wrong'})).data.detail==='Неверная почта или пароль.','Russian authentication error');
  await member('auth/login','POST',{email:actor.email,password:actor.password});
  ok((await member('shop/products')).data.items.length===6,'Authenticated catalogue loads');
  for(const id of ['panama','glasses','hoodie']){ok((await member('shop/'+id+'/purchase','POST',{})).status===200,'API purchase '+id);await member('me/wardrobe','PUT',{productId:id,equipped:true});}
  ok((await member('me')).data.user.equippedItems.length===3,'API retains combined wardrobe');
  const join={fullName:'New Test Member',email:'new@example.test',phone:'+79991112233',birthDate:'2000-01-01',about:'Hello',experience:'',password:'Test-password-42',confirmPassword:'Test-password-42'};
  ok((await guest('membership-applications','POST',{...join,birthDate:'1989-01-01'})).status===400,'Birthday lower bound enforced');
  const joined=await guest('membership-applications','POST',join);ok(joined.status===200&&joined.data.confirmationRequired===true&&!!joined.data.registrationTicket,'Registration creates application through Auth trigger');
  ok((await guest('membership-applications','POST',join)).status===409,'Duplicate email rejected');
  const uid=[...users.values()].find(u=>u.email===join.email).id;ok((await admin('manage/members/'+uid,'DELETE',{})).status===200,'Hard account deletion through API');
  ok((await guest('me')).data.user===null,'Deleted account loses active session');
  const reregistered=await guest('membership-applications','POST',join);ok(reregistered.status===200&&reregistered.data.confirmationRequired===true&&[...users.values()].find(u=>u.email===join.email).id!==uid,'Deleted person must register as new candidate');
  const model=await fetch(base+'/assets/models/hedgehog.glb');ok(model.ok&&Buffer.from(await model.arrayBuffer()).subarray(0,4).toString()==='glTF','GLB served from Storage proxy');
  if(process.env.TEST_BROWSER==='1'){
   const {chromium}=require('playwright');
   const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--no-zygote','--single-process','--enable-unsafe-swiftshader']});
   try{
    const page=await browser.newPage({viewport:{width:1440,height:1050},deviceScaleFactor:1});let errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base);await page.waitForFunction(()=>window.YunostAccount.ready);
    ok(await page.locator('a[href="#/shop"]').count()===0,'Guest navigation has no shop link');
    await page.goto(base+'/#/shop');await page.waitForTimeout(200);
    ok(await page.locator('#product-grid').count()===0,'Direct guest shop route is locked');
    await page.goto(base+'/#/login');await page.locator('[name=email]').fill(actor.email);await page.locator('[name=password]').fill(actor.password);await page.locator('#login-form button[type=submit]').click();
    await page.waitForSelector('.pet3d-ready',{timeout:30000});
    ok(await page.locator('.pet3d canvas').count()===1,'Live 3D hedgehog rendered after login');
    await page.screenshot({path:'verification/output/profile-desktop.png',fullPage:true});
    await page.goto(base+'/#/shop');await page.waitForSelector('[data-try="tie"]');await page.locator('[data-try="tie"]').click();await page.waitForSelector('dialog[open] .pet3d-ready');
    const chosen=await page.locator('dialog [data-items]').getAttribute('data-items');ok(JSON.parse(chosen).some(i=>i.modelKey==='glasses')&&JSON.parse(chosen).some(i=>i.modelKey==='tie')&&!JSON.parse(chosen).some(i=>i.modelKey==='hoodie'),'3D preview combines compatible purchases');
    await page.screenshot({path:'verification/output/fitting-desktop.png',fullPage:true});
    await page.locator('[data-action="close-dialog"]').click();await page.setViewportSize({width:390,height:844});await page.goto(base+'/#/wardrobe');await page.waitForSelector('.pet3d-ready');
    ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile wardrobe has no horizontal overflow');
    await page.screenshot({path:'verification/output/wardrobe-mobile.png',fullPage:true});
    await page.locator('.account-entry').click();await page.locator('[data-account-action=logout]').click();await page.waitForSelector('#login-form');
    await page.locator('[name=email]').fill(owner.email);await page.locator('[name=password]').fill(owner.password);await page.locator('#login-form button[type=submit]').click();await page.waitForSelector('.profile-manage');
    await page.goto(base+'/#/manage/products/new');await page.waitForSelector('#product-form');await page.locator('[name=modelKey]').selectOption('glasses');
    ok(await page.locator('[name=slot]').inputValue()==='eyes','Product form links 3D shape and slot');
    await page.goto(base+'/#/manage/new');await page.waitForSelector('#publication-form');
    ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile publication editor has no horizontal overflow');
    ok(errors.length===0,'No browser JavaScript errors');
   }finally{await browser.close();}
  }
  fs.mkdirSync('verification/output',{recursive:true});fs.writeFileSync('verification/output/result.json',JSON.stringify({passed:count,scope:'Actual PostgreSQL in PGlite + ASP.NET. Auth/Storage protocol stub. Cloud and Docker not run.'},null,2));
  console.log('TOTAL '+count+' checks passed');
 }catch(e){console.error(logs);throw e;}finally{server.kill();stub.close();await db.close();}
}
main().catch(e=>{console.error(e);process.exit(1)});
