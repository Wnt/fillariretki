/* ============================================================
   map.js — Leaflet map: route, distances, markers, offline tiles
   ============================================================ */
const MapView = (() => {
  let map=null, routeLayer=null, locateMarker=null;

  function init(){
    map = L.map("map", { zoomControl:false, attributionControl:true, tap:true })
            .setView([60.40,21.25], 10);
    L.control.zoom({position:"bottomright"}).addTo(map);
    L.tileLayer(TILES.url, {maxZoom:TILES.maxZoom, attribution:TILES.attribution}).addTo(map);

    routeLayer = L.layerGroup().addTo(map);
    buildRoute();
    fit();

    Radar.init(map);
    wireToolbar();
    return map;
  }

  /* ---------- icons ---------- */
  function divIcon(cls,html,size){
    return L.divIcon({ className:"", html:`<div class="mk ${cls}" style="width:${size}px;height:${size}px">${html}</div>`,
      iconSize:[size,size], iconAnchor:[size/2,size/2], popupAnchor:[0,-size/2] });
  }
  const labelIcon = (html,cls="dist-label") => L.divIcon({className:"",html:`<div class="${cls}">${html}</div>`,iconSize:[0,0]});

  /* ---------- build the route ---------- */
  function buildRoute(){
    routeLayer.clearLayers();
    // edges first (so markers draw on top)
    SEQUENCE.forEach(item=>{
      if(item.edge==="cycle"){
        const geom = cycleGeom(item.from,item.to);
        if(geom.length>=2){
          L.polyline(geom,{color:getCss("--cycle"),weight:5,opacity:.9,lineCap:"round"}).addTo(routeLayer);
          const km=cycleKm(item.from,item.to);
          const mid=geom[Math.floor(geom.length/2)];
          const txt = km!=null ? `${fmtKm(km)} · ${fmtDur(rideMinutes(km))}` : "";
          if(txt) L.marker(mid,{icon:labelIcon(txt),interactive:false}).addTo(routeLayer);
        }
      } else if(item.edge==="ferry"){
        const a=latlng(item.from), b=latlng(item.to);
        if(a&&b){
          const f=ferry(item.ferry);
          L.polyline([a,b],{color:getCss("--ferry"),weight:4,opacity:.85,dashArray:"2 9",lineCap:"round"})
            .on("click",()=>openFerryPopup(f,midpoint(a,b)))
            .addTo(routeLayer);
          const mid=midpoint(a,b);
          L.marker(mid,{icon:labelIcon(`⛴ ${f?shortName(f):item.ferry}`,"dist-label")})
            .on("click",()=>openFerryPopup(f,mid)).addTo(routeLayer);
        }
      }
    });

    // waypoint markers
    const seen=new Set();
    SEQUENCE.forEach(item=>{
      if(!item.wp || seen.has(item.wp+item.role)) return;
      seen.add(item.wp+item.role);
      const w=wp(item.wp); if(!w) return;
      let m;
      if(item.role==="start"||item.role==="end"){
        m=L.marker([w.lat,w.lon],{icon:divIcon("mk-start","🏁",30),zIndexOffset:500});
      }else{
        m=L.marker([w.lat,w.lon],{icon:divIcon("mk-ferry","⛴",26)});
      }
      m.bindPopup(terminalPopup(item.wp,w)).addTo(routeLayer);
    });

    // accommodations
    STAYS.forEach(s=>{
      const w=wp(s.wp); if(!w) return;
      L.marker([w.lat,w.lon],{icon:divIcon("mk-stay",String(s.night),28),zIndexOffset:600})
        .bindPopup(stayPopup(s)).addTo(routeLayer);
    });

    // cable ferries (lossit)
    LOSSI_MARKERS.forEach(id=>{
      const w=wp(id); if(!w) return;
      const f=ferry(LOSSI_WP_TO_FERRY[id]);
      L.marker([w.lat,w.lon],{icon:divIcon("mk-lossi","≈",20)})
        .bindPopup(lossiPopup(f,w)).addTo(routeLayer);
    });
  }

  /* ---------- popups ---------- */
  function terminalPopup(id,w){
    // ferries departing/arriving here
    const fs = DATA.ferries.filter(f=>{
      const seq=SEQUENCE.find(s=>s.edge==="ferry"&&s.ferry===f.id);
      return seq && (seq.from===id || seq.to===id);
    });
    let html=`<h3>${w.name}</h3>`;
    fs.forEach(f=> html+=`<div class="pp-row">⛴ <b>${f.name}</b> — ${f.leg}${f.booking_required?' <span class="tag book">varaa</span>':''}</div>`);
    html+=`<div class="btn-row"><a class="btn" href="https://www.google.com/maps/dir/?api=1&destination=${w.lat},${w.lon}" target="_blank" rel="noopener">Reittiohjeet</a></div>`;
    return html;
  }
  function stayPopup(s){
    return `<h3>🛏 ${s.name}</h3>
      <div class="pp-row"><b>Yö ${s.night}</b> · ${s.area}</div>
      ${s.addr?`<div class="pp-row">${s.addr}</div>`:""}
      <div class="btn-row">
        <a class="btn primary" href="tel:${s.phone}">📞 Soita</a>
        ${s.url?`<a class="btn" href="${s.url}" target="_blank" rel="noopener">Sivut</a>`:""}
      </div>`;
  }
  function lossiPopup(f,w){
    if(!f) return `<h3>${w.name}</h3><div class="pp-row">Pieni lossi</div>`;
    return `<h3>≈ ${f.name}</h3><div class="pp-row">${f.leg}</div>
      <div class="pp-row">${f.price_note||"Maksuton"} · ei varausta</div>
      ${f.info?`<div class="pp-row">${f.info}</div>`:""}`;
  }
  function openFerryPopup(f,at){
    if(!f) return;
    const html=`<h3>⛴ ${f.name}</h3>
      <div class="pp-row">${f.leg}</div>
      <div class="pp-row">${f.operator||""} · ${f.booking_required?'<span class="tag book">Varaus pakollinen</span>':'Ei varausta'}</div>
      <div class="btn-row">
        ${f.booking_url?`<a class="btn primary" href="${f.booking_url}" target="_blank" rel="noopener">Varaa</a>`:""}
        ${f.phone?`<a class="btn" href="tel:${(f.phone||"").replace(/[^+\d]/g,"")}">📞</a>`:""}
        <button class="btn" onclick="App.go('ferries')">Aikataulut</button>
      </div>`;
    L.popup().setLatLng(at).setContent(html).openOn(map);
  }

  /* ---------- helpers ---------- */
  function shortName(f){ return (f.name||"").replace(/^m\/s\s*/i,"").replace(/^M\/S\s*/,""); }
  function midpoint(a,b){ return [(a[0]+b[0])/2,(a[1]+b[1])/2]; }
  function getCss(v){ return getComputedStyle(document.documentElement).getPropertyValue(v).trim()||"#0b6e8f"; }

  function fit(){
    const bb = DATA.route && DATA.route.bbox;
    if(bb) map.fitBounds([[bb[0],bb[1]],[bb[2],bb[3]]],{padding:[30,30]});
  }
  function locate(){
    if(!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(p=>{
      const ll=[p.coords.latitude,p.coords.longitude];
      if(locateMarker) locateMarker.setLatLng(ll);
      else locateMarker=L.circleMarker(ll,{radius:8,color:"#fff",weight:3,fillColor:"#1a73e8",fillOpacity:1}).addTo(map);
      map.setView(ll, 13);
    }, ()=>alert("Sijaintia ei saatu."), {enableHighAccuracy:true,timeout:8000});
  }

  function wireToolbar(){
    document.getElementById("btn-fit").onclick=fit;
    document.getElementById("btn-locate").onclick=locate;
    const rb=document.getElementById("btn-radar");
    rb.onclick=()=>{ Radar.toggle(); rb.classList.toggle("is-on",Radar.isOn); };
  }

  /* ---------- offline tile pre-cache ---------- */
  function lon2t(lon,z){ return Math.floor((lon+180)/360*Math.pow(2,z)); }
  function lat2t(lat,z){ const r=lat*Math.PI/180; return Math.floor((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*Math.pow(2,z)); }
  function tileURLs(){
    const bb=DATA.route.bbox, urls=[];
    for(let z=TILES.offlineMinZoom; z<=TILES.offlineMaxZoom; z++){
      const x0=lon2t(bb[1],z), x1=lon2t(bb[3],z);
      const y0=lat2t(bb[2],z), y1=lat2t(bb[0],z);
      for(let x=x0;x<=x1;x++) for(let y=y0;y<=y1;y++)
        urls.push(TILES.url.replace("{s}","a").replace("{z}",z).replace("{x}",x).replace("{y}",y));
    }
    return urls;
  }
  async function downloadOfflineTiles(onProgress){
    const urls=tileURLs();
    const cache=await caches.open("osm-tiles");
    let done=0;
    const batch=6;
    for(let i=0;i<urls.length;i+=batch){
      await Promise.all(urls.slice(i,i+batch).map(async u=>{
        try{ const m=await cache.match(u); if(m) return;
          const r=await fetch(u,{mode:"no-cors"}); await cache.put(u,r);
        }catch(e){}
      }));
      done=Math.min(urls.length,i+batch); onProgress(done,urls.length);
    }
    return urls.length;
  }

  return { init, fit, locate, downloadOfflineTiles, get map(){return map;} };
})();
