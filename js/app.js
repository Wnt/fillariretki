/* ============================================================
   app.js — orchestration: nav, ferries view, info view, offline
   ============================================================ */
const App = (() => {
  let selectedDay = new Date(); // for ferry schedules
  let weatherInited = false;

  /* ---------- Finnish weekday matching ---------- */
  const FI_DAYS = {sunnuntai:0,maanantai:1,tiistai:2,keskiviikko:3,torstai:4,perjantai:5,lauantai:6,
                   su:0,ma:1,ti:2,ke:3,to:4,pe:5,la:6};
  const WEEKORDER = [1,2,3,4,5,6,0];
  function daySetFromString(str){
    const set=new Set();
    if(!str) return null; // null => every day
    let s=str.toLowerCase().replace(/–/g,"-").replace(/[()]/g,"");
    if(/päivit|joka päiv|daily/.test(s)){ WEEKORDER.forEach(d=>set.add(d)); return set; }
    s.split(/[,;]+/).forEach(part=>{
      part=part.trim().replace(/\bpyhät\b/,"sunnuntai").replace(/\bpyhä\b/,"sunnuntai");
      const tokens=part.split(/\s+/).filter(Boolean);
      tokens.forEach(tok=>{
        if(tok.includes("-")){
          const [a,b]=tok.split("-").map(x=>FI_DAYS[x]);
          if(a!=null&&b!=null){
            const ia=WEEKORDER.indexOf(a), ib=WEEKORDER.indexOf(b);
            if(ia>=0&&ib>=0) for(let i=ia;i<=ib;i++) set.add(WEEKORDER[i]);
          }
        } else if(FI_DAYS[tok]!=null) set.add(FI_DAYS[tok]);
      });
    });
    return set.size?set:null;
  }
  function schedMatchesDay(sched, date){
    const set=daySetFromString(sched.days);
    return set===null ? true : set.has(date.getDay());
  }

  /* does a ferry run on `date` in the travelled direction?
     Direction match ignores parentheticals/whitespace so e.g.
     "Kannvik→Heponiemi" matches "Kannvik (Iniö)→Heponiemi (Kustavi)". */
  const normDir = s => (s||"").replace(/\([^)]*\)/g,"").replace(/\s+/g,"").toLowerCase();
  function ferryRunsOnDate(id, date, dirHint){
    const f=ferry(id); if(!f) return {ok:false, rows:[], f:null};
    if(!f.schedules || !f.schedules.length) return {ok:true, rows:[], f}; // lossit etc.
    const hint = dirHint ? normDir(dirHint) : null;
    const rows=f.schedules.filter(s=>
      (!hint || normDir(s.direction).includes(hint)) && schedMatchesDay(s,date));
    return {ok:rows.length>0, rows, f};
  }
  const parseDate = s => { const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); };

  /* ---------- navigation ---------- */
  function go(view){
    document.querySelectorAll(".view").forEach(v=>{
      const on = v.id==="view-"+view;
      v.classList.toggle("is-active",on); v.hidden=!on;
    });
    document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("is-active",t.dataset.view===view));
    if(view==="map" && MapView.map){ setTimeout(()=>MapView.map.invalidateSize(),60); }
    if(view==="weather" && !weatherInited){ weatherInited=true; Weather.buildPills(); Weather.render(); }
  }

  /* ---------- ferries view ---------- */
  function buildDayPills(){
    const box=document.getElementById("ferry-day-pills");
    const today=new Date(); today.setHours(0,0,0,0);
    let html="";
    for(let i=0;i<7;i++){
      const d=new Date(today.getTime()+i*86400000);
      const label = i===0?"Tänään" : i===1?"Huom." : WEEKDAYS_LONG[d.getDay()].slice(0,2);
      html+=`<button class="pill ${i===0?'is-active':''}" data-i="${i}">${label} ${d.getDate()}.${d.getMonth()+1}.</button>`;
    }
    box.innerHTML=html;
    box.querySelectorAll(".pill").forEach(b=>b.onclick=()=>{
      box.querySelectorAll(".pill").forEach(x=>x.classList.remove("is-active"));
      b.classList.add("is-active");
      selectedDay=new Date(today.getTime()+parseInt(b.dataset.i,10)*86400000);
      renderFerries();
    });
  }

  function nextDepartureFlag(times){
    // returns index of next upcoming time today, or -1
    const sameDay = selectedDay.toDateString()===new Date().toDateString();
    if(!sameDay) return -1;
    const now=new Date(); const cur=now.getHours()*60+now.getMinutes();
    for(let i=0;i<times.length;i++){
      const [h,m]=times[i].split(":").map(Number);
      if(h*60+m>=cur) return i;
    }
    return -1;
  }

  function chips(times){
    const nx=nextDepartureFlag(times);
    return times.map((t,i)=>`<span class="t ${i===nx?'next':''}">${t}</span>`).join("");
  }

  function ferryCard(f){
    const isLossi = f.type==="lossi";
    const kind = isLossi?"kind-lossi":"kind-ferry";
    const todays = (f.schedules||[]).filter(s=>schedMatchesDay(s,selectedDay));
    const phoneClean=(f.phone||"").replace(/[^+\d]/g,"");

    let schedHTML;
    if(!f.schedules || !f.schedules.length){
      schedHTML=`<p class="note">Liikennöi tiheästi aikataulun mukaan – katso virallinen aikataulu.</p>`;
    } else if(!todays.length){
      schedHTML=`<p class="note">🚫 Ei vuoroja valittuna päivänä (${WEEKDAYS_LONG[selectedDay.getDay()].toLowerCase()}).</p>`;
    } else {
      schedHTML = todays.map(s=>`
        <div style="margin-top:8px">
          <div class="small" style="font-weight:600">${s.direction||""} ${s.valid?`<span class="muted">· ${s.valid}</span>`:""}</div>
          <div class="times">${chips(s.departures||[])}</div>
          ${s.note?`<div class="note">${s.note}</div>`:""}
        </div>`).join("");
    }

    const allSched = (f.schedules&&f.schedules.length)? `
      <details class="sched"><summary>Kaikki aikataulut &amp; ehdot</summary>
        <table><tbody>
        ${f.schedules.map(s=>`<tr>
          <th>${s.days||""}<div class="muted small">${s.direction||""}</div></th>
          <td class="times">${(s.departures||[]).map(t=>`<span class="t">${t}</span>`).join("")||"—"}
            ${s.note?`<div class="note">${s.note}</div>`:""}</td></tr>`).join("")}
        </tbody></table>
        ${f.source?`<div class="note">Lähde: ${f.source}</div>`:""}
      </details>` : "";

    return `<div class="card ${kind}">
      <div class="card__top">
        <div><div class="card__name">${isLossi?"≈ ":"⛴ "}${f.name}</div>
          <div class="card__leg">${f.leg}</div></div>
      </div>
      <div class="card__badges">
        ${f.booking_required?'<span class="badge req">Varaus pakollinen</span>'
          :'<span class="badge free">Ei varausta</span>'}
        ${f.operator?`<span class="badge">${f.operator}</span>`:""}
        ${f.price_note?`<span class="badge">${f.price_note}</span>`:""}
        ${f.crossing_min?`<span class="badge">~${f.crossing_min} min</span>`:""}
      </div>
      ${f.booking_note?`<div class="note">${f.booking_note}</div>`:""}
      <div class="btn-row">
        ${f.booking_url?`<a class="btn primary" href="${f.booking_url}" target="_blank" rel="noopener">Varaa paikka</a>`:""}
        ${phoneClean?`<a class="btn" href="tel:${phoneClean}">📞 ${f.phone}</a>`:""}
        ${f.timetable_url?`<a class="btn" href="${f.timetable_url}" target="_blank" rel="noopener">Virallinen aikataulu</a>`:""}
      </div>
      ${schedHTML}
      ${f.info?`<details class="sched"><summary>Lisätietoa &amp; varustiedot</summary><p class="note" style="margin-top:8px">${f.info}</p></details>`:""}
      ${allSched}
    </div>`;
  }

  function renderFerries(){
    const order=["adan","finno","replot","sterna","vartsala","skagen","mossala_bjorko","kivimo_roslax"];
    const list=order.map(id=>DATA.ferriesById[id]).filter(Boolean);
    document.getElementById("ferries-list").innerHTML = list.map(ferryCard).join("");
  }

  /* ---------- route bottom sheet ---------- */
  function renderItinerary(){
    let html="";
    const stayByWp={}; STAYS.forEach(s=>stayByWp[s.wp]=s);
    SEQUENCE.forEach((item,i)=>{
      const last=i===SEQUENCE.length-1;
      if(item.wp){
        const w=wp(item.wp);
        const stay=stayByWp[item.wp];
        const cls = (item.role==="start"||item.role==="end")?"is-flag":"";
        const ico = (item.role==="start"||item.role==="end")?"🏁":"⛴";
        html+=`<div class="step">
          <div class="step__rail"><div class="step__dot ${cls}">${ico}</div>${last?"":'<div class="step__line"></div>'}</div>
          <div class="step__body"><div class="step__name">${item.label||(w&&w.name)||item.wp}
            ${stay?`<span class="tag" style="background:var(--good);color:#fff">🛏 Yö ${stay.night}</span>`:""}</div>
          </div></div>`;
      } else if(item.edge==="cycle"){
        const km=cycleKm(item.from,item.to);
        html+=`<div class="step">
          <div class="step__rail"><div class="step__line"></div></div>
          <div class="step__body"><div class="step__meta">🚲 <b>${fmtKm(km)}</b> · ${fmtDur(rideMinutes(km||0))} · ${item.island}</div></div>
        </div>`;
      } else if(item.edge==="ferry"){
        const f=ferry(item.ferry);
        html+=`<div class="step">
          <div class="step__rail"><div class="step__line is-ferry"></div></div>
          <div class="step__body"><div class="step__meta">⛴ <b>${f?f.name:item.ferry}</b>
            ${f&&f.booking_required?'<span class="tag book">varaa</span>':''}
            ${f&&f.crossing_min?` · ~${f.crossing_min} min`:""}</div></div>
        </div>`;
      }
    });
    document.getElementById("sheet-body").innerHTML=html;
    const tc=totalCycleKm();
    document.getElementById("sheet-total").textContent =
      `${fmtKm(tc)} pyörällä · ${fmtDur(rideMinutes(tc))}`;
  }
  function wireSheet(){
    const sheet=document.getElementById("route-sheet");
    document.getElementById("sheet-handle").onclick=()=>{
      const open=sheet.classList.toggle("is-open");
      document.getElementById("sheet-handle").setAttribute("aria-expanded",open);
    };
  }

  /* ---------- trip plan with ferry-day conflict check ---------- */
  function tripPlanCard(){
    let conflicts=[];
    const planLegKm = leg => Array.isArray(leg)
      ? (cycleKm(leg[0],leg[1])||0)
      : (subLegKm(leg.seg[0],leg.seg[1],leg.from,leg.to)||0);
    const daysHTML = PLAN.days.map(day=>{
      const d=parseDate(day.date);
      const wdName=WEEKDAYS_LONG[d.getDay()];
      const km=day.cycles.reduce((s,c)=>s+planLegKm(c),0);
      const ferriesHTML=day.ferries.map(fr=>{
        const res=ferryRunsOnDate(fr.id,d,fr.dir);
        const f=res.f||ferry(fr.id);
        const times=res.rows.flatMap(r=>r.departures||[]);
        if(!res.ok) conflicts.push({day,fr,f});
        return `<div class="pp-row" style="margin:4px 0">
          ${res.ok?"✅":"🚫"} <b>${f?f.name:fr.id}</b>
          <span class="muted">(${fr.dir})</span>
          ${res.ok?(times.length?`· ${times.join(", ")}`:""):`<span style="color:var(--warn)"> — ei vuoroa ${wdName.toLowerCase()}na</span>`}
        </div>`;
      }).join("");
      const stay=STAYS.find(s=>s.id===day.endStayId);
      return `<div style="padding:10px 0;border-top:1px solid var(--line)">
        <div style="font-weight:700">Päivä ${day.n} · ${wdName} ${d.getDate()}.${d.getMonth()+1}.</div>
        <div class="muted small" style="margin:1px 0 6px">${day.title} · 🚲 ${fmtKm(km)} · ${fmtDur(rideMinutesWithBreaks(km))} ajossa <span title="sis. 15 min tauon / ajotunti">(sis. tauot)</span></div>
        ${ferriesHTML}
        ${day.recommend?`<div class="note" style="margin-top:6px">💡 ${day.recommend}</div>`:""}
        ${stay?`<div class="pp-row" style="margin-top:4px">🛏 Yöpyminen: <b>${stay.name}</b></div>`:""}
      </div>`;
    }).join("");

    const warn = conflicts.length ? `
      <div style="background:#fdece2;color:#8f3415;border-radius:10px;padding:10px 12px;margin-bottom:8px;font-size:.9rem">
        <b>⚠️ Aikatauluristiriita!</b> ${conflicts.map(c=>`${c.f?c.f.name:c.fr.id} ei liikennöi ${WEEKDAYS_LONG[parseDate(c.day.date).getDay()].toLowerCase()}na (päivä ${c.day.n}).`).join(" ")}
        Siirrä kyseistä ajopäivää (Brändö–Houtskari-yhteys kulkee ma/ke/to/pe/su) tai käännä kierron suunta.
      </div>` : `
      <div style="background:#e3f4ea;color:#1f7a45;border-radius:10px;padding:10px 12px;margin-bottom:8px;font-size:.9rem">
        <b>✅ Kaikki lautat liikennöivät suunnitelman päivinä.</b> Aja Turusta <b>ke 24.6.</b> (sateinen – pelkkää ajoa, yö Peterzénsillä). Brändön päivä <b>to 25.6.</b> on kuiva; sateinen keskiviikko jää pyöräilyn ulkopuolelle.
      </div>`;

    return `<div class="info-card">
      <h2>🗓️ Reissusuunnitelma</h2>
      ${warn}
      ${daysHTML}
      <p class="note">Lautta-ajat tarkistetaan automaattisesti suunnitelman päiville. Varmista ja varaa vuorot virallisista lähteistä (Lautat-välilehti).</p>
    </div>`;
  }

  /* ---------- info view ---------- */
  function renderInfo(){
    const tc=totalCycleKm();
    const stays = STAYS.map(s=>{
      const w=wp(s.wp);
      return `<div class="stay">
        <div class="stay__n">${s.night}</div>
        <div>
          <div style="font-weight:700">${s.name}</div>
          <div class="muted small">${s.area}${s.addr?` · ${s.addr}`:""}</div>
          <div class="muted small">${s.note}</div>
          <div class="btn-row">
            <a class="btn primary" href="tel:${s.phone}">📞 ${s.phoneLabel||s.phone}</a>
            ${s.url?`<a class="btn" href="${s.url}" target="_blank" rel="noopener">Nettisivu</a>`:""}
            ${s.email?`<a class="btn" href="mailto:${s.email}">✉️</a>`:""}
            ${w?`<a class="btn" href="https://www.google.com/maps/dir/?api=1&destination=${w.lat},${w.lon}" target="_blank" rel="noopener">Kartta</a>`:""}
          </div>
        </div></div>`;
    }).join("");

    const officialKm=Object.entries(TRIP.officialIslandKm)
      .map(([k,v])=>`<li>${k}: <b>${String(v).replace(".",",")} km</b></li>`).join("");

    document.getElementById("info-body").innerHTML=`
      <div class="info-card">
        <h2>🚲 ${TRIP.title}</h2>
        <p class="muted" style="margin:.2rem 0 .8rem">${TRIP.subtitle} · kierto <b>${TRIP.direction.toLowerCase()}</b> · ${TRIP.vehicle.toLowerCase()} (~${TRIP.speedKmh} km/h)</p>
        <div class="stat-grid">
          <div class="stat"><div class="v">${fmtKm(tc).replace(" km","")}</div><div class="k">km pyörällä</div></div>
          <div class="stat"><div class="v">${fmtDur(rideMinutes(tc)).replace(" ","")}</div><div class="k">ajoaika @${TRIP.speedKmh}</div></div>
          <div class="stat"><div class="v">4+4</div><div class="k">lauttaa</div></div>
        </div>
        <p class="note">Koko kierros n. ${TRIP.totalLoopKm} km (merellä ~${TRIP.seaKm} km). Kausi ${TRIP.season}. Ajoaika ei sisällä lautta-aikoja eikä taukoja.</p>
      </div>

      ${tripPlanCard()}

      <div class="info-card">
        <h2>🛏 Majoitus (2 yötä)</h2>
        ${stays}
      </div>

      <div class="info-card">
        <h2>⚠️ Tärkeää – varaa nämä etukäteen</h2>
        <ul class="tips" style="margin:.2rem 0 0;padding-left:1.1rem">
          <li><b>Ådan</b> (Vuosnainen→Åva, Ålandstrafiken): varaus <b>pakollinen</b> osoitteessa alandstrafiken.ax.</li>
          <li><b>Finnö / Rosala 2</b> (Torsholma→Roslax): reitin <b>pullonkaula</b> – kaikki vuorot tilausvuoroja, varattava viim. edellisenä päivänä klo 17. <b>Ei vuoroja ti eikä la.</b></li>
          <li><b>Replot</b> (Mossala→Dalen): suositellaan varaamaan booking.finferries.fi.</li>
          <li>Lossit (Vartsala, Skagen, Mossala–Björkö, Kivimo) ovat maksuttomia eivätkä vaadi varausta.</li>
          <li>Tarkista aina ajantasaiset ajat virallisista aikatauluista ennen lähtöä – ne voivat muuttua.</li>
        </ul>
      </div>

      <div class="info-card">
        <h2>📏 Viralliset osuudet</h2>
        <ul class="tips small" style="margin:.2rem 0 0;padding-left:1.1rem">${officialKm}</ul>
        <p class="note">Kartan etäisyydet on laskettu todellisia teitä pitkin (BRouter/pyöräprofiili) ja voivat erota hieman virallisista.</p>
      </div>

      <div class="info-card">
        <h2>📥 Offline-käyttö</h2>
        <p class="note" style="margin-top:0">Sovellus toimii ilman verkkoa. Lataa reitin karttaruudut puhelimeen ennen matkaa (sää ja tutka tarvitsevat verkon).</p>
        <button class="dl-btn" id="dl-tiles">Tallenna kartta offline-tilaan</button>
        <div class="dl-prog" id="dl-prog"><i></i></div>
        <p class="note" id="dl-status"></p>
      </div>

      <div class="info-card">
        <h2>ℹ️ Lähteet</h2>
        <p class="src">Reitti: brando.ax / Tour de Skiftet · rengastie.fi.<br>
        Lautat: Finferries (finferries.fi) &amp; Ålandstrafiken (alandstrafiken.ax).<br>
        Sää &amp; sadetutka: © Ilmatieteen laitos, avoin data.<br>
        Kartta: © OpenStreetMap-tekijät.</p>
      </div>`;

    wireOffline();
  }

  function wireOffline(){
    const btn=document.getElementById("dl-tiles");
    if(!btn) return;
    btn.onclick=async ()=>{
      if(!("caches" in window)){ alert("Selain ei tue offline-välimuistia."); return; }
      btn.disabled=true; const prog=document.getElementById("dl-prog");
      const bar=prog.querySelector("i"); const status=document.getElementById("dl-status");
      prog.style.display="block";
      try{
        const total=await MapView.downloadOfflineTiles((done,all)=>{
          bar.style.width=Math.round(done/all*100)+"%";
          status.textContent=`Ladataan karttaruutuja… ${done}/${all}`;
        });
        status.textContent=`✅ Valmis – ${total} karttaruutua tallennettu offline-käyttöön.`;
      }catch(e){ status.textContent="Lataus epäonnistui: "+e.message; }
      btn.disabled=false;
    };
  }

  /* ---------- network banner ---------- */
  function netBanner(){
    const b=document.getElementById("net-banner");
    function upd(on){
      b.hidden=false; b.className="net-banner "+(on?"on":"off");
      b.textContent = on?"🟢 Verkko palautui":"📴 Offline-tila – sää ja tutka eivät päivity";
      if(on) setTimeout(()=>b.hidden=true,2500);
    }
    window.addEventListener("online",()=>upd(true));
    window.addEventListener("offline",()=>upd(false));
    if(!navigator.onLine) upd(false);
  }

  /* ---------- boot ---------- */
  async function boot(){
    if("serviceWorker" in navigator){
      navigator.serviceWorker.register("sw.js").catch(()=>{});
    }
    document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>go(t.dataset.view));
    netBanner();
    try{
      await loadData();
    }catch(e){
      document.getElementById("map").innerHTML="<p style='padding:1rem'>Tietojen lataus epäonnistui. Avaa sovellus kerran verkossa.</p>";
      return;
    }
    MapView.init();
    wireSheet();
    renderItinerary();
    buildDayPills();
    renderFerries();
    renderInfo();
  }

  document.addEventListener("DOMContentLoaded",boot);
  return { go };
})();
