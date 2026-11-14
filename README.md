# bar-chart-race

CLI nástroj pro generování bar chart race grafů ze "wide" CSV — bez GUI, bez šablon na výběr, bez závislosti na jakékoli třetí straně. Výstupem je samostatný `.html` soubor (funkční offline) a/nebo video (`.mp4`) či `.gif`.

## Instalace

```bash
npm install
# nebo
make install
```

## Vstupní formát (wide CSV)

```csv
category,2000,2005,2010
USA,10000,13000,15000
China,1200,2300,6100
```

První sloupec je název kategorie, zbylé sloupce jsou časové body s hodnotami.

## Použití

```bash
node bin/cli.js sample-hot-toys.csv -o out --format both -n 8 \
  -t "Hot Toys Movie Masterpiece Series Products" \
  -s "Trend of announced Hot Toys products in the Movie Masterpiece Series" \
  --source-text "Source: collectorboy.cz" --source-url "https://collectorboy.cz"
```

Výchozí vzhled je červené téma ve stylu Flourish (bary, osa nahoře, velké datum a "Total" vpravo dole, play/pause a časová osa dole, zdroj jako odkaz v patičce). Samostatný HTML soubor se po otevření sám přehrává a má funkční play/pause tlačítko i posuvník.

CSV vstup může být lokální cesta nebo rovnou `http(s)://` URL — nástroj si ho sám stáhne:

```bash
node bin/cli.js https://example.com/data.csv -o out
```

### Opakované spouštění přes config soubor

Aby nebylo nutné psát při každém spuštění všechny přepínače znovu, lze je uložit do JSON configu a spouštět jen `--config`. Ukázka v [config.sample.json](config.sample.json):

```bash
node bin/cli.js --config config.sample.json
```

Config podporuje stejné klíče jako CLI přepínače (camelCase): `csv` (cesta nebo URL), `output`, `format`, `topN`, `title`, `subtitle`, `sourceText`, `sourceUrl`, `fps`, `duration`, `width`, `height`, `theme`. Libovolný CLI přepínač zadaný vedle `--config` má přednost — config je jen výchozí sada hodnot:

```bash
node bin/cli.js --config config.sample.json -t "Jiný titulek" --format video
```

### Makefile

Pro `config.sample.json` jsou k dispozici i zkratky přes `make` (jiný config lze zadat přes `CONFIG=...`):

| Příkaz | Co udělá |
| --- | --- |
| `make install` | `npm install` |
| `make run` | vygeneruje vše podle `config.sample.json` (HTML i video) |
| `make html` | vygeneruje jen `out.html` |
| `make video` | vygeneruje jen `out.mp4` |
| `make gif` | vygeneruje jen `out.gif` |
| `make clean` | smaže `out.html`, `out.mp4`, `out.gif` |
| `make run CONFIG=muj-config.json` | totéž, ale s jiným config souborem |

### Volby

| Volba | Popis | Výchozí |
| --- | --- | --- |
| `-c, --config <soubor.json>` | JSON se sadou výchozích nastavení, viz výše | — |
| `-o, --output <path>` | základ názvu výstupních souborů | `chart-race` |
| `-f, --format <type>` | `html` \| `video` \| `gif` \| `both` (html+mp4) | `both` |
| `-n, --top-n <n>` | počet zobrazených sloupců | `12` |
| `-t, --title <text>` | titulek grafu | — |
| `-s, --subtitle <text>` | podnadpis grafu | — |
| `--source-text <text>` | text v patičce, např. `"Source: example.com"` | — |
| `--source-url <url>` | volitelný odkaz pro text v patičce | — |
| `--fps <n>` | snímky za sekundu | `30` |
| `--duration <s>` | délka přechodu mezi datovými body | `0.5` |
| `--width`, `--height` | rozlišení v px (zaokrouhleno na sudé kvůli video kodeku) | `1600`, `900` |
| `--theme <soubor.json>` | font/barvy/velikosti písma, viz níže | vestavěné červené téma |

## Theming

Font, velikosti písma a barvy se nastavují přes `--theme <soubor.json>`. Stačí přepsat jen ty klíče, které chceš změnit — zbytek se doplní z výchozího tématu (`src/theme.js`). Příklad je v [theme.sample.json](theme.sample.json):

```bash
node bin/cli.js sample-hot-toys.csv -o out --theme theme.sample.json
```

Dostupné klíče:

```jsonc
{
  "fontFamily": "...",               // libovolný CSS font-family stack
  "colors": {
    "background": "#c6303e",
    "foreground": "#ffffff",
    "muted": "rgba(255,255,255,0.75)", // popisky dat, zdroj, ticky
    "barFill": "#fbdfe2",
    "gridLine": "rgba(255,255,255,0.45)",
    "accent": "#ffe27a"               // zatím nepoužito, rezerva pro zvýraznění
  },
  "fontSize": {
    "title": 34, "subtitle": 18, "axisLabel": 14,
    "barLabel": 16, "barValue": 16,
    "counterDate": 52, "counterTotal": 26,
    "tickLabel": 13, "source": 13       // v px
  },
  "fontWeight": {
    "title": 800, "subtitle": 500,
    "barLabel": 400, "barValue": 600,
    "counterDate": 800, "counterTotal": 500
  }
}
```

## Jak to funguje

- `src/data.js` – parsuje CSV.
- `src/frames.js` – interpoluje mezi datovými body a počítá pořadí (top-N).
- `src/theme.js` – výchozí téma + načtení/merge `--theme` souboru, převod na CSS proměnné.
- `src/buildHtml.js` – vloží data, téma a lokální D3 do jednoho samostatného HTML.
- `src/exportVideo.js` – headless Chromium (Puppeteer) krokuje snímky, lokální `ffmpeg` binárka je enkóduje do mp4/gif.

Žádný krok nevolá externí API ani CDN — vygenerovaný HTML soubor jde otevřít offline.
