# Casino Campari Night 🏁

Corse dei camparini per la serata al Bar Indipendenza (Broni).

## Alla serata

```bash
npm install
npm run build && npm start   # più fluido di `npm run dev`
```

Apri `http://localhost:3000` in **Chrome**, collega il portatile alla TV e premi **F** per lo schermo intero.
Il primo click (o il primo tasto) attiva l'audio.

| Tasto            | Cosa fa                                         |
| ---------------- | ----------------------------------------------- |
| `Spazio`/`Invio` | Partenza / prossima corsa                       |
| `F`              | Schermo intero                                  |
| `M`              | Suoni on/off                                    |
| `V`              | Telecronaca vocale on/off                       |

- Prima di ogni corsa c'è il **programma** (nome del premio, forma e vittorie della serata);
  all'arrivo l'**ordine d'arrivo ufficiale** con i distacchi in lunghezze e le combinazioni
  vincenti (vincente, accoppiata, trio).
- Numero della corsa, vittorie e forma restano salvati anche se ricarichi la pagina.
  Per ripartire da zero c'è il pulsante ↺ in basso a sinistra (compare muovendo il mouse).
- Funziona offline una volta avviato: niente CDN, suoni sintetizzati, texture disegnate al volo.
- La telecronaca vocale usa la voce italiana del sistema/browser (su Chrome per macOS c'è).

## Come funziona una corsa

Il **vincitore dipende solo dal numero della corsa**, con la formula in `lib/race/winner.ts`
(su molte corse ognuno vince circa il 20% delle volte). Tutto il resto è casuale: un piccolo
regista (`lib/race/plan.ts`) prova ~50 gare con quel vincitore e tiene quella con più sorpassi,
rimonte e arrivo serrato, quindi la stessa corsa non si ripete mai uguale.

`?seed=123` nell'URL rigioca uno svolgimento preciso (utile per provare il fotofinish: `?seed=4`).

## Struttura

- `lib/race/config.ts` — concorrenti (nomi, numeri, colori), nomi dei premi, misure della pista, distacchi
- `lib/race/winner.ts` — chi vince la corsa N
- `lib/race/plan.ts` — generazione della gara e della telecronaca
- `lib/race/engine.ts` — orologio di gara, partenza, slow‑motion, fotofinish, posizioni in pista
- `lib/race/tally.ts` — numero corsa, vittorie e forma della serata
- `lib/race/audio.ts` — suoni (WebAudio) e voce
- `components/race/*` — scena 3D (pista, bottiglie, regia) e HUD
- `public/campari_soda_opt.glb` — modello ottimizzato (627 KB invece di 14,6 MB)
