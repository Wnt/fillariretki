/* ============================================================
   radar.js — FMI rain radar (WMS, suomi_rr_eureffin, 5-min frames)
   Animated overlay on the Leaflet map.
   ============================================================ */
const Radar = (() => {
  let map=null, layer=null, frames=[], idx=0, timer=null, on=false, legend=null;
  const stepMs = FMI_RADAR.stepMin*60000;

  function init(m){ map=m; wireControls(); }

  function buildFrames(){
    const newest = Math.floor((Date.now()-FMI_RADAR.delayMin*60000)/stepMs)*stepMs;
    frames = [];
    for(let i=FMI_RADAR.frames-1;i>=0;i--) frames.push(new Date(newest - i*stepMs));
    idx = frames.length-1;
  }
  const timeParam = d => d.toISOString().replace(/\.\d+Z$/,"Z");
  const fmtTime  = d => d.toLocaleTimeString("fi-FI",{hour:"2-digit",minute:"2-digit"});

  function show(){
    buildFrames();
    layer = L.tileLayer.wms(FMI_RADAR.url, {
      layers: FMI_RADAR.layer, format:"image/png", transparent:true,
      version: FMI_RADAR.version, time: timeParam(frames[idx]),
      opacity: 0.72, tileSize:256, updateWhenIdle:true,
      attribution:"Sadetutka © Ilmatieteen laitos"
    });
    layer.addTo(map);
    addLegend();
    const ctr=document.getElementById("radar-controls");
    const sl=document.getElementById("radar-slider");
    ctr.hidden=false; sl.max=String(frames.length-1); sl.value=String(idx);
    updateLabel();
    play();
    on=true;
  }
  function hide(){
    stop();
    if(layer){ map.removeLayer(layer); layer=null; }
    removeLegend();
    document.getElementById("radar-controls").hidden=true;
    on=false;
  }
  function toggle(){ on ? hide() : show(); return on; }

  function setFrame(i){
    idx = Math.max(0, Math.min(frames.length-1, i));
    if(layer) layer.setParams({time: timeParam(frames[idx])});
    document.getElementById("radar-slider").value=String(idx);
    updateLabel();
  }
  function updateLabel(){
    const d=frames[idx];
    const ago=Math.round((Date.now()-d.getTime())/60000);
    document.getElementById("radar-time").textContent =
      fmtTime(d) + (ago<=1?" (nyt)":` (-${ago} min)`);
  }
  function play(){
    stop();
    document.getElementById("radar-play").textContent="⏸";
    timer=setInterval(()=>{
      let n=idx+1; if(n>=frames.length){ n=0; }
      setFrame(n);
      // brief pause on the newest frame
      if(idx===frames.length-1){ stop(); setTimeout(()=>{ if(on) play(); }, 1200); }
    }, 600);
  }
  function stop(){ if(timer){clearInterval(timer);timer=null;} document.getElementById("radar-play").textContent="▶"; }
  function playing(){ return !!timer; }

  function wireControls(){
    document.getElementById("radar-play").onclick=()=> playing()?stop():play();
    document.getElementById("radar-slider").oninput=(e)=>{ stop(); setFrame(parseInt(e.target.value,10)); };
  }

  function addLegend(){
    legend=L.control({position:"bottomleft"});
    legend.onAdd=()=>{
      const d=L.DomUtil.create("div","radar-legend");
      d.innerHTML=`<b>Sade (tutka)</b>
        <div class="scale">
          <i style="background:#9bd3ff"></i><i style="background:#4aa8ff"></i>
          <i style="background:#2ec27a"></i><i style="background:#f4e04d"></i>
          <i style="background:#f0902b"></i><i style="background:#e0382b"></i>
        </div>
        <span>heikko → voimakas</span>`;
      return d;
    };
    legend.addTo(map);
  }
  function removeLegend(){ if(legend){ map.removeControl(legend); legend=null; } }

  return { init, toggle, get isOn(){return on;} };
})();
