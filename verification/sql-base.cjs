const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs');
async function database(){
 const db=new PGlite();
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid primary key, email text unique, raw_user_meta_data jsonb default '{}'); CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
 await db.exec(fs.readFileSync('supabase/001_yunost.sql','utf8'));
 const rpc=async(action,actor=null,data={})=>(await db.query('SELECT public.yunost_api($1,$2,$3) AS data',[action,actor,JSON.stringify(data)])).rows[0].data;
 return {db,rpc};
}
module.exports={database};
if(require.main===module) database().then(async({db,rpc})=>{console.log(await rpc('ready')); await db.close()}).catch(e=>{console.error(e);process.exit(1)});
