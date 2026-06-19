/* ============================================================
   config.js — static app configuration & trip data
   (Dynamic geo data comes from data/route.json,
    ferry data from data/ferries.json)
   ============================================================ */

const TRIP = {
  title: "Tour de Skiftet",
  subtitle: "Saariston rengastie · Kihti",
  direction: "Vastapäivään",
  totalLoopKm: 120,     // koko kierros (sis. merimatkat)
  seaKm: 56,            // merellä
  cycleKmApprox: 60,    // pyörällä / jalan
  speedKmh: 20,         // sähköpyörän realistinen keskinopeus
  breakMin: 15,         // väh. 15 min tauko jokaista ajotuntia kohden
  vehicle: "Sähköpolkupyörä",
  season: "8.5.–13.9.2026",
  // Viralliset saarikohtaiset pyöräilymatkat (brando.ax / Tour de Skiftet)
  officialIslandKm: {
    "Kustavi (keskusta–Heponiemi)": 11.4,
    "Brändö (Åva–Torsholma)": 21,
    "Houtskari (Roslax–Mossala)": 11,
    "Iniö (Dalen–Kannvik)": 8.5
  }
};

/* ---- Counterclockwise loop sequence ----
   wp  = a waypoint stop (id from route.json waypoints)
   edge= a connection between two stops: 'cycle' or 'ferry'  */
const SEQUENCE = [
  { wp:"kustavi_center", role:"start", label:"Lähtö · Kustavi (keskusta)" },
  { edge:"cycle", from:"kustavi_center", to:"vuosnainen", island:"Kustavi" },
  { wp:"vuosnainen", role:"terminal", label:"Vuosnainen (Osnäs)" },
  { edge:"ferry", ferry:"adan", from:"vuosnainen", to:"ava" },
  { wp:"ava", role:"terminal", label:"Åva (Brändö)" },
  { edge:"cycle", from:"ava", to:"torsholma", island:"Brändö" },
  { wp:"torsholma", role:"terminal", label:"Torsholma (Brändö)" },
  { edge:"ferry", ferry:"finno", from:"torsholma", to:"roslax" },
  { wp:"roslax", role:"terminal", label:"Roslax (Houtskari)" },
  { edge:"cycle", from:"roslax", to:"mossala", island:"Houtskari", via:["nasby"] },
  { wp:"mossala", role:"terminal", label:"Mossala (Houtskari)" },
  { edge:"ferry", ferry:"replot", from:"mossala", to:"dalen" },
  { wp:"dalen", role:"terminal", label:"Dalen (Iniö)" },
  { edge:"cycle", from:"dalen", to:"kannvik", island:"Iniö" },
  { wp:"kannvik", role:"terminal", label:"Kannvik (Iniö)" },
  { edge:"ferry", ferry:"sterna", from:"kannvik", to:"heponiemi" },
  { wp:"heponiemi", role:"terminal", label:"Heponiemi (Kustavi)" },
  { edge:"cycle", from:"heponiemi", to:"kustavi_center", island:"Kustavi" },
  { wp:"kustavi_center", role:"end", label:"Maali · Kustavi (keskusta)" }
];

/* ---- Accommodations (anchored to waypoint ids) ---- */
const STAYS = [
  { id:"peterzens", wp:"peterzens", night:1, name:"Peterzéns Boathouse",
    area:"Kustavi", phone:"+358400147148", phoneLabel:"+358 400 147 148",
    url:"https://peterzens.fi",
    note:"Yö 1 — lähtöpisteen tuntumassa (Kustavi). Ravintola, sauna ja venesatama." },
  { id:"sybarit", wp:"nasby", night:2, name:"Restaurang Sybarit & Bed and Breakfast",
    area:"Näsby, Houtskari", addr:"Näsbyvägen 189, 21760 Houtskär",
    phone:"+358405402259", phoneLabel:"040 540 2259",
    email:"restaurangsybarit@gmail.com", url:"https://sybarit.fi",
    note:"Yö 2 — Houtskarin kirkonkylä. Aamiainen hintaan, sauna ja baari." }
];

/* ---- Cable ferries (lossit) shown as small markers; data in ferries.json ---- */
const LOSSI_MARKERS = ["vartsala_lossi","skagen_lossi","mossala_bjorko_lossi","kivimo_lossi"];
/* map a lossi waypoint id -> ferries.json id */
const LOSSI_WP_TO_FERRY = {
  vartsala_lossi:"vartsala", skagen_lossi:"skagen",
  mossala_bjorko_lossi:"mossala_bjorko", kivimo_lossi:"kivimo_roslax"
};

/* ---- Weather forecast locations (resolve coords from route.json waypoints) ---- */
const WEATHER_LOCATIONS = [
  { id:"kustavi", wp:"kustavi_center", name:"Kustavi" },
  { id:"brando",  wp:"ava",            name:"Brändö" },
  { id:"houtskar",wp:"nasby",          name:"Houtskari" },
  { id:"inio",    wp:"dalen",          name:"Iniö" }
];

