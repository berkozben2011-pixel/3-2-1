const express=require('express'),http=require('http'),{Server}=require('socket.io'),fs=require('fs');
const app=express(),srv=http.createServer(app),io=new Server(srv);
app.use(express.static(__dirname+'/public'));
const teams=JSON.parse(fs.readFileSync(__dirname+'/teams.json'));
app.get('/teams',(q,r)=>r.json(teams));
let data={};try{data=JSON.parse(fs.readFileSync(__dirname+'/players.json'))}catch{console.log('UYARI: players.json yok. Önce: npm run veri')}
const norm=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/ø/g,'o').replace(/ß/g,'ss').replace(/đ/g,'d').replace(/ł/g,'l').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const idx={};for(const c in data)idx[c]=data[c].map(n=>({n,t:norm(n).split(' ')}));
const ALL=Object.values(teams).flat(),rnd=a=>a[Math.floor(Math.random()*a.length)];
const common=(a,b)=>{const sb=new Set((idx[b]||[]).map(p=>p.n));return(idx[a]||[]).filter(p=>sb.has(p.n))};
// tam isim veya soyisim (isim sonu) eşleşirse kabul
const check=(ans,list)=>{const a=norm(ans),t=a.split(' ');if(a.length<3)return null;return list.find(p=>t.length<=p.t.length&&t.every((x,i)=>x===p.t[p.t.length-t.length+i]))||null};
const rooms={};
function pub(r,i){const p=r.players;return{code:r.code,mode:r.mode,phase:r.phase,left:Math.max(0,r.dl-Date.now()),me:i,
 players:p.map(q=>({name:q.name,score:q.score,picked:!!q.team,answered:q.ans!==undefined})),
 teams:['answer','result','over'].includes(r.phase)?p.map(q=>q.team):null,res:r.res,winner:r.winner,round:r.round}}
const send=r=>r.players.forEach((q,i)=>io.to(q.id).emit('state',pub(r,i)));
function go(r,ph,ms,fn){r.phase=ph;r.dl=Date.now()+ms;clearTimeout(r.t);r.t=setTimeout(fn,ms);send(r)}
function newRound(r){r.players.forEach(q=>{q.team=null;q.ans=undefined});r.res=null;r.round++;
 go(r,'pick',10000,()=>{fill(r);startCount(r)})}
function fill(r){const av=ALL.filter(t=>idx[t]&&idx[t].length),pool=av.length>2?av:ALL;
 r.players.forEach(q=>{if(!q.team)q.team=rnd(pool.filter(t=>!r.players.some(o=>o.team===t)))})}
const startCount=r=>go(r,'count',3000,()=>go(r,'answer',20000,()=>resolve(r)));
function resolve(r){clearTimeout(r.t);const [t0,t1]=r.players.map(q=>q.team),list=common(t0,t1),hits=[];
 r.players.forEach(q=>{const h=q.ans?check(q.ans,list):null;q.hit=h&&!r.used.has(h.n)?h.n:null;if(q.hit){q.score++;hits.push(q.hit)}});
 hits.forEach(n=>r.used.add(n));
 r.res={answers:r.players.map(q=>({text:q.ans===undefined?'(süre doldu)':q.ans===''?'Pas':q.ans,ok:!!q.hit,name:q.hit})),
  sample:list.filter(p=>!r.used.has(p.n)).slice(0,3).map(p=>p.n),total:list.length};
 const [a,b]=r.players.map(q=>q.score);
 if(Math.max(a,b)>=r.mode&&a!==b){r.phase='over';r.winner=a>b?0:1;r.dl=0;send(r)}else go(r,'result',6000,()=>newRound(r))}
io.on('connection',s=>{
 const R=()=>rooms[s.data.code],I=r=>r.players.findIndex(q=>q.id===s.id);
 s.on('create',({name})=>{let c;do{c=Array.from({length:4},()=>'ABCDEFGHJKLMNPRSTUVYZ'[Math.floor(Math.random()*21)]).join('')}while(rooms[c]);
  rooms[c]={code:c,mode:3,phase:'lobby',players:[{id:s.id,name:String(name).slice(0,14),score:0}],used:new Set(),round:0,dl:0};s.data.code=c;send(rooms[c])});
 s.on('join',({code,name})=>{const r=rooms[code];if(!r||r.phase!=='lobby'||r.players.length>1)return s.emit('err','Oda bulunamadı veya dolu');
  r.players.push({id:s.id,name:String(name).slice(0,14),score:0});s.data.code=code;send(r)});
 s.on('mode',m=>{const r=R();if(r&&I(r)===0&&['lobby','over'].includes(r.phase)&&(m===3||m===5)){r.mode=m;send(r)}});
 s.on('start',()=>{const r=R();if(r&&I(r)===0&&r.players.length===2&&['lobby','over'].includes(r.phase)){
  r.players.forEach(q=>q.score=0);r.used.clear();r.round=0;newRound(r)}});
 s.on('pick',t=>{const r=R();if(!r||r.phase!=='pick'||!ALL.includes(t))return;const q=r.players[I(r)];if(q.team)return;
  if(r.players.some(o=>o.team===t))return s.emit('err','Rakip bu takımı seçti, başka seç');
  q.team=t;if(r.players.every(o=>o.team)){clearTimeout(r.t);startCount(r)}else send(r)});
 s.on('answer',({text})=>{const r=R();if(!r||r.phase!=='answer')return;const q=r.players[I(r)];if(q.ans!==undefined)return;
  q.ans=String(text||'').slice(0,40);if(r.players.every(o=>o.ans!==undefined))resolve(r);else send(r)});
 s.on('disconnect',()=>{const r=R();if(!r)return;clearTimeout(r.t);delete rooms[r.code];
  r.players.forEach(q=>q.id!==s.id&&io.to(q.id).emit('closed'))});
});
srv.listen(process.env.PORT||3000,()=>console.log('Oyun hazır: http://localhost:'+(process.env.PORT||3000)));
