const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const {shellInvocation}=require('./shell.cjs');
function start(port=0){const token=crypto.randomBytes(32).toString('hex');const server=http.createServer(async(req,res)=>{
if(req.headers.host!==`127.0.0.1:${server.address().port}`){res.writeHead(403);res.end('Local access only');return;}
const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
if(req.method==='POST'){
if(req.headers['x-studio-token']!==token)return reply(403,{error:'Invalid local session'});
let raw='';try{for await(const chunk of req){raw+=chunk;if(raw.length>2e6)throw Error('Request exceeds 2 MB');}const data=JSON.parse(raw);let exe,args,spawnOptions={};
if(req.url==='/api/request'){
const u=new URL(data.url);if(!['http:','https:'].includes(u.protocol))throw Error('Use an HTTP or HTTPS URL');
if(!['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].includes(data.method))throw Error('Invalid method');
exe=process.platform==='win32'?'curl.exe':'curl';args=['--silent','--show-error','--include','--max-time','60','--proto','=http,https','--request',data.method];
if(data.method==='HEAD')args.push('--head');
for(const [k,v] of data.headers||[]){if(/[\r\n]/.test(k+v))throw Error('Header contains a line break');if(k)args.push('--header',`${k}: ${v}`);}
if(data.body!==undefined&&!['GET','HEAD'].includes(data.method))args.push('--data-raw',data.body);args.push('--url',u.href);
}else if(req.url==='/api/console'){
if(typeof data.command!=='string'||data.command.length>100000)throw Error('Invalid command');
// Deliberate local terminal: original command passes unchanged to the OS shell.
const invocation=shellInvocation(data.command);exe=invocation.file;args=invocation.args;spawnOptions=invocation.options;
}else return reply(404,{error:'Not found'});
const begun=Date.now(),child=spawn(exe,args,{windowsHide:true,cwd:process.cwd(),...spawnOptions}),out=[],err=[];let size=0,done=false;
const finish=(code,error)=>{if(done)return;done=true;clearTimeout(timer);reply(200,{code,stdout:Buffer.concat(out).toString(),stderr:Buffer.concat(err).toString(),error,ms:Date.now()-begun});};
const timer=setTimeout(()=>{child.kill();finish(null,'Stopped after 60 seconds');},60000);
for(const [stream,buf]of [[child.stdout,out],[child.stderr,err]])stream.on('data',c=>{size+=c.length;if(size>5e6){child.kill();finish(null,'Output exceeds 5 MB');}else buf.push(c);});
child.on('error',e=>finish(null,e.message));child.on('close',c=>finish(c));
}catch(e){reply(400,{error:e.message});}return;
}
if(req.url==='/api/session'){if(req.headers.origin)return reply(403,{error:'Forbidden'});return reply(200,{token,platform:process.platform});}
const routes={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};const file=routes[req.url];if(!file){res.writeHead(404);return res.end();}
res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'});res.end(fs.readFileSync(path.join(__dirname,'public',file)));
});return new Promise(resolve=>server.listen(port,'127.0.0.1',()=>resolve(server)));}
module.exports={start};if(require.main===module)start(Number(process.env.PORT)||3210).then(s=>console.log(`Curl Studio: http://127.0.0.1:${s.address().port} (Ctrl+C to stop)`));
