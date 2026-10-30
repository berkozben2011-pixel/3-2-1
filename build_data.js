// Wikidata'dan her takımın tüm zamanlar oyuncu listesini çeker -> players.json
const fs=require('fs'),teams=JSON.parse(fs.readFileSync('teams.json')),H={'User-Agent':'321-oyunu/1.0 (hobby)'},sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function qid(name){const u='https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&limit=8&search='+encodeURIComponent(name);
 const j=await (await fetch(u,{headers:H})).json();const c=j.search||[];return (c.find(x=>/football|soccer/i.test(x.description||''))||{}).id}
async function players(id){const q=`SELECT DISTINCT ?l WHERE{?p wdt:P54 wd:${id}. ?p rdfs:label ?l. FILTER(LANG(?l)="en")}`;
 const j=await (await fetch('https://query.wikidata.org/sparql?format=json&query='+encodeURIComponent(q),{headers:H})).json();return j.results.bindings.map(b=>b.l.value)}
(async()=>{const out={};for(const t of Object.values(teams).flat()){try{const id=await qid(t);if(!id){console.log('BULUNAMADI:',t);continue}
 out[t]=await players(id);console.log(t,id,out[t].length)}catch(e){console.log('HATA:',t,e.message)}await sleep(1500)}
 fs.writeFileSync('players.json',JSON.stringify(out));console.log('players.json hazır')})();
