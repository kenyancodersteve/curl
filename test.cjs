const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');const{start}=require('./server.cjs');
test('local session, curl body/headers, HTTP errors and unedited shell execution',async()=>{const target=http.createServer(async(req,res)=>{let b='';for await(const c of req)b+=c;res.writeHead(req.url==='/fail'?422:200,{'Content-Type':'application/json'});res.end(JSON.stringify({method:req.method,body:b,header:req.headers['x-test']}))});await new Promise(r=>target.listen(0,'127.0.0.1',r));const server=await start();try{const base=`http://127.0.0.1:${server.address().port}`,url=`http://127.0.0.1:${target.address().port}`;const{token}=await(await fetch(base+'/api/session')).json();const post=async(route,data,t=token)=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':t},body:JSON.stringify(data)});assert.equal((await post('/api/request',{},'bad')).status,403);const payload={nested:{array:[1,true,null]},text:'a "quote" and apostrophe\''};let r=await(await post('/api/request',{method:'POST',url,headers:[['X-Test','working']],body:JSON.stringify(payload)})).json();assert.equal(r.code,0);assert.match(r.stdout,/working/);assert.match(r.stdout,/nested/);r=await(await post('/api/request',{method:'GET',url:url+'/fail'})).json();assert.match(r.stdout,/422/);r=await(await post('/api/console',{command:process.platform==='win32'?'echo HELLO| findstr HELLO':'printf "hello" | tr a-z A-Z'})).json();assert.equal(r.stdout.trim(),'HELLO');assert.equal((await post('/api/request',{method:'GET',url:'file:///etc/passwd'})).status,400);assert.equal((await fetch(base+'/api/session',{headers:{Origin:'https://other.example'}})).status,403)}finally{server.close();target.close()}});

const{shellInvocation}=require('./shell.cjs');
test('Windows CMD transport preserves original quoting and disables Node argv escaping',()=>{
 const samples=[
  'curl.exe -X GET "http://localhost:3000/api/status" -H "Content-Type: application/json"',
  'curl.exe -X GET "http://localhost:3000/" -H "Content-Type: application/json"',
  String.raw`curl.exe -i -X POST "http://10.110.240.239:8088/items/selectItems" -H "Content-Type: application/json" -d "{\"tin\":\"P051137950D\",\"bhfId\":\"00\",\"lastReqDt\":\"20200101000000\"}"`,
  '"C:\\Program Files\\curl\\curl.exe" "http://localhost:3000/"',
  'echo hello | findstr hello'
 ];
 for(const cmd of samples){const r=shellInvocation(cmd,'win32',{ComSpec:'C:\\Windows\\System32\\cmd.exe'});assert.equal(r.file,'C:\\Windows\\System32\\cmd.exe');assert.deepEqual(r.args,['/d','/s','/c','"'+cmd+'"']);assert.equal(r.options.windowsVerbatimArguments,true)}
 const bash=shellInvocation(samples[0],'linux');assert.equal(bash.args[1],samples[0]);assert.deepEqual(bash.options,{});
});

test('console curl GET header and nested JSON POST survive the native shell',async()=>{
 const target=http.createServer(async(req,res)=>{let raw='';for await(const c of req)raw+=c;res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({contentType:req.headers['content-type'],method:req.method,body:raw?JSON.parse(raw):null}))});
 await new Promise(r=>target.listen(0,'127.0.0.1',r));const server=await start();
 try{const base=`http://127.0.0.1:${server.address().port}`,url=`http://127.0.0.1:${target.address().port}`,{token}=await(await fetch(base+'/api/session')).json();
 const run=async(command)=>{const r=await(await fetch(base+'/api/console',{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':token},body:JSON.stringify({command})})).json();assert.equal(r.code,0,r.stderr||r.error);return JSON.parse(r.stdout)};
 const curl=process.platform==='win32'?'curl.exe':'curl';
 const get=await run(`${curl} -sS -X GET "${url}/api/status" -H "Content-Type: application/json"`);assert.equal(get.contentType,'application/json');assert.equal(get.method,'GET');
 const payload={tin:'P051137950D',bhfId:'00',lastReqDt:'20200101000000',nested:{items:[{description:'Parking fee',quantity:1}]}};
 const json=JSON.stringify(payload),quoted=process.platform==='win32'?'"'+json.replace(/"/g,'\\"')+'"':"'"+json+"'";
 const post=await run(`${curl} -sS -X POST "${url}/items/selectItems" -H "Content-Type: application/json" -d ${quoted}`);assert.equal(post.contentType,'application/json');assert.equal(post.method,'POST');assert.deepEqual(post.body,payload);
 }finally{server.close();target.close()}
});
