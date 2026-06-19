# Tour de Skiftet · Fillarireitti 🚲⛴️

Interaktiivinen, mobiiliystävällinen ja **offline-toimiva** suunnittelukartta
saariston rengastien *Tour de Skiftet* -pyöräilykierrokselle (Kustavi – Iniö –
Houtskari – Brändö). Sovellus näyttää fillarimatkojen etäisyydet, lauttojen
aikataulut ja varustiedot, reaaliaikaisen sääennusteen sekä sadetutkan.

> Reitti ajetaan **vastapäivään** ja majoitus on 2 yötä:
> **Yö 1** Peterzéns Boathouse (Kustavi) · **Yö 2** Restaurang Sybarit & B&B (Näsby, Houtskari).

## Ominaisuudet

- 🗺️ **Kartta** — koko reitti todellisia teitä pitkin, jokaisen pyöräosuuden
  etäisyys ja arvioitu ajoaika (sähköpyörä ~20 km/h). Lautat katkoviivoilla,
  satamat, majoitukset ja lossit merkkeinä.
- ⛴️ **Lautat** — aikataulut viikonpäivittäin, varustiedot, varauspakot,
  puhelinnumerot ja suorat linkit varausjärjestelmiin sekä virallisiin aikatauluihin.
- 🌤️ **Sää** — usean vuorokauden tuntiennuste (lämpötila, tuuli + suunta, sade)
  neljälle reitin paikkakunnalle. Lähde: **Ilmatieteen laitos** (avoin data, WFS).
- 🌧️ **Sadetutka** — animoitu, viimeiset ~12 ruutua. Lähde: **Ilmatieteen laitos**
  (avoin data, WMS-rajapinta `suomi_rr_eureffin`).
- 🗓️ **Reissusuunnitelma** — päiväkohtainen suunnitelma, joka **tarkistaa
  automaattisesti** osuuko jokin lautta päivälle, jolloin se ei liikennöi.
- 📥 **Offline** — service worker tallentaa sovelluksen, reittidatan ja
  aikataulut. Karttaruudut voi esiladata reitin alueelta yhdellä napilla.
  (Sää ja tutka tarvitsevat verkon, mutta viimeisin ennuste säilyy välimuistissa.)

## Käyttö paikallisesti

Sovellus on puhdas staattinen sivusto – ei käännösvaihetta. Tarvitset vain
HTTP-palvelimen (service worker ei toimi `file://`-osoitteesta):

```bash
python3 -m http.server 8000
# avaa http://localhost:8000
```

## Julkaisu GitHub Pagesiin

**Vaihtoehto A – GitHub Actions (mukana `.github/workflows/pages.yml`):**
Repo → *Settings* → *Pages* → *Source: GitHub Actions*. Push `main`-haaraan
julkaisee sivuston automaattisesti.

**Vaihtoehto B – haarasta suoraan:** Repo → *Settings* → *Pages* →
*Deploy from a branch* → valitse haara ja `/ (root)`. Kaikki tiedostot ovat
juuressa, joten erillistä buildia ei tarvita.

## Tietojen päivittäminen

Kaikki muuttuva data on helposti muokattavissa olevissa JSON-tiedostoissa:

| Tiedosto | Sisältö |
|---|---|
| `data/route.json` | Reittipisteiden koordinaatit ja pyöräosuuksien geometria/etäisyydet |
| `data/ferries.json` | Lauttojen aikataulut, varustiedot, varaus- ja yhteystiedot |
| `js/config.js` | Reissun tiedot, majoitukset (`STAYS`), päiväsuunnitelma (`PLAN`) |

> ⚠️ **Tarkista aina ajantasaiset lautta-ajat** virallisista lähteistä ennen
> matkaa – ne voivat muuttua. Sovellus linkittää suoraan virallisiin aikatauluihin.

## Lähteet

- Reitti: [brando.ax / Tour de Skiftet](https://www.brando.ax/tour-de-skiftet-fi/) · [rengastie.fi](https://www.rengastie.fi/tour-de-skiftet/)
- Lautat: [Finferries](https://www.finferries.fi) & [Ålandstrafiken](https://www.alandstrafiken.ax)
- Sää & sadetutka: © [Ilmatieteen laitos, avoin data](https://www.ilmatieteenlaitos.fi/avoin-data)
- Kartta-aineisto: © [OpenStreetMap](https://www.openstreetmap.org/copyright)-tekijät

Sää- ja tutkadatan käyttö perustuu samoihin FMI:n avoimen datan rajapintoihin,
joita käyttävät esim. [greenhouse-solar-heater](https://github.com/Wnt/greenhouse-solar-heater)
ja [sataako-fi](https://github.com/heikkipora/sataako-fi).