/* ---- FMI open data: forecast (WFS) ---- */
const FMI_FORECAST = {
  base: "https://opendata.fmi.fi/wfs",
  storedquery: "fmi::forecast::edited::weather::scandinavia::point::multipointcoverage",
  // verified-available params for this stored query:
  params: ["Temperature","WindSpeedMS","WindDirection","Precipitation1h","WeatherSymbol3","Humidity"],
  timestepMin: 60,
  hours: 168 // request up to 7 days
};

/* ---- FMI open data: rain radar (WMS) ---- */
const FMI_RADAR = {
  url: "https://openwms.fmi.fi/geoserver/Radar/wms",
  layer: "Radar:suomi_rr_eureffin", // composite rain-rate, EUREF-FIN, 5 min steps
  version: "1.1.1",
  frames: 12,     // how many frames to animate
  stepMin: 5,     // FMI radar cadence
  delayMin: 10    // newest usable frame is ~10 min in the past
};

/* ---- WeatherSymbol3 -> emoji + Finnish text ---- */
const WSYMBOL = {
  1:["☀️","Selkeää"], 2:["🌤️","Puolipilvistä"], 3:["☁️","Pilvistä"],
  21:["🌦️","Heikkoja sadekuuroja"], 22:["🌦️","Sadekuuroja"], 23:["🌧️","Voimakkaita sadekuuroja"],
  31:["🌧️","Heikkoa vesisadetta"], 32:["🌧️","Vesisadetta"], 33:["🌧️","Voimakasta vesisadetta"],
  41:["🌨️","Heikkoja lumikuuroja"], 42:["🌨️","Lumikuuroja"], 43:["❄️","Voimakkaita lumikuuroja"],
  51:["🌨️","Heikkoa lumisadetta"], 52:["❄️","Lumisadetta"], 53:["❄️","Voimakasta lumisadetta"],
  61:["⛈️","Ukkoskuuroja"], 62:["⛈️","Voimakkaita ukkoskuuroja"],
  63:["⛈️","Ukkosta"], 64:["⛈️","Voimakasta ukkosta"],
  71:["🌧️","Heikkoa räntäkuuroa"], 72:["🌧️","Räntäkuuroja"], 73:["🌧️","Voimakkaita räntäkuuroja"],
  81:["🌧️","Heikkoa räntäsadetta"], 82:["🌧️","Räntäsadetta"], 83:["🌧️","Voimakasta räntäsadetta"],
  91:["🌫️","Utua"], 92:["🌫️","Sumua"]
};
function weatherSymbol(code){ return WSYMBOL[code] || (code>=20 ? ["🌧️","Sadetta"] : ["☁️",""]); }

/* ---- Basemap tiles (OpenStreetMap) ---- */
const TILES = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-tekijät',
  maxZoom: 18,
  // offline pre-cache range for the route corridor:
  offlineMinZoom: 9, offlineMaxZoom: 14
};

/* ---- Concrete trip plan (user's dates) ----
   Counterclockwise. Each riding day lists the ferries needed (with the
   travelled direction) so the app can flag day-of-week ferry conflicts. */
const PLAN = {
  direction: "counterclockwise",
  nights: [
    { from:"2026-06-21", to:"2026-06-22", stayId:"peterzens" }, // yö 1 (su–ma)
    { from:"2026-06-22", to:"2026-06-23", stayId:"sybarit" }    // yö 2 (ma–ti)
  ],
  days: [
    { n:1, date:"2026-06-22", title:"Kustavi → Brändö → Houtskari", endStayId:"sybarit",
      // Houtskari-osuus jaetaan Näsbyssä (yöpyminen Sybaritissa)
      cycles:[ ["kustavi_center","vuosnainen"], ["ava","torsholma"],
               {seg:["roslax","mossala"], from:"roslax", to:"nasby"} ],
      ferries:[ {id:"adan",  dir:"→Åva"},
                {id:"finno", dir:"Torsholma→Roslax"} ],
      recommend:"Peterzéns ~09:00 → Ådan Vuosnainen 10:05 → Åva 10:55 → pyörä Åva–Torsholma 22 km (~1 h 45, sis. tauon, ehdit hyvin) → Torsholma → Finnö 15:15 → Roslax 17:40 → Sybarit ~18:00. (Brändön päivä — paras sää ma 22.6.)" },
    { n:2, date:"2026-06-23", title:"Houtskari → Iniö → Kustavi (Peterzéns)", endStayId:"peterzens",
      cycles:[ {seg:["roslax","mossala"], from:"nasby", to:"mossala"},
               ["dalen","kannvik"], ["heponiemi","kustavi_center"] ],
      ferries:[ {id:"replot", dir:"Mossala→Dalen"},
                {id:"sterna", dir:"Kannvik→Heponiemi"} ],
      recommend:"Sybarit ~10:45 → pyörä Mossalaan (~8 km) → Replot 12:15 → Dalen 13:15 → pyörä Iniön halki (~9 km) → Sterna Kannvik 14:45 → Heponiemi → pyörä Kustaviin (~12 km) → Peterzéns ~16:15." }
  ]
};

const WEEKDAYS = ["su","ma","ti","ke","to","pe","la"]; // getDay() index
const WEEKDAYS_LONG = ["Sunnuntai","Maanantai","Tiistai","Keskiviikko","Torstai","Perjantai","Lauantai"];
