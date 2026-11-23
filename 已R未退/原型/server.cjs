const http=require('http'),fs=require('fs'),path=require('path');
const port=Number(process.env.PROTOTYPE_PORT||4178);
const server=http.createServer((req,res)=>{if(req.url==='/favicon.ico'){res.writeHead(204);return res.end();}const html=fs.readFileSync(path.join(__dirname,'dist','index.html'));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);});
server.listen(port,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+port));
