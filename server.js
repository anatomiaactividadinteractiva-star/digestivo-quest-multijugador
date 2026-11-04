'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {WebSocketServer}=require('ws');
const questions=require('./data/questions.json');
const PORT=Number(process.env.PORT||3000),root=path.join(__dirname,'public');
const rooms=new Map();
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');
 const p=u.pathname==='/'?'index.html':u.pathname.slice(1);
 const file=path.resolve(root,p);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
 fs.readFile(file,(err,buf)=>{if(err){res.writeHead(404).end('No encontrado');return}res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.png')?'image/png':'image/jpeg');res.setHeader('Cache-Control','no-store');res.end(buf)})
});
const wss=new WebSocketServer({server,maxPayload:12000});
const send=(ws,obj)=>{if(ws?.readyState===1)ws.send(JSON.stringify(obj))};
const id=()=>crypto.randomBytes(16).toString('hex');
const code=()=>{let c;do{c=String(crypto.randomInt(100000,999999))}while(rooms.has(c));return c};
function makeView(q){const ids=q.data.map(()=>crypto.randomBytes(5).toString('hex'));const shuffle=a=>a.sort(()=>Math.random()-.5);const x={title:q.title,prompt:q.prompt,type:q.type,imageUrl:q.imageUrl||null,slide:q.slide,c:q.c};if(q.type==='quiz')x.options=shuffle(q.data.map((v,i)=>({id:ids[i],text:v})));else if(q.type==='order')x.items=shuffle(q.data.map((v,i)=>({id:ids[i],text:v})));else{x.left=q.data.map((v,i)=>({id:ids[i],text:v[0]}));x.right=shuffle(q.data.map((v,i)=>({id:ids[i],text:v[1]})))}return {view:x,ids}}

function score(room){return [...room.players.values()].map(p=>({name:p.name,points:p.points,id:p.id})).sort((a,b)=>b.points-a.points)}
function state(room){return {type:'state',code:room.code,stage:room.stage,index:room.index,total:questions.length,question:room.view.view,players:score(room),current:room.current?room.players.get(room.current)?.name:null,excluded:[...room.excluded],deadline:room.deadline,remaining:room.remaining,seconds:room.duration,hostConnected:!!room.host?.readyState&&room.host.readyState===1}}
function broadcast(room){const s=state(room);send(room.host,s);for(const p of room.players.values())send(p.ws,s)}
function reveal(room,reason){room.stage='reveal';room.current=null;room.deadline=null;const q=questions[room.index];let answer=q.type==='quiz'?q.data[0]:q.type==='order'?q.data:q.data.map(x=>({left:x[0],right:x[1]}));const msg={type:'solution',answer,reason,explanation:q.tip||'Revisa la correspondencia anatómica indicada en la respuesta.'};send(room.host,msg);for(const p of room.players.values())send(p.ws,msg);broadcast(room)}
function next(room){if(room.index>=questions.length-1){room.stage='finished';broadcast(room);return}room.index++;room.view=makeView(questions[room.index]);room.stage='waiting';room.current=null;room.excluded.clear();room.attempts=0;broadcast(room)}
function validate(room,answer){const q=questions[room.index],ids=room.view.ids;if(q.type==='quiz')return answer===ids[0];if(q.type==='order')return Array.isArray(answer)&&answer.length===ids.length&&answer.every((x,i)=>x===ids[i]);if(q.type==='match'||q.type==='arrows')return Array.isArray(answer)&&answer.length===ids.length&&answer.every((x,i)=>x===ids[i]);return false}

