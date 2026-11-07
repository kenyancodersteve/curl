// Match Node's own cmd.exe shell invocation: preserve the original command,
// wrap once for /s /c, and disable argv escaping for this shell invocation only.
function shellInvocation(command,platform=process.platform,env=process.env){
 if(platform==='win32')return{file:env.ComSpec||env.comspec||'cmd.exe',args:['/d','/s','/c',`"${command}"`],options:{windowsVerbatimArguments:true}};
 return{file:'/bin/bash',args:['-lc',command],options:{}};
}
module.exports={shellInvocation};
