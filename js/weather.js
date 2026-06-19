/* ============================================================
   weather.js — FMI open-data forecast (WFS multipointcoverage)
   Docs: https://en.ilmatieteenlaitos.fi/open-data
   ============================================================ */
const Weather = (() => {
  let currentLoc = WEATHER_LOCATIONS[0].id;
  const cache = {}; // locId -> {updated, hours}

  function buildURL(lat, lon){
    const now = new Date();
    const start = new Date(Math.ceil(now.getTime()/3600000)*3600000); // next full hour
    const end = new Date(start.getTime() + FMI_FORECAST.hours*3600000);
    const q = new URLSearchParams({
      service:"WFS", version:"2.0.0", request:"getFeature",
      storedquery_id: FMI_FORECAST.storedquery,
      latlon: `${lat.toFixed(4)},${lon.toFixed(4)}`,
      parameters: FMI_FORECAST.params.join(","),
      starttime: start.toISOString().replace(/\.\d+Z$/,"Z"),
      endtime:   end.toISOString().replace(/\.\d+Z$/,"Z"),
      timestep:  String(FMI_FORECAST.timestepMin)
    });
    return `${FMI_FORECAST.base}?${q.toString()}`;
  }

  function parseMultipoint(xmlText){
    const doc = new DOMParser().parseFromString(xmlText, "text/xml");
    if(doc.getElementsByTagName("parsererror").length)
      throw new Error("XML-jäsennysvirhe");
    const exc = doc.getElementsByTagNameNS("*","ExceptionText")[0]
             || doc.getElementsByTagNameNS("*","ExceptionReport")[0];
    if(exc && doc.getElementsByTagNameNS("*","SimpleMultiPoint").length===0)
      throw new Error("FMI: "+(exc.textContent||"virhe").trim().slice(0,120));

    const posEl = doc.getElementsByTagNameNS("*","positions")[0];
    const valEl = doc.getElementsByTagNameNS("*","doubleOrNilReasonTupleList")[0];
    if(!posEl || !valEl) throw new Error("Ei ennustedataa");

    const posRows = posEl.textContent.trim().split(/\n+/).map(r=>r.trim().split(/\s+/));
    const valRows = valEl.textContent.trim().split(/\n+/).map(r=>r.trim().split(/\s+/));
    const P = FMI_FORECAST.params;
    const idx = {
      temp:P.indexOf("Temperature"), wind:P.indexOf("WindSpeedMS"),
      dir:P.indexOf("WindDirection"), rain:P.indexOf("Precipitation1h"),
      sym:P.indexOf("WeatherSymbol3"), hum:P.indexOf("Humidity")
    };
    const hours = [];
    for(let i=0;i<posRows.length && i<valRows.length;i++){
      const epoch = parseInt(posRows[i][posRows[i].length-1],10);
      const v = valRows[i].map(Number);
      const num = j => (j>=0 && isFinite(v[j])) ? v[j] : null;
      hours.push({
        t: epoch*1000,
        temp: num(idx.temp), wind: num(idx.wind), dir: num(idx.dir),
        rain: num(idx.rain), sym: num(idx.sym), hum: num(idx.hum)
      });
    }
    return hours.filter(h=>h.temp!=null);
  }

  async function fetchForecast(locId){
    const loc = WEATHER_LOCATIONS.find(l=>l.id===locId);
    const w = wp(loc.wp);
    if(!w) throw new Error("Sijaintia ei ladattu");
    const res = await fetch(buildURL(w.lat, w.lon), {cache:"no-store"});
    if(!res.ok) throw new Error("FMI-yhteys epäonnistui ("+res.status+")");
    const hours = parseMultipoint(await res.text());
    const out = {updated: Date.now(), hours};
    cache[locId] = out;
    try{ localStorage.setItem("wx_"+locId, JSON.stringify(out)); }catch(e){}
    return out;
  }
  function cached(locId){
    if(cache[locId]) return cache[locId];
    try{ const s=localStorage.getItem("wx_"+locId); if(s){cache[locId]=JSON.parse(s); return cache[locId];} }catch(e){}
    return null;
  }

  /* ---------- rendering ---------- */
  const fmtH = ms => new Date(ms).toLocaleTimeString("fi-FI",{hour:"2-digit",minute:"2-digit"});
  const dayKey = ms => { const d=new Date(ms); return d.getFullYear()+"-"+d.getMonth()+"-"+d.getDate(); };

  function compass(deg){
    const dirs=["P","PK","K","KK","E","EL","L","LP"];
    return dirs[Math.round(deg/45)%8];
  }
  function windArrow(deg){
    // wind blows FROM deg; arrow shows travel direction (deg+180)
    return `<span class="wind-arrow" style="transform:rotate(${(deg+180)%360}deg)">↑</span>`;
  }

  function renderNow(loc, data){
    const el = document.getElementById("weather-now");
    if(!data || !data.hours.length){ el.innerHTML = ""; return; }
    const now = Date.now();
    const h = data.hours.find(x=>x.t>=now-1800000) || data.hours[0];
    const [emoji,desc] = weatherSymbol(h.sym);
    el.innerHTML = `
      <div class="wn__row">
        <div class="wn__icon">${emoji}</div>
        <div>
          <div class="wn__temp">${Math.round(h.temp)}°</div>
          <div class="wn__desc">${desc} · ${loc.name}</div>
        </div>
      </div>
      <div class="wn__grid">
        <div class="wn__cell"><div class="k">Tuuli</div><div class="v">${h.wind!=null?Math.round(h.wind):"–"} m/s ${h.dir!=null?windArrow(h.dir):""}</div></div>
        <div class="wn__cell"><div class="k">Sade /h</div><div class="v">${h.rain!=null?h.rain.toFixed(1).replace(".",","):"0"} mm</div></div>
        <div class="wn__cell"><div class="k">Kosteus</div><div class="v">${h.hum!=null?Math.round(h.hum):"–"} %</div></div>
      </div>`;
  }

  function renderDays(data){
    const el = document.getElementById("weather-days");
    if(!data || !data.hours.length){ el.innerHTML=""; return; }
    const days = {};
    data.hours.forEach(h=>{ (days[dayKey(h.t)] = days[dayKey(h.t)]||[]).push(h); });
    const html = Object.values(days).slice(0,7).map(hrs=>{
      const d=new Date(hrs[0].t);
      const temps=hrs.map(h=>h.temp);
      const hi=Math.round(Math.max(...temps)), lo=Math.round(Math.min(...temps));
      const rain=hrs.reduce((s,h)=>s+(h.rain||0),0);
      // daytime hours 6..22 to keep it cycling-relevant
      const strip = hrs.filter(h=>{const hh=new Date(h.t).getHours(); return hh>=6&&hh<=22 && hh%2===0;});
      const cells = (strip.length?strip:hrs).map(h=>{
        const [em]=weatherSymbol(h.sym);
        return `<div class="whour">
          <div class="h">${new Date(h.t).getHours()}</div>
          <div class="i">${em}</div>
          <div class="t">${Math.round(h.temp)}°</div>
          <div class="w">${h.wind!=null?Math.round(h.wind):""}${h.dir!=null?" "+compass(h.dir):""}</div>
          <div class="p">${h.rain>=0.1?h.rain.toFixed(1).replace(".",",")+"mm":""}</div>
        </div>`;
      }).join("");
      const today = dayKey(Date.now())===dayKey(hrs[0].t);
      const name = today ? "Tänään" : WEEKDAYS_LONG[d.getDay()];
      return `<div class="wday">
        <div class="wday__h"><span>${name} ${d.getDate()}.${d.getMonth()+1}.</span>
          <span><span class="hi">${hi}°</span> / <span class="lo">${lo}°</span>
          ${rain>=0.5?`<span class="wday__rain"> · ☔ ${rain.toFixed(0)} mm</span>`:""}</span></div>
        <div class="wrow">${cells}</div>
      </div>`;
    }).join("");
    el.innerHTML = html;
  }

  async function render(locId){
    if(locId) currentLoc = locId;
    const loc = WEATHER_LOCATIONS.find(l=>l.id===currentLoc);
    const status = document.getElementById("weather-status");
    const cachedData = cached(currentLoc);
    if(cachedData){ renderNow(loc,cachedData); renderDays(cachedData); }
    status.textContent = "Päivitetään…";
    try{
      const data = await fetchForecast(currentLoc);
      renderNow(loc,data); renderDays(data);
      status.textContent = "Päivitetty "+fmtH(data.updated)+" · Lähde: Ilmatieteen laitos (avoin data)";
    }catch(err){
      if(cachedData){
        status.textContent = "⚠️ Ei verkkoa — näytetään tallennettu ennuste ("+fmtH(cachedData.updated)+")";
      }else{
        document.getElementById("weather-now").innerHTML =
          `<div class="wn__row"><div class="wn__icon">📡</div><div><div class="wn__desc">Ennustetta ei saatu: ${err.message}.<br>Yritä uudelleen verkossa.</div></div></div>`;
        document.getElementById("weather-days").innerHTML="";
        status.textContent="";
      }
    }
  }

  function buildPills(){
    const box=document.getElementById("weather-loc-pills");
    box.innerHTML = WEATHER_LOCATIONS.map(l=>
      `<button class="pill ${l.id===currentLoc?"is-active":""}" data-loc="${l.id}">${l.name}</button>`).join("");
    box.querySelectorAll(".pill").forEach(b=>b.onclick=()=>{
      box.querySelectorAll(".pill").forEach(x=>x.classList.remove("is-active"));
      b.classList.add("is-active"); render(b.dataset.loc);
    });
  }

  return { render, buildPills, get currentLoc(){return currentLoc;} };
})();