function tick(){for(const r of rooms.values()){if(r.stage==='finished')continue;if(r.deadline&&Date.now()>=r.deadline){r.remaining=0;reveal(r,'Tiempo agotado');r.stage='finished';broadcast(r)}}}
setInterval(tick,400);
wss.on('connection',ws=>{
 ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return};if(!m||typeof m!=='object')return;
 if(m.type==='create'){const c=code();const r={code:c,view:makeView(questions[0]),host:ws,hostToken:id(),players:new Map(),stage:'waiting',index:0,current:null,excluded:new Set(),attempts:0,duration:Math.max(1,Math.min(240,Math.floor(Number(m.minutes)||45)))*60,remaining:null,deadline:null};rooms.set(c,r);ws.room=c;ws.role='host';send(ws,{type:'created',code:c,token:r.hostToken});broadcast(r);return}
 if(m.type==='hostReconnect'){const r=rooms.get(String(m.code||''));if(!r||m.token!==r.hostToken)return send(ws,{type:'error',message:'Credenciales de docente inválidas'});r.host=ws;ws.room=r.code;ws.role='host';broadcast(r);if(r.stage==='reveal')reveal(r,'Respuesta de la ronda');return}
 if(m.type==='join'){const r=rooms.get(String(m.code||''));if(!r)return send(ws,{type:'error',message:'Sala no encontrada'});const name=String(m.name||'').trim().slice(0,32);if(!name)return send(ws,{type:'error',message:'Introduce tu nombre'});if(r.stage==='finished')return send(ws,{type:'error',message:'La competencia ha terminado'});let p=[...r.players.values()].find(p=>p.token===m.token&&m.token);if(!p){if([...r.players.values()].some(p=>p.name.toLowerCase()===name.toLowerCase()))return send(ws,{type:'error',message:'Nombre en uso; elige otro'});p={id:id(),token:id(),name,points:0,ws};r.players.set(p.id,p)}p.ws=ws;ws.room=r.code;ws.role='player';ws.pid=p.id;send(ws,{type:'joined',id:p.id,token:p.token,code:r.code});broadcast(r);if(r.stage==='reveal')reveal(r,'Respuesta de la ronda');return}
 const r=rooms.get(ws.room);if(!r)return;const isHost=ws.role==='host'&&r.host===ws;const p=ws.role==='player'?r.players.get(ws.pid):null;
 if(m.type==='start'&&isHost&&r.stage==='waiting'){if(!r.deadline)r.deadline=Date.now()+(r.remaining??r.duration)*1000;r.stage='buzz';broadcast(r)}
 else if(m.type==='open'&&isHost&&r.stage==='waiting'){r.stage='buzz';broadcast(r)}
 else if(m.type==='buzz'&&p&&p.ws===ws&&r.stage==='buzz'&&!r.excluded.has(p.id)){r.current=p.id;r.stage='answering';send(ws,{type:'yourTurn'});broadcast(r)}
 else if(m.type==='answer'&&p&&p.ws===ws&&r.stage==='answering'&&r.current===p.id){const correct=validate(r,m.answer);r.attempts++;if(correct){const pts=r.attempts===1?10:7;p.points+=pts;send(ws,{type:'feedback',correct:true,points:pts});reveal(r,'Respuesta correcta')}else{r.excluded.add(p.id);send(ws,{type:'feedback',correct:false,points:0});r.current=null;if(r.excluded.size>=r.players.size)reveal(r,'Todos los participantes fallaron');else{r.stage='buzz';broadcast(r)}}}
 else if(m.type==='reveal'&&isHost&&['buzz','answering','waiting'].includes(r.stage))reveal(r,'Solución mostrada por el docente');
 else if(m.type==='next'&&isHost&&r.stage==='reveal')next(r);
 else if(m.type==='pause'&&isHost&&r.deadline){r.remaining=Math.max(0,Math.ceil((r.deadline-Date.now())/1000));r.deadline=null;broadcast(r)}
 else if(m.type==='resume'&&isHost&&!r.deadline&&r.remaining>0){r.deadline=Date.now()+r.remaining*1000;broadcast(r)}
 else if(m.type==='finish'&&isHost){reveal(r,'Competencia finalizada');r.stage='finished';broadcast(r)}
 });
 ws.on('close',()=>{const r=rooms.get(ws.room);if(!r)return;if(ws.role==='host'&&r.host===ws){r.host=null;broadcast(r)}if(ws.role==='player'){const p=r.players.get(ws.pid);if(p?.ws===ws){p.ws=null;if(r.current===p.id&&r.stage==='answering'){r.excluded.add(p.id);r.current=null;r.stage='buzz'}broadcast(r)}}});
});
server.listen(PORT,'0.0.0.0',()=>console.log('Digestivo Quest en puerto '+PORT));
