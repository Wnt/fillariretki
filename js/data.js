/* ============================================================
   data.js — loads route.json + ferries.json, exposes helpers
   ============================================================ */
const DATA = { route:null, ferries:null, ferriesById:{} };

async function loadData(){
  const [route, ferries] = await Promise.all([
    fetch("data/route.json",   {cache:"no-cache"}).then(r=>r.json()),
    fetch("data/ferries.json", {cache:"no-cache"}).then(r=>r.json())
  ]);
  DATA.route = route;
  DATA.ferries = Array.isArray(ferries) ? ferries : (ferries.ferries || []);
  DATA.ferriesById = {};
  DATA.ferries.forEach(f => DATA.ferriesById[f.id] = f);
  return DATA;
}

/* waypoint by id -> {name,lat,lon} */
function wp(id){ return DATA.route && DATA.route.waypoints ? DATA.route.waypoints[id] : null; }
function latlng(id){ const w = wp(id); return w ? [w.lat, w.lon] : null; }
function ferry(id){ return DATA.ferriesById[id] || null; }

/* cycled segment between two waypoints (order-independent) */
function cycleSeg(from,to){
  const segs = (DATA.route && DATA.route.cycle_segments) || [];
  return segs.find(s => (s.from===from && s.to===to) || (s.from===to && s.to===from)) || null;
}
function cycleKm(from,to){
  const s = cycleSeg(from,to);
  if(!s) return null;
  return (typeof s.osrm_km === "number") ? s.osrm_km : null;
}
/* geometry for a cycle edge, oriented from->to */
function cycleGeom(from,to){
  const s = cycleSeg(from,to);
  if(!s || !s.geometry || !s.geometry.length) return latlng(from) && latlng(to) ? [latlng(from),latlng(to)] : [];
  // BRouter/OSRM geometry stored as [lat,lon]; orient to match 'from'
  const g = s.geometry;
  const start = latlng(from);
  if(!start) return g;
  const dStart = dist2(g[0], start), dEnd = dist2(g[g.length-1], start);
  return dEnd < dStart ? g.slice().reverse() : g;
}

/* straight-line (great-circle) km — used for ferry crossings */
function haversine(a,b){
  const R=6371, toR=Math.PI/180;
  const dLat=(b[0]-a[0])*toR, dLon=(b[1]-a[1])*toR;
  const la1=a[0]*toR, la2=b[0]*toR;
  const h=Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
}
function dist2(a,b){ const dx=a[0]-b[0], dy=a[1]-b[1]; return dx*dx+dy*dy; }

/* length of a polyline (km) */
function polylineKm(geom){ let s=0; for(let i=1;i<geom.length;i++) s+=haversine(geom[i-1],geom[i]); return s; }
/* index of polyline vertex nearest to point pt */
function nearestIdx(geom,pt){ let bi=0,bd=Infinity; for(let i=0;i<geom.length;i++){const d=dist2(geom[i],pt); if(d<bd){bd=d;bi=i;}} return bi; }
/* km of the part of segment (segFrom→segTo) lying between waypoints aId and bId */
function subLegKm(segFrom,segTo,aId,bId){
  const geom=cycleGeom(segFrom,segTo); if(geom.length<2) return null;
  const a=latlng(aId), b=latlng(bId); if(!a||!b) return null;
  const ia=nearestIdx(geom,a), ib=nearestIdx(geom,b);
  const lo=Math.min(ia,ib), hi=Math.max(ia,ib);
  return polylineKm(geom.slice(lo,hi+1));
}

function totalCycleKm(){
  return SEQUENCE.filter(s=>s.edge==="cycle")
    .reduce((sum,s)=>sum + (cycleKm(s.from,s.to)||0), 0);
}
/* minutes to ride km at given speed */
function rideMinutes(km, kmh){ return Math.round((km/(kmh||TRIP.speedKmh))*60); }
/* ride time incl. at least one break per full riding hour */
function rideMinutesWithBreaks(km, kmh){
  const r = rideMinutes(km, kmh);
  return r + Math.floor(r/60) * (TRIP.breakMin||15);
}
function fmtKm(km){ return km==null ? "?" : km.toFixed(km<10?1:0).replace(".",",")+" km"; }
function fmtDur(min){
  if(min==null) return "";
  const h=Math.floor(min/60), m=min%60;
  return h? (m? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

/* ---- ferry "next departures" relative to a given Date ---- */
const DAYKEY = ["su","ma","ti","ke","to","pe","la"];
/* return the schedule entry for a ferry that matches a weekday, preferring CCW direction */
function schedulesForDay(f, date){
  const dk = DAYKEY[date.getDay()];
  const out = [];
  (f.schedules||[]).forEach(s=>{
    const days = (s.days||"").toLowerCase();
    if(matchDay(days, dk)) out.push(s);
  });
  return out;
}
function matchDay(daysStr, dk){
  if(!daysStr) return true;
  // accept formats like "ma-la", "ma,ke,pe", "su", "päivittäin", "ma–pe"
  const s = daysStr.replace(/–/g,"-");
  if(/päiv|joka|daily/.test(s)) return true;
  // explicit list
  const order=["ma","ti","ke","to","pe","la","su"];
  const tokens = s.split(/[ ,]+/).filter(Boolean);
  for(const t of tokens){
    if(t.includes("-")){
      const [a,b]=t.split("-");
      const ia=order.indexOf(a), ib=order.indexOf(b), id=order.indexOf(dk);
      if(ia>=0&&ib>=0&&id>=0 && id>=ia && id<=ib) return true;
    } else if(t===dk) return true;
  }
  return false;
}
