import { useState, useEffect } from 'react'
import { gsap } from 'gsap'

/* ─────────────────────────────────────────────
   CONTENU DES COURS — FR & EN
   Sources : Polycopié M2 MIAGE Dauphine (Royer, 2022)
───────────────────────────────────────────── */
const COURSES = [
  {
    id: 1, level: "Débutant", emoji: "🕯️",
    title:    { fr: "La bougie japonaise",         en: "Japanese Candlesticks" },
    duration: "8 min",
    desc: {
      fr: "Comprendre les bougies OHLC, patterns de base, signaux de retournement.",
      en: "Understanding OHLC candles, basic patterns, reversal signals.",
    },
    content: {
      fr: `
## Qu'est-ce qu'une bougie japonaise ?

Une bougie japonaise représente l'évolution du prix sur une période donnée. Elle contient **4 informations clés** :

- **Open (O)** — Prix d'ouverture
- **High (H)** — Prix le plus haut
- **Low (L)** — Prix le plus bas
- **Close (C)** — Prix de clôture

## Corps et mèches

Le **corps** représente la différence entre Open et Close.
- Corps **vert** (haussier) : Close > Open
- Corps **rouge** (baissier) : Close < Open

Les **mèches** (ou ombres) représentent les extrêmes atteints pendant la période : la mèche haute correspond au High, la mèche basse au Low.

## Patterns essentiels

**Doji** — Open ≈ Close → indécision du marché, possible retournement. Le vendeur et l'acheteur sont à égalité.

**Marteau (Hammer)** — Petit corps en haut, longue mèche basse (≥2× le corps) → signal haussier après une baisse. Les vendeurs ont tenté de pousser le prix à la baisse mais les acheteurs ont repris le contrôle.

**Étoile filante (Shooting Star)** — Petit corps en bas, longue mèche haute → signal baissier après une hausse. Les acheteurs ont tenté un rallye mais les vendeurs ont contre-attaqué.

**Engulfing haussier** — Grande bougie verte qui "avale" entièrement la bougie rouge précédente → signal d'achat fort, changement de sentiment du marché.

**Engulfing baissier** — Grande bougie rouge qui avale la bougie verte précédente → signal de vente fort.

**Morning Star** — Séquence 3 bougies : rouge | petit corps | grande verte → retournement haussier après tendance baissière.

## Lecture combinée

Une bougie seule donne peu d'information. C'est la **séquence** de bougies qui crée le signal. Toujours confirmer un pattern avec :
- Le volume (un engulfing sur fort volume est bien plus fiable)
- Un indicateur comme le RSI
- Le contexte (support, résistance, tendance générale)

## Application pratique

Sur ThePnLab, observe le graphique BTC-USD. Identifie les dernières bougies et demande au Coach IA : *"Que signifie ce pattern de bougie ?"*
      `,
      en: `
## What is a Japanese Candlestick?

A Japanese candlestick represents price action over a given period. It contains **4 key pieces of information**:

- **Open (O)** — Opening price
- **High (H)** — Highest price
- **Low (L)** — Lowest price
- **Close (C)** — Closing price

## Body and Wicks

The **body** represents the difference between Open and Close.
- **Green** body (bullish): Close > Open
- **Red** body (bearish): Close < Open

The **wicks** (or shadows) represent the extremes reached during the period.

## Essential Patterns

**Doji** — Open ≈ Close → market indecision, possible reversal.

**Hammer** — Small body at top, long lower wick (≥2× body) → bullish signal after a downtrend.

**Shooting Star** — Small body at bottom, long upper wick → bearish signal after an uptrend.

**Bullish Engulfing** — Large green candle that fully "swallows" the previous red candle → strong buy signal.

**Morning Star** — 3-candle sequence: red | small body | large green → bullish reversal.

## Combined Reading

Always confirm a pattern with volume, an indicator like RSI, and the overall trend context.
      `,
    },
    quiz: {
      fr: [
        { q: "Qu'est-ce que le 'corps' d'une bougie représente ?", options: ["La différence entre High et Low", "La différence entre Open et Close", "Le volume échangé", "La durée de la période"], answer: 1 },
        { q: "Une bougie verte (bullish) signifie que :", options: ["Close < Open", "High > Low", "Close > Open", "Open = Close"], answer: 2 },
        { q: "Quel pattern indique une indécision du marché ?", options: ["Engulfing", "Doji", "Hammer", "Morning Star"], answer: 1 },
        { q: "Le Hammer est un signal :", options: ["Baissier après une hausse", "Haussier après une baisse", "Neutre à tout moment", "Baissier après une baisse"], answer: 1 },
        { q: "Pour confirmer un pattern de bougie, il faut :", options: ["Regarder uniquement le prix", "Ne rien vérifier", "Confirmer avec volume + indicateur + contexte", "Attendre 5 bougies de plus"], answer: 2 },
      ],
      en: [
        { q: "What does the 'body' of a candlestick represent?", options: ["Difference between High and Low", "Difference between Open and Close", "Volume traded", "Duration of the period"], answer: 1 },
        { q: "A green (bullish) candle means:", options: ["Close < Open", "High > Low", "Close > Open", "Open = Close"], answer: 2 },
        { q: "Which pattern signals market indecision?", options: ["Engulfing", "Doji", "Hammer", "Morning Star"], answer: 1 },
        { q: "The Hammer is a signal:", options: ["Bearish after a rally", "Bullish after a decline", "Neutral at any time", "Bearish after a decline"], answer: 1 },
        { q: "To confirm a candlestick pattern, you should:", options: ["Look at price only", "Verify nothing", "Confirm with volume + indicator + context", "Wait 5 more candles"], answer: 2 },
      ],
    },
  },

  {
    id: 2, level: "Débutant", emoji: "📊",
    title:    { fr: "RSI — Relative Strength Index", en: "RSI — Relative Strength Index" },
    duration: "10 min",
    desc: {
      fr: "Oscillateur de momentum 0-100, zones de surachat/survente, divergences.",
      en: "Momentum oscillator 0-100, overbought/oversold zones, divergences.",
    },
    content: {
      fr: `
## Définition

Le RSI mesure la vitesse et l'amplitude des variations de prix sur les **14 dernières périodes**. Il oscille entre **0 et 100**.

Développé par J. Welles Wilder en 1978, c'est l'un des indicateurs techniques les plus utilisés au monde.

## Formule complète

\`\`\`
RSI = 100 − (100 / (1 + RS))

RS = Moyenne des gains sur 14 jours / Moyenne des pertes sur 14 jours

Gain moyen = Σ(hausses sur 14j) / 14
Perte moyenne = Σ(|baisses| sur 14j) / 14
\`\`\`

Le premier calcul utilise une moyenne simple. Les suivants utilisent une moyenne exponentiellement lissée (Wilder smoothing) :
\`\`\`
Gain moyen(t) = (Gain moyen(t-1) × 13 + Gain(t)) / 14
\`\`\`

## Interprétation classique

- **RSI > 70** → Zone de **surachat** : le prix a monté trop vite, correction possible
- **RSI < 30** → Zone de **survente** : le prix a chuté trop vite, rebond possible
- **RSI ≈ 50** → Zone neutre, tendance équilibrée
- **RSI en hausse** → momentum acheteur en progression

## Divergences — le signal le plus puissant

**Divergence baissière** : Le prix fait un nouveau sommet MAIS le RSI fait un sommet plus bas → le momentum s'affaiblit, retournement baissier probable.

**Divergence haussière** : Le prix fait un nouveau creux MAIS le RSI fait un creux plus haut → le momentum s'améliore malgré la baisse, retournement haussier probable.

Les divergences sont des signaux **avancés** contrairement aux croisements de moyennes mobiles (signaux retardés).

## Limites importantes

Dans une tendance forte, le RSI peut rester en zone de surachat (>70) pendant des semaines entières. **Ne jamais vendre uniquement parce que le RSI est à 75 en tendance haussière.**

Sur ThePnLab, le bot vend quand RSI > 60 **ET** MACD baissier — la double condition réduit les faux signaux de ~40%.
      `,
      en: `
## Definition

The RSI measures the speed and magnitude of price changes over the **last 14 periods**. It oscillates between **0 and 100**.

## Full Formula

\`\`\`
RSI = 100 − (100 / (1 + RS))
RS = Average Gain (14d) / Average Loss (14d)
\`\`\`

## Classic Interpretation

- **RSI > 70** → Overbought zone
- **RSI < 30** → Oversold zone
- **RSI ≈ 50** → Neutral zone

## Divergences

**Bearish divergence**: Price makes a new high BUT RSI makes a lower high → weakening momentum, likely reversal.

**Bullish divergence**: Price makes a new low BUT RSI makes a higher low → improving momentum, likely reversal.

## Limits

In strong trends, RSI can stay above 70 for weeks. Never sell purely because RSI is at 75 in a bull trend.
      `,
    },
    quiz: {
      fr: [
        { q: "Le RSI oscille entre :", options: ["0 et 50", "0 et 100", "-100 et +100", "14 et 100"], answer: 1 },
        { q: "Un RSI > 70 indique :", options: ["Zone de survente", "Zone de surachat", "Tendance neutre", "Signal d'achat fort"], answer: 1 },
        { q: "La période classique du RSI est de :", options: ["7 jours", "21 jours", "14 jours", "50 jours"], answer: 2 },
        { q: "Une divergence baissière RSI signifie :", options: ["Prix nouveau sommet + RSI nouveau sommet", "Prix nouveau sommet + RSI sommet plus bas", "Prix plus bas + RSI plus haut", "RSI > 70 et prix stable"], answer: 1 },
        { q: "RSI = 50 indique :", options: ["Surachat extrême", "Survente extrême", "Zone neutre / tendance équilibrée", "Signal de vente immédiat"], answer: 2 },
      ],
      en: [
        { q: "The RSI oscillates between:", options: ["0 and 50", "0 and 100", "-100 and +100", "14 and 100"], answer: 1 },
        { q: "An RSI > 70 indicates:", options: ["Oversold zone", "Overbought zone", "Neutral trend", "Strong buy signal"], answer: 1 },
        { q: "The classic RSI period is:", options: ["7 days", "21 days", "14 days", "50 days"], answer: 2 },
        { q: "A bearish RSI divergence means:", options: ["Price new high + RSI new high", "Price new high + RSI lower high", "Price lower + RSI higher", "RSI > 70 and stable price"], answer: 1 },
        { q: "RSI = 50 indicates:", options: ["Extreme overbought", "Extreme oversold", "Neutral zone / balanced trend", "Immediate sell signal"], answer: 2 },
      ],
    },
  },

  {
    id: 3, level: "Débutant", emoji: "📉",
    title:    { fr: "MACD — Convergence/Divergence", en: "MACD — Moving Average Convergence/Divergence" },
    duration: "12 min",
    desc: {
      fr: "Deux moyennes mobiles exponentielles, ligne signal, histogramme.",
      en: "Two EMAs, signal line, histogram.",
    },
    content: {
      fr: `
## Composition du MACD

Le MACD est composé de **3 éléments** :

1. **Ligne MACD** = EMA(12) − EMA(26)
2. **Ligne Signal** = EMA(9) de la ligne MACD
3. **Histogramme** = MACD − Signal (force et direction du momentum)

Les paramètres 12, 26, 9 sont les standards de Gerald Appel (créateur du MACD, années 1970).

## Formule des EMA

\`\`\`
EMA(t) = Prix(t) × k + EMA(t-1) × (1 - k)
k = 2 / (N + 1)

Pour EMA(12) : k = 2/13 ≈ 0.1538
Pour EMA(26) : k = 2/27 ≈ 0.0741
Pour Signal  : k = 2/10 = 0.2000
\`\`\`

## Signaux de trading

**Croisement haussier** : MACD croise Signal par le bas (MACD passe au-dessus de Signal) → signal d'achat. Plus fort si cela se produit en zone négative (sous zéro).

**Croisement baissier** : MACD croise Signal par le haut → signal de vente. Plus fort si en zone positive.

**Passage à zéro** : La ligne MACD croise la ligne zéro → confirmation de changement de tendance.

**Histogramme croissant** → momentum acheteur qui s'accélère
**Histogramme décroissant** → momentum vendeur qui s'accélère

## Combinaison RSI + MACD (stratégie du bot ThePnLab)

\`\`\`
BUY  si RSI < 45  ET  MACD > Signal  ET  prix > SMA50 × 0.97
SELL si RSI > 60  ET  MACD < Signal  ET  prix < SMA50 × 1.03
\`\`\`

Cette triple condition réduit les faux signaux de ~40% par rapport à un signal unique.

## Limites

Le MACD est un indicateur **retardé** — il confirme une tendance déjà amorcée. Dans un marché qui range (sans tendance), il génère beaucoup de faux signaux. Toujours vérifier la tendance générale avec la SMA200 avant d'agir sur un signal MACD.
      `,
      en: `
## MACD Components

1. **MACD Line** = EMA(12) − EMA(26)
2. **Signal Line** = EMA(9) of MACD Line
3. **Histogram** = MACD − Signal

## Trading Signals

**Bullish crossover**: MACD crosses Signal from below → buy signal. Stronger below zero.

**Bearish crossover**: MACD crosses Signal from above → sell signal. Stronger above zero.

## ThePnLab Bot Strategy

\`\`\`
BUY  if RSI < 45  AND  MACD > Signal
SELL if RSI > 60  AND  MACD < Signal
\`\`\`

## Limits

MACD is a lagging indicator — it confirms a trend that has already started. In ranging markets, it generates many false signals.
      `,
    },
    quiz: {
      fr: [
        { q: "MACD = ?", options: ["EMA12 - EMA26", "EMA26 - EMA12", "RSI - Signal", "SMA50 - SMA200"], answer: 0 },
        { q: "La 'ligne de signal' du MACD est une :", options: ["EMA9 du MACD", "SMA14 du MACD", "EMA26 du prix", "Ligne du RSI"], answer: 0 },
        { q: "Un croisement haussier MACD signifie :", options: ["MACD passe sous la ligne de signal", "Histogramme devient négatif", "MACD passe au-dessus de la ligne de signal", "MACD = 0"], answer: 2 },
        { q: "L'histogramme MACD représente :", options: ["La valeur du MACD seul", "MACD - Signal Line", "EMA12 - EMA26", "Volume × MACD"], answer: 1 },
        { q: "Le MACD est moins fiable :", options: ["En tendance forte", "Sur les marchés crypto", "Sur les marchés sans tendance claire (range)", "Avec des bougies journalières"], answer: 2 },
      ],
      en: [
        { q: "MACD = ?", options: ["EMA12 - EMA26", "EMA26 - EMA12", "RSI - Signal", "SMA50 - SMA200"], answer: 0 },
        { q: "The MACD 'signal line' is a:", options: ["EMA9 of MACD", "SMA14 of MACD", "EMA26 of price", "RSI line"], answer: 0 },
        { q: "A bullish MACD crossover means:", options: ["MACD crosses below signal line", "Histogram turns negative", "MACD crosses above signal line", "MACD = 0"], answer: 2 },
        { q: "The MACD histogram represents:", options: ["MACD value alone", "MACD - Signal Line", "EMA12 - EMA26", "Volume × MACD"], answer: 1 },
        { q: "MACD is less reliable:", options: ["In strong trends", "On crypto markets", "In trendless/ranging markets", "With daily candles"], answer: 2 },
      ],
    },
  },

  {
    id: 4, level: "Intermédiaire", emoji: "📈",
    title:    { fr: "Moyennes mobiles — SMA & EMA", en: "Moving Averages — SMA & EMA" },
    duration: "10 min",
    desc: {
      fr: "Simple vs exponentielle, SMA50/200, golden cross, death cross.",
      en: "Simple vs exponential, SMA50/200, golden cross, death cross.",
    },
    content: {
      fr: `
## SMA — Simple Moving Average

La SMA est la **moyenne arithmétique** des N derniers prix de clôture :

\`\`\`
SMA(N)(t) = (P(t) + P(t-1) + ... + P(t-N+1)) / N
\`\`\`

**SMA20** : tendance court terme (~1 mois)
**SMA50** : tendance moyen terme (~2-3 mois)
**SMA200** : tendance long terme (~10 mois) — la plus surveillée par les institutionnels

## EMA — Exponential Moving Average

L'EMA donne plus de **poids aux prix récents**. Elle réagit plus vite aux changements :

\`\`\`
EMA(t) = Prix(t) × k + EMA(t-1) × (1 - k)
k = 2 / (N + 1)
\`\`\`

**Avantage** : réactivité aux retournements rapides
**Inconvénient** : plus sensible au bruit, génère plus de faux signaux

## Golden Cross & Death Cross

**Golden Cross** : SMA50 croise SMA200 **par le bas** → signal haussier long terme fort
→ Historiquement, le S&P500 gagne en moyenne +15% dans les 12 mois suivants un Golden Cross

**Death Cross** : SMA50 croise SMA200 **par le haut** → signal baissier long terme fort
→ Signal rare (2-3 fois par décennie sur les indices), mais fiable

## Support et résistance dynamiques

Le prix a tendance à "rebondir" sur les moyennes mobiles importantes :
- **Rebond sur SMA50** en tendance haussière → signal d'achat (continuation)
- **Cassure sous SMA200** → signal de faiblesse structurelle majeure
- **Prix entre SMA50 et SMA200** → zone de transition, attendre confirmation

## Ribbon de moyennes mobiles

Technique avancée : afficher 5-8 SMA de périodes différentes (SMA10, 20, 50, 100, 200). Quand elles s'ordonnent de la plus courte à la plus longue dans le sens de la tendance, c'est une confirmation de tendance forte.

Sur ThePnLab, la **SMA50 est affichée en or** sur le graphique — activer les Bollinger Bands affiche également leur SMA20 centrale.
      `,
      en: `
## SMA — Simple Moving Average

\`\`\`
SMA(N)(t) = (P(t) + P(t-1) + ... + P(t-N+1)) / N
\`\`\`

**SMA50**: medium-term trend | **SMA200**: long-term trend (most watched by institutions)

## EMA — Exponential Moving Average

\`\`\`
EMA(t) = Price(t) × k + EMA(t-1) × (1 - k)
k = 2 / (N + 1)
\`\`\`

Reacts faster to price changes than SMA.

## Golden & Death Cross

**Golden Cross**: SMA50 crosses SMA200 from below → strong long-term bullish signal
**Death Cross**: SMA50 crosses SMA200 from above → strong long-term bearish signal

## Dynamic Support & Resistance

Price tends to "bounce" off key moving averages. A break below SMA200 signals major structural weakness.
      `,
    },
    quiz: {
      fr: [
        { q: "La SMA50 représente :", options: ["La moyenne des 50 derniers volumes", "La moyenne des 50 derniers prix de clôture", "Le RSI sur 50 jours", "La somme des 50 derniers prix"], answer: 1 },
        { q: "La différence entre SMA et EMA est que l'EMA :", options: ["Ignore les données récentes", "Donne plus de poids aux données récentes", "Est calculée sur moins de périodes", "Est identique à la SMA"], answer: 1 },
        { q: "Un 'Golden Cross' est :", options: ["SMA50 croise sous SMA200", "SMA200 croise au-dessus SMA50", "SMA50 croise au-dessus SMA200", "Prix passe sous SMA200"], answer: 2 },
        { q: "Quand le prix est AU-DESSUS de la SMA200, cela indique :", options: ["Tendance baissière long terme", "Tendance haussière long terme", "Signal de vente", "Volatilité extrême"], answer: 1 },
        { q: "Un 'Death Cross' est considéré comme :", options: ["Signal haussier fort", "Signal baissier fort", "Signal neutre", "Signal de sortie de range"], answer: 1 },
      ],
      en: [
        { q: "The SMA50 represents:", options: ["Average of last 50 volumes", "Average of last 50 closing prices", "RSI over 50 days", "Sum of last 50 prices"], answer: 1 },
        { q: "The difference between SMA and EMA is that EMA:", options: ["Ignores recent data", "Gives more weight to recent data", "Is calculated over fewer periods", "Is identical to SMA"], answer: 1 },
        { q: "A 'Golden Cross' is:", options: ["SMA50 crossing below SMA200", "SMA200 crossing above SMA50", "SMA50 crossing above SMA200", "Price falling below SMA200"], answer: 2 },
        { q: "When price is ABOVE the SMA200, it indicates:", options: ["Long-term downtrend", "Long-term uptrend", "Sell signal", "Extreme volatility"], answer: 1 },
        { q: "A 'Death Cross' is considered:", options: ["Strong bullish signal", "Strong bearish signal", "Neutral signal", "Range breakout signal"], answer: 1 },
      ],
    },
  },

  {
    id: 5, level: "Intermédiaire", emoji: "⚡",
    title:    { fr: "Gestion du risque — Position Sizing", en: "Risk Management — Position Sizing" },
    duration: "15 min",
    desc: {
      fr: "Règle des 1-2%, ratio Risk/Reward, Kelly Criterion.",
      en: "1-2% rule, Risk/Reward ratio, Kelly Criterion.",
    },
    content: {
      fr: `
## La règle fondamentale des 1-2%

Ne jamais risquer plus de **1 à 2% de son capital total** sur un seul trade. C'est la règle n°1 de la survie en trading.

**Exemple concret** :
- Capital = 10 000$
- Risque max par trade = 200$ (2%)
- Stop-loss à 5% sous l'entrée
- Taille de position max = 200$ / 5% = **4 000$** (40% du capital max)

## Ratio Risk/Reward (R:R)

Ne prendre un trade que si le gain potentiel est au moins **2× le risque** pris.

| R:R | Win Rate nécessaire pour être profitable |
|-----|----------------------------------------|
| 1:1 | > 50% |
| 2:1 | > 33% |
| 3:1 | > 25% |

**Avec un R:R de 2:1, tu peux avoir raison seulement 34% du temps et rester profitable sur le long terme.**

## Kelly Criterion

Formule mathématique pour optimiser la taille de position (développée pour les jeux de hasard, adaptée au trading) :

\`\`\`
f* = (p × b - q) / b

f* = fraction optimale du capital à investir
p  = probabilité de gain estimée
q  = probabilité de perte (1 - p)
b  = ratio gain moyen / perte moyenne
\`\`\`

**Exemple** : p = 55%, b = 2 → f* = (0.55×2 - 0.45) / 2 = **32.5%**

En pratique, on utilise la **demi-Kelly** (f*/2) pour réduire la volatilité du portefeuille.

## Drawdown et ruine

**Drawdown maximum** : Perte cumulée depuis le dernier sommet du capital.

Avec la règle des 2% : pour subir un drawdown de 50%, il faudrait **perdre 35 trades de suite** — statistiquement quasi impossible avec une bonne stratégie.

## Application sur ThePnLab

Le bot investit **8% du cash** par trade — une règle conservative qui évite la ruine même avec 10 pertes consécutives. Compare les equity curves USER vs IA dans l'onglet Portfolio.
      `,
      en: `
## The 1-2% Rule

Never risk more than **1-2% of total capital** on a single trade.

**Example**: Capital = $10,000 → Max risk per trade = $200 (2%) → With 5% stop-loss → Max position = $4,000

## Risk/Reward Ratio

Only take trades where potential gain is at least **2× the risk**.

| R:R | Win Rate needed to be profitable |
|-----|----------------------------------|
| 1:1 | > 50% |
| 2:1 | > 33% |
| 3:1 | > 25% |

## Kelly Criterion

\`\`\`
f* = (p × b - q) / b
p = win probability, q = loss probability, b = win/loss ratio
\`\`\`

Use **half-Kelly** (f*/2) in practice to reduce portfolio volatility.
      `,
    },
    quiz: {
      fr: [
        { q: "La règle des 2% signifie :", options: ["Ne jamais perdre plus de 2% de son capital total par trade", "Toujours prendre 2% de profit", "Investir 2% de son salaire chaque mois", "Utiliser un levier de 2x maximum"], answer: 0 },
        { q: "Le ratio Risk/Reward de 1:2 signifie :", options: ["On risque 2 pour gagner 1", "On risque 1 pour gagner 2", "On risque 2% pour gagner 2%", "Stop Loss = 2× Take Profit"], answer: 1 },
        { q: "Un stop-loss est :", options: ["Un ordre qui déclenche un achat", "Un niveau de prix qui déclenche une vente pour limiter les pertes", "Un indicateur technique", "Une stratégie de scalping"], answer: 1 },
        { q: "Avec un capital de $10 000 et la règle des 2%, le max de perte par trade est :", options: ["$200", "$20", "$2000", "$500"], answer: 0 },
        { q: "La diversification sert à :", options: ["Maximiser les gains sur un seul actif", "Réduire le risque en répartissant les investissements", "Augmenter le levier global", "Concentrer le capital sur les meilleures opportunités"], answer: 1 },
      ],
      en: [
        { q: "The 2% rule means:", options: ["Never lose more than 2% of total capital per trade", "Always take 2% profit", "Invest 2% of salary monthly", "Use maximum 2x leverage"], answer: 0 },
        { q: "A Risk/Reward ratio of 1:2 means:", options: ["Risk 2 to gain 1", "Risk 1 to gain 2", "Risk 2% to gain 2%", "Stop Loss = 2× Take Profit"], answer: 1 },
        { q: "A stop-loss is:", options: ["An order that triggers a buy", "A price level that triggers a sell to limit losses", "A technical indicator", "A scalping strategy"], answer: 1 },
        { q: "With $10,000 capital and the 2% rule, max loss per trade is:", options: ["$200", "$20", "$2000", "$500"], answer: 0 },
        { q: "Diversification serves to:", options: ["Maximize gains on a single asset", "Reduce risk by spreading investments", "Increase overall leverage", "Concentrate capital on best opportunities"], answer: 1 },
      ],
    },
  },

  {
    id: 6, level: "Intermédiaire", emoji: "🌊",
    title:    { fr: "Bandes de Bollinger", en: "Bollinger Bands" },
    duration: "12 min",
    desc: {
      fr: "Volatilité, squeeze, breakout, stratégie mean-reversion.",
      en: "Volatility, squeeze, breakout, mean-reversion strategy.",
    },
    content: {
      fr: `
## Construction mathématique

Les Bandes de Bollinger (John Bollinger, 1983) sont construites autour d'une SMA20 :

\`\`\`
Bande centrale  = SMA(20)
Bande supérieure = SMA(20) + 2σ
Bande inférieure = SMA(20) − 2σ

σ = écart-type des 20 derniers prix de clôture
σ = √(Σ(Pi - SMA)² / 20)
\`\`\`

Le paramètre **2σ** est choisi car il encadre ~95% de la distribution normale (théorème de Tchebyshev).

## Interprétation de la largeur des bandes

**Bandes larges** → haute volatilité (marchés agités, news importantes)
**Bandes étroites (squeeze)** → faible volatilité, compression → **explosion imminente**

Le **%B indicator** mesure la position du prix dans les bandes :
\`\`\`
%B = (Prix - Bande inf) / (Bande sup - Bande inf)
%B = 1 → prix sur bande supérieure
%B = 0 → prix sur bande inférieure
%B = 0.5 → prix sur la bande centrale (SMA20)
\`\`\`

## Deux stratégies opposées

**Mean-Reversion (marchés sans tendance)** :
- Prix touche la bande inférieure → achat, objectif bande centrale
- Prix touche la bande supérieure → vente, objectif bande centrale
- Condition : bandes relativement stables (pas de squeeze)

**Breakout (marchés en tendance)** :
- Prix sort de la bande supérieure avec volume élevé → continuation haussière
- Prix sort de la bande inférieure avec volume → continuation baissière
- Condition : précédé d'un squeeze (compression de volatilité)

## Bollinger Squeeze — Le setup le plus puissant

Quand les bandes se compriment au maximum historique, une explosion de volatilité est imminente. La direction n'est pas prévisible — attendre la cassure pour confirmer.

Sur ThePnLab, active les **Bollinger Bands** via le bouton "+ Bollinger" sur le graphique. Observe le squeeze sur BTC en période de faible activité.
      `,
      en: `
## Mathematical Construction

\`\`\`
Middle Band  = SMA(20)
Upper Band   = SMA(20) + 2σ
Lower Band   = SMA(20) − 2σ
σ = standard deviation of last 20 closing prices
\`\`\`

The **2σ** parameter captures ~95% of price action.

## Two Opposite Strategies

**Mean-Reversion** (ranging markets): Price touches lower band → buy, target middle band.

**Breakout** (trending markets): Price breaks above upper band with high volume → bullish continuation.

## Bollinger Squeeze

When bands compress to historical minimum, a volatility explosion is imminent. Wait for the breakout direction to confirm entry.
      `,
    },
  },

  {
    id: 7, level: "Avancé", emoji: "🏦",
    title:    { fr: "Market Microstructure", en: "Market Microstructure" },
    duration: "20 min",
    desc: {
      fr: "Order book, bid-ask spread, market impact, slippage.",
      en: "Order book, bid-ask spread, market impact, slippage.",
    },
    content: {
      fr: `
## Le carnet d'ordres (Order Book)

L'order book est la liste en temps réel de tous les ordres d'achat (bids) et de vente (asks) en attente à différents prix.

**Bid** : Prix maximum qu'un acheteur est prêt à payer
**Ask** : Prix minimum qu'un vendeur accepte
**Spread** = Ask − Bid → coût implicite de chaque transaction

Pour AAPL (actions liquides) : spread ≈ 0.01$ (1 centime)
Pour une small-cap illiquide : spread peut atteindre 1-5%

## Types d'ordres

**Market order** : Exécution immédiate au meilleur prix disponible
→ Certitude d'exécution, mais prix incertain (surtout sur actifs illiquides)

**Limit order** : Exécution uniquement au prix spécifié ou mieux
→ Prix certain, mais risque de non-exécution

**Stop-loss order** : Déclenché quand le prix atteint un seuil prédéfini
→ Protection automatique contre les pertes

**Stop-limit order** : Combinaison stop + limit
→ Évite le slippage mais risque de non-exécution en marché rapide

## Market Impact & Slippage

**Slippage** : Différence entre le prix attendu et le prix réel d'exécution.

Pour un gros ordre sur un actif peu liquide :
\`\`\`
Prix moyen d'exécution > Prix affiché (pour un achat)
Prix moyen d'exécution < Prix affiché (pour une vente)
\`\`\`

**Impact de marché** : En achetant, on déplace le marché à la hausse. Les algorithmes HFT l'exploitent.

**Modèle de coût de transaction** :
\`\`\`
Coût total = Spread/2 + Slippage + Commission + Impact
\`\`\`

## Liquidité et profondeur de marché

Un actif liquide (BTC, AAPL, EURUSD) a :
- Spread faible (< 0.1%)
- Carnet d'ordres profond (gros volumes à chaque niveau de prix)
- Slippage minimal même sur gros ordres

Sur ThePnLab, on simule **5 bps de slippage** (0.05%) + **0.1% de frais** pour reproduire les conditions réelles d'exécution.
      `,
      en: `
## The Order Book

Real-time list of all pending buy (bids) and sell (asks) orders at different prices.

**Spread** = Ask − Bid → implicit transaction cost

## Order Types

**Market order**: Immediate execution at best available price (certain execution, uncertain price)
**Limit order**: Execution only at specified price (certain price, uncertain execution)
**Stop-loss**: Triggered when price reaches a threshold (automatic loss protection)

## Slippage & Market Impact

**Slippage**: Difference between expected and actual execution price. Larger for illiquid assets and big orders.

**Total transaction cost** = Spread/2 + Slippage + Commission + Market Impact

ThePnLab simulates **5bps slippage** + **0.1% fees** to replicate real execution conditions.
      `,
    },
  },

  {
    id: 8, level: "Avancé", emoji: "📐",
    title:    { fr: "Value at Risk (VaR) & CVaR", en: "Value at Risk (VaR) & CVaR" },
    duration: "25 min",
    desc: {
      fr: "VaR paramétrique, historique, Monte Carlo. CVaR/Expected Shortfall. Formulation comme programme d'optimisation.",
      en: "Parametric, historical, Monte Carlo VaR. CVaR/Expected Shortfall. Optimization formulation.",
    },
    content: {
      fr: `
## Définition formelle (source : Polycopié Dauphine M2, Royer 2022)

Soit **z** une valeur aléatoire et **α ∈ (0,1)** un niveau de sûreté.

> La **Value at Risk α** de z est la valeur δ telle que :
> **P(z ≥ δ) = 1 − α**
> On note : VaRα[z] = δ

**Interprétation** : VaR(95%, 1j) = −500$ signifie *"Dans 95% des cas, je ne perdrai pas plus de 500$ sur 1 jour."*

## Trois méthodes de calcul

### 1. VaR Historique
Trier les rendements historiques par ordre croissant et prendre le percentile (1−α).

**Exemple** : Sur 500 jours de données, VaR(99%) = 5ème pire journée.

Avantages : simple, basée sur données réelles
Inconvénients : ne capture pas les événements extrêmes rares (queues épaisses)

### 2. VaR Paramétrique (Variance-Covariance)

Suppose des rendements normalement distribués :

\`\`\`
VaR = μ − z_α × σ × Valeur du portefeuille

z_α = 1.645 pour α = 95%
z_α = 2.326 pour α = 99%
z_α = 3.090 pour α = 99.9%
\`\`\`

**Exemple (Polycopié Dauphine)** : Si z ~ N(μ, σ²), alors VaR₀.₉₉[z] = μ + 2.33σ

### 3. VaR Monte Carlo
Simuler des milliers de scénarios aléatoires basés sur la volatilité et les corrélations historiques. La plus précise, mais computationnellement intensive.

## CVaR — Conditional Value at Risk

**Problème de la VaR** : Elle n'est pas une mesure de risque cohérente car :
VaRα[z + y] ≤ VaRα[z] + VaRα[y] n'est **pas** toujours vérifiée
→ Diversifier un portefeuille n'apporte pas de robustesse au sens de la VaR !

**Solution : la CVaR** (aussi appelée Expected Shortfall) :

> CVaRα[z] = E[z | z ≥ VaRα[z]]
> *"En cas de dépassement de la VaR, quelle est la perte moyenne ?"*

**Exemple (Polycopié Dauphine)** : Si z ~ N(μ, σ²), alors CVaR₀.₉₉[z] = μ + 2.67σ

## CVaR comme programme d'optimisation (Théorème 4.3.1, Dauphine)

La CVaR peut être calculée via un **programme stochastique** :

\`\`\`
CVaRα[z] = min_{δ,u} δ + 1/(1-α) × E[u]

sous contraintes :
  u ≥ z - δ
  u ≥ 0
\`\`\`

Dans le cadre d'une approche par scénarios (K scénarios, probabilités pₖ) :

\`\`\`
CVaRα[z] = min_{δ, u₁,...,uₖ} δ + 1/(1-α) × Σ pₖ × uₖ

sous contraintes :
  uₖ ≥ zₖ - δ  ∀k = 1,...,K
  uₖ ≥ 0       ∀k = 1,...,K
\`\`\`

C'est un **programme linéaire** — soluble efficacement même pour des milliers de scénarios.

## Limites célèbres — Crise 2008

La VaR a échoué lors de la crise de 2007-2008 car les corrélations entre actifs **explosent en période de stress** (elles tendent vers 1). Les modèles supposaient des corrélations stables — hypothèse totalement fausse en période de crise systémique. Bâle III impose désormais la CVaR (Expected Shortfall) comme mesure de référence.
      `,
      en: `
## Formal Definition (Dauphine M2 Polycopié, Royer 2022)

Let **z** be a random value and **α ∈ (0,1)** a confidence level.

> **VaRα** of z is the value δ such that: **P(z ≥ δ) = 1 − α**

**Interpretation**: VaR(95%, 1d) = −$500 means "In 95% of cases, I won't lose more than $500 in one day."

## Three Calculation Methods

**Historical VaR**: Sort historical returns, take the (1−α) percentile.

**Parametric VaR**: Assumes normal distribution:
\`\`\`
VaR = μ − z_α × σ × Portfolio Value
z_α = 1.645 (95%), 2.326 (99%)
\`\`\`

**Monte Carlo VaR**: Simulate thousands of scenarios. Most accurate but computationally intensive.

## CVaR (Expected Shortfall)

VaR is **not subadditive**: VaRα[z + y] ≤ VaRα[z] + VaRα[y] doesn't always hold → diversification provides no robustness under VaR.

CVaR fixes this: **CVaRα[z] = E[z | z ≥ VaRα[z]]**

## CVaR as an Optimization Program (Theorem 4.3.1, Dauphine)

\`\`\`
CVaRα[z] = min_{δ,u} δ + 1/(1-α) × E[u]
s.t.  u ≥ z − δ,  u ≥ 0
\`\`\`

Under scenario approach (K scenarios): this becomes a **linear program**.
      `,
    },
  },

  {
    id: 9, level: "Avancé", emoji: "⚖️",
    title:    { fr: "Modèle de Markowitz — Optimisation de Portefeuille", en: "Markowitz Model — Portfolio Optimization" },
    duration: "30 min",
    desc: {
      fr: "Frontière efficiente, programme quadratique, portefeuille tangent, Two-Fund Theorem.",
      en: "Efficient frontier, quadratic programming, tangent portfolio, Two-Fund Theorem.",
    },
    content: {
      fr: `
## Harry Markowitz — Prix Nobel d'Économie 1990

Le **modèle de Markowitz** (1952) fonde la théorie moderne du portefeuille : il démontre mathématiquement qu'un portefeuille diversifié réduit le risque sans nécessairement réduire le rendement.

## Notations (Polycopié Dauphine, Chapitre 3)

On considère **n actifs** avec :
- **µᵢ = E[rᵢ]** : rendement moyen de l'actif i
- **σᵢ²** : variance de l'actif i
- **V = [σᵢⱼ]** : matrice de covariance n×n (symétrique semi-définie positive)
- **x ∈ Rⁿ** : vecteur des pourcentages du portefeuille (xᵢ ≥ 0, Σxᵢ = 1)

## Trois formulations équivalentes

### Formulation A — Risque minimal avec rendement garanti

\`\`\`
minimiser   (1/2) xᵀVx
x ∈ Rⁿ

sous :  µᵀx ≥ µ̄    (rendement minimum garanti)
        eᵀx = 1     (somme des poids = 1)
\`\`\`

### Formulation B — Rendement maximal avec risque contrôlé

\`\`\`
maximiser   µᵀx
x ∈ Rⁿ

sous :  (1/2) xᵀVx ≤ σ²/2   (variance bornée)
        eᵀx = 1
\`\`\`

### Formulation C — Approche de Markowitz (γ-pondérée)

\`\`\`
maximiser   µᵀx − (γ/2) xᵀVx
x ∈ Rⁿ

sous :  eᵀx = 1
\`\`\`

Le paramètre **γ > 0** contrôle le compromis risque/rendement :
- γ → 0 : maximise uniquement le rendement (risque neutre)
- γ → ∞ : minimise uniquement la variance (risque minimal)

## Solution analytique — Portefeuilles particuliers

Si **V est inversible** (matrice définie positive), deux portefeuilles remarquables existent :

**Portefeuille de risque minimum** :
\`\`\`
xᴿ = V⁻¹e / (eᵀV⁻¹e)
\`\`\`

**Portefeuille tangent** (maximise le ratio de Sharpe) :
\`\`\`
xᵀ = V⁻¹µ / (eᵀV⁻¹µ)
\`\`\`

## Two-Fund Theorem (Théorème 3.3.1, Dauphine)

> Toute solution efficiente est une **combinaison linéaire** du portefeuille de risque minimum et du portefeuille tangent :
> **x* = α × xᴿ + (1−α) × xᵀ**,  α ∈ R

Ce théorème justifie l'existence des **fonds indiciels** : en combinant seulement 2 fonds bien construits, un investisseur peut atteindre n'importe quel point de la frontière efficiente.

## Ratio de Sharpe

\`\`\`
Sharpe = (Rp − Rf) / σp

Rp = rendement du portefeuille
Rf = taux sans risque (ex: OAT 10 ans)
σp = volatilité annualisée
\`\`\`

Sharpe > 1 : bon | > 2 : très bon | > 3 : exceptionnel (ou suspect)

## Limites et extensions

La MPT suppose des rendements **normalement distribués** et des corrélations **stables** — deux hypothèses fausses en période de crise (corrélations → 1, queues épaisses).

Extensions modernes :
- **Black-Litterman** : intègre les vues du gestionnaire dans la matrice de covariance
- **Risk Parity** : égalise la contribution au risque de chaque actif
- **Robust Optimization** : optimise le pire cas plutôt que le cas moyen
      `,
      en: `
## Harry Markowitz — Nobel Prize in Economics 1990

**Modern Portfolio Theory** (1952): diversification reduces risk without necessarily reducing returns.

## Notation (Dauphine M2 Polycopié, Chapter 3)

n assets with mean returns **µ**, covariance matrix **V**, portfolio weights **x** (xᵢ ≥ 0, Σxᵢ = 1).

## Three Equivalent Formulations

**A — Minimum risk with guaranteed return:**
\`\`\`
min  (1/2) xᵀVx    s.t.  µᵀx ≥ µ̄,  eᵀx = 1
\`\`\`

**B — Maximum return with bounded risk:**
\`\`\`
max  µᵀx    s.t.  (1/2) xᵀVx ≤ σ²/2,  eᵀx = 1
\`\`\`

**C — Markowitz mean-variance approach:**
\`\`\`
max  µᵀx − (γ/2) xᵀVx    s.t.  eᵀx = 1
\`\`\`

γ controls risk/return tradeoff: γ→0 maximizes return, γ→∞ minimizes variance.

## Special Portfolios (V invertible)

**Minimum variance**: xᴿ = V⁻¹e / (eᵀV⁻¹e)
**Tangent portfolio**: xᵀ = V⁻¹µ / (eᵀV⁻¹µ)

## Two-Fund Theorem (Theorem 3.3.1, Dauphine)

Every efficient portfolio is a linear combination: **x* = α × xᴿ + (1−α) × xᵀ**

## Sharpe Ratio

\`\`\`
Sharpe = (Rp − Rf) / σp
\`\`\`

> 1: good | > 2: very good | > 3: exceptional
      `,
    },
  },

  {
    id: 10, level: "Avancé", emoji: "🌐",
    title:    { fr: "Macro & Marchés", en: "Macro & Markets" },
    duration: "20 min",
    desc: {
      fr: "Fed, BCE, taux directeurs, inflation, corrélations macro-marchés.",
      en: "Fed, ECB, interest rates, inflation, macro-market correlations.",
    },
    content: {
      fr: `
## Le rôle des banques centrales

**Fed (US)** et **BCE (Europe)** contrôlent les **taux directeurs** — le coût auquel les banques commerciales empruntent, qui se répercute sur l'ensemble de l'économie.

### Hausse des taux →
- Crédit plus cher → moins d'investissement des entreprises
- Obligations plus attractives → rotation hors actions (surtout growth/tech)
- Dollar se renforce (effet sur les multinationales)
- Immobilier sous pression (crédits plus chers)
- **Impact actions : négatif, surtout secteurs endettés et tech**

### Baisse des taux →
- Stimulus économique, crédit accessible
- Obligations moins rentables → flux vers actions
- **Impact actions : positif**

## Inflation et marchés

**Inflation modérée (2%)** : Saine, compatible avec croissance des bénéfices

**Inflation forte (>5%)** :
- Mauvaise pour les obligations (taux réel négatif)
- Mixte pour les actions :
  - Entreprises avec **pricing power** (LVMH, Apple, NVIDIA) → résistent
  - Entreprises à marges faibles, très endettées → souffrent

**Déflation** : Très dangereuse (spirale déflationniste) — les banques centrales l'évitent à tout prix.

## Cycle économique et rotation sectorielle

| Phase | Secteurs favorisés |
|-------|-------------------|
| Expansion | Tech, Conso discrétionnaire |
| Surchauffe | Énergie, Matières premières |
| Récession | Défensifs (santé, utilities) |
| Reprise | Finance, Industrie |

## Indicateurs macro à surveiller

- **NFP (Non-Farm Payrolls)** : Emploi US, 1er vendredi du mois → volatilité élevée
- **CPI (Consumer Price Index)** : Inflation US, ~15 du mois
- **PMI (Purchasing Managers Index)** : Activité économique, début du mois (>50 = expansion)
- **Fed Funds Rate & FOMC** : Décisions de taux, 8 fois par an
- **Yield Curve** : Courbe des taux — inversion (taux 2ans > 10ans) = signal de récession

Ces publications créent de la volatilité → le score de risque macro dans l'onglet **News** de ThePnLab en tient compte.
      `,
      en: `
## The Role of Central Banks

**Fed** and **ECB** control interest rates — the cost of money in the economy.

**Rate hikes →** More expensive credit, bonds more attractive, rotation out of equities (especially tech). **Bearish for stocks.**

**Rate cuts →** Economic stimulus, capital flows into equities. **Bullish for stocks.**

## Inflation & Markets

**Moderate inflation (2%)**: Healthy, compatible with earnings growth.
**High inflation (>5%)**: Bad for bonds. Mixed for stocks — companies with pricing power (Apple, LVMH) resist; highly leveraged companies struggle.

## Economic Cycle & Sector Rotation

| Phase | Favored Sectors |
|-------|----------------|
| Expansion | Tech, Consumer discretionary |
| Overheating | Energy, Materials |
| Recession | Defensives (healthcare, utilities) |
| Recovery | Financials, Industrials |

## Key Macro Indicators

- **NFP**: US employment, 1st Friday of month
- **CPI**: US inflation, ~15th of month
- **PMI**: Economic activity (>50 = expansion)
- **Fed Funds Rate**: 8 decisions per year
- **Yield Curve inversion** (2Y > 10Y): Recession signal
      `,
    },
  },

  {
    id: 11, level: "Expert", emoji: "🤖",
    title:    { fr: "Algorithmic Trading & Backtesting", en: "Algorithmic Trading & Backtesting" },
    duration: "30 min",
    desc: {
      fr: "Backtesting, overfitting, stratégies momentum/mean-reversion, HFT.",
      en: "Backtesting, overfitting, momentum/mean-reversion strategies, HFT.",
    },
    content: {
      fr: `
## Types de stratégies algorithmiques

### Momentum
*"Les gagnants continuent de gagner."* Achète les actifs qui ont le plus performé sur les 3-12 derniers mois. Jegadeesh & Titman (1993) ont démontré sa persistance sur données actions US.

**Fonctionne** dans les marchés en tendance
**Échoue** lors des retournements brutaux (crises)

### Mean-Reversion
*"Les prix reviennent toujours à leur moyenne."* Achète quand le prix s'écarte trop de sa valeur historique (z-score > 2).

**Fonctionne** dans les marchés qui rangent
**Échoue** dans les tendances fortes (le prix peut rester "extrême" longtemps)

### Statistical Arbitrage (Pairs Trading)
Deux actifs historiquement corrélés (ex: Coca-Cola/Pepsi) divergent → vend le plus fort, achète le plus faible en espérant une convergence.

**Signal** : Spread = Prix₁ − β × Prix₂ (β = ratio de couverture via OLS)
**Entrée** : |z-score du spread| > 2
**Sortie** : z-score revient à 0

## Backtesting — Les pièges à éviter

**Survivorship bias** : Tester uniquement sur des entreprises qui existent encore (les faillites sont exclues) → surestime les performances de ~2-4% par an.

**Look-ahead bias** : Utiliser des données futures dans le calcul → résultats impossibles en temps réel.

**Overfitting** : Optimiser trop les paramètres sur l'historique → la stratégie ne fonctionne pas en live.
> **Règle empirique** : Si ta stratégie a plus de paramètres que d'années de données, elle est probablement overfittée.

**Transaction costs** : Ignorer les frais, le slippage et l'impact de marché peut transformer une stratégie perdante en stratégie "gagnante" sur papier.

## Métriques d'évaluation d'une stratégie

\`\`\`
Sharpe annualisé = (Rendement annuel − Rf) / Volatilité annuelle
Sortino Ratio = (Rendement − Rf) / Downside Deviation
Max Drawdown = Max(Sommet − Creux) / Sommet
Calmar Ratio = Rendement annuel / Max Drawdown
\`\`\`

**Seuil minimum acceptable** : Sharpe > 1, Max Drawdown < 20%

## Le bot ThePnLab — limites pédagogiques

Notre bot RSI+MACD est intentionnellement simple. Dans la réalité, les hedge funds utilisent :
- **Machine Learning** (LSTM, Transformers, XGBoost) sur données tick
- **Données alternatives** : sentiment Twitter/Reddit, images satellite (stocks pétroliers), données de crédit
- **Exécution en microsecondes** (HFT — High Frequency Trading)

La complexité n'est pas synonyme de performance : **une stratégie momentum simple sur ETF bat ~80% des hedge funds sur 10 ans** (données SPIVA).
      `,
      en: `
## Types of Algorithmic Strategies

**Momentum**: "Winners keep winning." Buy assets that performed best in past 3-12 months. Proven by Jegadeesh & Titman (1993).

**Mean-Reversion**: "Prices return to their mean." Buy when price deviates from historical average (z-score > 2).

**Pairs Trading**: Two historically correlated assets diverge → sell the stronger, buy the weaker, expecting convergence.

## Backtesting Pitfalls

**Survivorship bias**: Testing only surviving companies overstates performance by ~2-4%/year.
**Look-ahead bias**: Using future data → impossible in real-time.
**Overfitting**: Too many parameters → strategy doesn't work live.
**Transaction costs**: Ignoring fees/slippage can make losing strategies appear profitable.

## Evaluation Metrics

\`\`\`
Sharpe = (Annual Return − Rf) / Annual Volatility
Max Drawdown = Max(Peak − Trough) / Peak
Calmar = Annual Return / Max Drawdown
\`\`\`

Minimum acceptable: Sharpe > 1, Max Drawdown < 20%.
      `,
    },
  },

  {
    id: 12, level: "Expert", emoji: "🎯",
    title:    { fr: "Options & Produits dérivés", en: "Options & Derivatives" },
    duration: "35 min",
    desc: {
      fr: "Call, put, Greeks (Delta, Gamma, Vega, Theta), Black-Scholes, stratégies.",
      en: "Call, put, Greeks (Delta, Gamma, Vega, Theta), Black-Scholes, strategies.",
    },
    content: {
      fr: `
## Qu'est-ce qu'une option ?

Une option donne le **droit** (pas l'obligation) d'acheter (Call) ou vendre (Put) un actif sous-jacent à un prix fixé (**strike K**) jusqu'à une date (**expiration T**).

**Premium (prime)** : Prix payé pour acquérir ce droit → coût maximal pour l'acheteur.

## Payoffs à l'expiration

\`\`\`
Call acheteur  : max(S − K, 0) − Prime
Put acheteur   : max(K − S, 0) − Prime
Call vendeur   : −max(S − K, 0) + Prime
Put vendeur    : −max(K − S, 0) + Prime

S = prix du sous-jacent à expiration
\`\`\`

**Acheteur d'option** : Risque limité (prime), gain potentiellement illimité (call)
**Vendeur d'option** : Gain limité (prime), risque potentiellement illimité (call nu)

## Les Greeks — Sensibilités

**Delta (Δ)** : ∂V/∂S — Sensibilité au prix du sous-jacent
- Call : Δ ∈ [0, 1] | Put : Δ ∈ [−1, 0]
- Δ = 0.5 → option "at the money"
- Interprétation : Δ ≈ probabilité d'exercice

**Gamma (Γ)** : ∂²V/∂S² = ∂Δ/∂S — Taux de variation du Delta
- Maximal "at the money"
- Important pour les market makers qui gèrent le risque delta-neutre

**Vega (ν)** : ∂V/∂σ — Sensibilité à la volatilité implicite
- Toujours positif pour acheteur (hausse de volatilité → hausse de la prime)

**Theta (Θ)** : ∂V/∂t — Décroissance temporelle
- Toujours négatif pour l'acheteur
- Chaque jour qui passe érode la valeur temps de l'option
- Accélère près de l'expiration

**Rho (ρ)** : ∂V/∂r — Sensibilité aux taux d'intérêt

## Modèle Black-Scholes (1973)

Prix d'un call européen :
\`\`\`
C = S × N(d₁) − K × e^(−rT) × N(d₂)

d₁ = [ln(S/K) + (r + σ²/2)T] / (σ√T)
d₂ = d₁ − σ√T

N() = fonction de répartition normale standard
r = taux sans risque
σ = volatilité implicite
\`\`\`

**Hypothèses BS** : volatilité constante, rendements normaux, pas de dividendes, marchés continus → toutes imparfaites mais le modèle reste la référence.

## Stratégies classiques

**Covered Call** : Long action + Short Call → génère des revenus, plafonne le gain
**Protective Put** : Long action + Long Put → assurance contre la baisse
**Straddle** : Long Call + Long Put (même strike) → pari sur forte volatilité dans les deux sens
**Iron Condor** : Vend Call + Put, achète Call + Put plus éloignés → parie sur faible volatilité
      `,
      en: `
## What is an Option?

An option gives the **right** (not obligation) to buy (Call) or sell (Put) an asset at a fixed price (**strike K**) until expiration **T**.

## Payoffs at Expiration

\`\`\`
Call buyer: max(S − K, 0) − Premium
Put buyer:  max(K − S, 0) − Premium
\`\`\`

## The Greeks

**Delta (Δ)** = ∂V/∂S: Price sensitivity. Call: [0,1], Put: [−1,0]
**Gamma (Γ)** = ∂²V/∂S²: Rate of Delta change. Max at-the-money.
**Vega (ν)** = ∂V/∂σ: Volatility sensitivity. Always positive for buyers.
**Theta (Θ)** = ∂V/∂t: Time decay. Always negative for buyers. Accelerates near expiry.

## Black-Scholes Formula (1973)

\`\`\`
C = S × N(d₁) − K × e^(−rT) × N(d₂)
d₁ = [ln(S/K) + (r + σ²/2)T] / (σ√T)
d₂ = d₁ − σ√T
\`\`\`

## Classic Strategies

**Covered Call**: Long stock + Short Call → income generation, capped upside
**Protective Put**: Long stock + Long Put → downside insurance
**Straddle**: Long Call + Long Put (same strike) → bet on high volatility
      `,
    },
  },

  {
    id: 13, level: "Expert", emoji: "🏆",
    title:    { fr: "Psychologie du Trading", en: "Trading Psychology" },
    duration: "20 min",
    desc: {
      fr: "Biais cognitifs, FOMO, discipline, journal de trading.",
      en: "Cognitive biases, FOMO, discipline, trading journal.",
    },
    content: {
      fr: `
## Pourquoi 90% des traders particuliers perdent de l'argent

La raison principale n'est pas technique — c'est **psychologique**. Le cerveau humain n'est pas câblé pour trader : il a évolué pour survivre dans la savane, pas pour gérer des probabilités financières.

## Les biais cognitifs majeurs (Kahneman & Tversky, 1979)

**Aversion aux pertes** : Une perte de 100€ génère ~2× plus de souffrance psychologique qu'un gain de 100€ procure de satisfaction.
→ Conséquence : on garde les pertes trop longtemps ("ça va remonter"), on coupe les gains trop tôt.

**Biais de confirmation** : On cherche et mémorise les informations qui confirment notre position existante, on ignore celles qui la contredisent.
→ Solution : cherche activement les arguments contraires avant d'entrer en position.

**FOMO (Fear Of Missing Out)** : On achète après une forte hausse par peur de rater le mouvement.
→ C'est souvent au pire moment — le retail achète au sommet.

**Biais de récence** : On surpondère les événements récents. Après 3 pertes d'affilée, on hésite. Après 3 gains, on se croit invincible.

**Gambler's Fallacy** : "J'ai perdu 5 fois d'affilée, je vais forcément gagner le prochain trade." Les marchés n'ont pas de mémoire, chaque trade est indépendant.

**Biais d'ancrage** : Prix d'achat de 100$ → même si les fondamentaux ont changé, il est difficile de vendre à 80$ car "le prix juste c'est 100$".

**Excès de confiance** : Après une série de succès, on augmente les tailles de position et réduit la discipline → grosse perte.

## La solution : le système, pas les émotions

Les meilleurs traders ne prennent pas de décisions en temps réel — ils **suivent un système** défini à l'avance, à froid.

\`\`\`
Système type :
• Entrée  : RSI < 30 + MACD haussier + prix > SMA200
• Sortie  : Stop-loss à −3%, Take-profit à +6% (R:R = 2:1)
• Taille  : 2% du capital max par trade
• Timing : Jamais en dehors des heures de marché
\`\`\`

Si les conditions ne sont pas réunies → **pas de trade**. La meilleure décision est souvent de ne rien faire.

## Le journal de trading

Documente **chaque trade** : raison d'entrée, émotions ressenties au moment de l'entrée, résultat, leçon apprise.

Après 50 trades documentés, des patterns émergent :
- Tu découvres que tes meilleures décisions arrivent le matin (esprit reposé)
- Tes pires décisions arrivent après une perte (revenge trading)
- Certains setups te conviennent, d'autres pas

**Sur ThePnLab** : L'onglet Bot IA montre ses "erreurs intentionnelles" — même un algorithme sans émotion peut se tromper. La différence : il ne double pas la mise après une perte.
      `,
      en: `
## Why 90% of Retail Traders Lose Money

The main reason isn't technical — it's **psychological**. The human brain evolved for survival, not for managing financial probabilities.

## Major Cognitive Biases (Kahneman & Tversky, 1979)

**Loss aversion**: Losses feel ~2× worse than equivalent gains feel good. We hold losers too long, cut winners too early.

**Confirmation bias**: We seek information that confirms existing positions. Actively seek counter-arguments.

**FOMO**: Buying after a big rally out of fear of missing out — usually at the worst moment.

**Recency bias**: Overweighting recent events. After 3 losses, we freeze. After 3 gains, we over-size.

**Gambler's Fallacy**: "I've lost 5 times, I must win next." Markets have no memory.

**Overconfidence**: After a winning streak, position sizes increase, discipline decreases → big loss.

## The Solution: System, Not Emotions

\`\`\`
System example:
• Entry  : RSI < 30 + Bullish MACD + Price > SMA200
• Exit   : Stop-loss at −3%, Take-profit at +6% (R:R = 2:1)
• Size   : Max 2% of capital per trade
\`\`\`

If conditions aren't met → **no trade**. The best decision is often to do nothing.

## Trading Journal

Document every trade: entry reason, emotions felt, result, lesson learned. After 50 documented trades, patterns emerge — you'll discover your best and worst trading conditions.
      `,
    },
  },
  {
    id: 14, level: "Expert", emoji: "⚡",
    title:    { fr: "Trading Momentum & High-Beta", en: "Momentum & High-Beta Trading" },
    duration: "15 min",
    desc: {
      fr: "Stratégies agressives pour maximiser le rendement : identification des tendances fortes, ETFs leveragés, position sizing avancé.",
      en: "Aggressive strategies to maximize returns: strong trend identification, leveraged ETFs, advanced position sizing.",
    },
    content: {
      fr: `
## Le trading Momentum : suivre les tendances fortes

Le momentum trading consiste à acheter les actifs qui montent et à vendre ceux qui baissent, en profitant de la persistance des tendances. C'est la stratégie préférée des hedge funds quantitatifs.

**Principe fondamental** : "La tendance est ton amie jusqu'à ce qu'elle prenne fin."

## Les 5 critères du signal Momentum parfait

Un trade momentum idéal réunit :

1. **ADX > 30** — tendance forte et établie (pas de marché en range)
2. **MACD haussier** — croisement récent au-dessus de la ligne signal
3. **RSI 50-65** — momentum en zone saine (pas suracheté)
4. **Volume > 2x** — confirmation institutionnelle
5. **Score composite > 6** — convergence de tous les signaux

## Les actifs High-Beta

Les actifs **high-beta** amplifient les mouvements du marché (β > 1.5) :

- **TQQQ** (3x QQQ) : 3x le Nasdaq. +1% QQQ = +3% TQQQ
- **SOXL** (3x Semis) : 3x l'indice semi-conducteurs
- **NVDL** (2x NVDA) : double l'exposition NVIDIA
- **COIN** : β ≈ 3 avec le Bitcoin
- **MSTR** : proxy Bitcoin avec levier implicite
- **BTC-USD / SOL-USD** : crypto pour la volatilité 24/7

⚠️ Les actifs high-beta peuvent perdre 30%+ en une journée. Position sizing réduit obligatoire.

## Position Sizing selon la conviction

La règle de Kelly fractionnaire adaptée au trading :

| Conviction | Allocation max | Exemple sur $10k |
|------------|---------------|-----------------|
| EXTREME    | 30%           | $3 000          |
| HIGH       | 20%           | $2 000          |
| MEDIUM     | 13%           | $1 300          |
| LOW        | 7%            | $700            |

**Règle d'or** : ne jamais avoir plus de 4 positions simultanées. Concentre le capital sur tes meilleures idées.

## Take Profit et Stop Loss

- **Take Profit à +20%** : prends les gains. Les marchés reviennent toujours.
- **Stop Loss à -7%** : tolérance zéro pour les pertes qui s'accumulent.
- **Pyramiding à +12%** : si la position gagne 12%, tu peux renforcer si le signal reste fort.

## Exemple de trade type

    Actif     : TQQQ
    Prix      : $60.00
    Signal    : ADX 38 + MACD BULL + RSI 55 + Vol 2.8x
    Buy       : $1800 (18% du portfolio $10k)
    Stop Loss : $55.80 (-7%) → perte max $126
    Take Profit: $72.00 (+20%) → gain $360
    R:R       : 2.86:1 ✅

## Sur ThePnLab

Le Bot IA de ThePnLab utilise exactement cette stratégie. Observe les rapports du bot pour comprendre ses raisonnements, et essaie de reproduire ses meilleures décisions manuellement.
      `,
      en: `
## Momentum Trading: Riding Strong Trends

Momentum trading means buying assets that are going up and selling those going down, profiting from trend persistence. It's the preferred strategy of quantitative hedge funds.

**Core principle**: "The trend is your friend until it ends."

## The 5 Criteria for a Perfect Momentum Signal

An ideal momentum trade combines:

1. **ADX > 30** — strong, established trend (not a ranging market)
2. **Bullish MACD** — recent crossover above the signal line
3. **RSI 50-65** — healthy momentum zone (not overbought)
4. **Volume > 2x** — institutional confirmation
5. **Composite score > 6** — convergence of all signals

## High-Beta Assets

**High-beta** assets amplify market moves (β > 1.5):

- **TQQQ** (3x QQQ): triples the Nasdaq. +1% QQQ = +3% TQQQ
- **SOXL** (3x Semis): 3x the semiconductor index
- **NVDL** (2x NVDA): doubles NVIDIA exposure
- **COIN**: β ≈ 3 with Bitcoin
- **MSTR**: Bitcoin proxy with implicit leverage

⚠️ High-beta assets can lose 30%+ in one day. Reduced position sizing is mandatory.

## Position Sizing by Conviction

| Conviction | Max allocation | Example on $10k |
|------------|---------------|-----------------|
| EXTREME    | 30%           | $3,000          |
| HIGH       | 20%           | $2,000          |
| MEDIUM     | 13%           | $1,300          |
| LOW        | 7%            | $700            |

**Golden rule**: never have more than 4 simultaneous positions. Concentrate capital on your best ideas.

## Take Profit and Stop Loss

- **Take Profit at +20%**: take the gains. Markets always come back.
- **Stop Loss at -7%**: zero tolerance for accumulating losses.
- **Pyramiding at +12%**: if the position gains 12%, you can add if the signal remains strong.
      `,
    },
  },
  {
    id: 15, level: "Intermédiaire", emoji: "🧠",
    title:    { fr: "Le Machine Learning appliqué au trading", en: "Machine Learning in Trading" },
    duration: "10 min",
    desc: {
      fr: "Comment les algorithmes d'IA analysent les marchés. Win rate, backtest, optimisation continue.",
      en: "How AI algorithms analyze markets. Win rate, backtesting, continuous optimization.",
    },
    content: {
      fr: `
## L'IA dans les marchés financiers

Aujourd'hui, **70%+ des ordres** sur les grandes bourses sont passés par des algorithmes. Comprendre leur logique te donne un avantage.

## Les types d'algorithmes

### 1. Algorithmes de momentum (trend following)
Détectent les tendances avec des indicateurs techniques (MACD, RSI, ADX) et prennent des positions dans le sens de la tendance. C'est ce qu'utilise le Bot IA de ThePnLab.

### 2. Algorithmes de mean reversion
Parient sur le retour à la moyenne. Achètent les oversold (RSI < 30), vendent les overbought (RSI > 70).

### 3. Algorithmes d'arbitrage statistique
Exploitent les corrélations entre actifs liés (ex: or et argent, NVDA et AMD).

## Le Machine Learning en pratique

Le Bot IA de ThePnLab utilise du **ML par renforcement** :

1. **Données d'entrée** : RSI, MACD, ADX, volume, momentum, strikes 52s
2. **Décision** : BUY / SELL / HOLD + montant + confiance
3. **Feedback** : enregistre le résultat de chaque trade (gain ou perte)
4. **Apprentissage** : adapte les futures décisions selon l'historique

## Le Win Rate et le R:R

Deux métriques clés pour évaluer un algorithme :

- **Win Rate** : % de trades gagnants. Un WR de 50% peut être profitable si le R:R est bon.
- **Risk:Reward (R:R)** : rapport entre gain moyen et perte moyenne.

Exemple : WR 40% + R:R 3:1 → Profitable car les gains dépassent les pertes.

## Backtest et overfitting

Le **backtest** teste une stratégie sur données historiques. Attention à l'**overfitting** : si la stratégie est trop optimisée pour le passé, elle échoue sur les données futures.

La règle : valide toujours sur une période que l'algorithme n'a pas vue (out-of-sample testing).

## Sur ThePnLab

Le Bot IA apprend de ses propres trades. Dans les rapports du bot, observe les tickers marqués **[STAR]** (WR > 65%) et **[EVITE]** (WR < 35%). C'est le ML en action.
      `,
      en: `
## AI in Financial Markets

Today, **70%+ of orders** on major exchanges are placed by algorithms. Understanding their logic gives you an edge.

## Types of Algorithms

### 1. Momentum algorithms (trend following)
Detect trends using technical indicators (MACD, RSI, ADX) and take positions in the trend direction. This is what ThePnLab's AI Bot uses.

### 2. Mean reversion algorithms
Bet on price returning to average. Buy oversold (RSI < 30), sell overbought (RSI > 70).

### 3. Statistical arbitrage algorithms
Exploit correlations between related assets (e.g., gold and silver, NVDA and AMD).

## Machine Learning in Practice

ThePnLab's AI Bot uses **reinforcement learning**:

1. **Inputs**: RSI, MACD, ADX, volume, momentum, 52-week strikes
2. **Decision**: BUY/SELL/HOLD + amount + confidence
3. **Feedback**: records the result of each trade (win or loss)
4. **Learning**: adapts future decisions based on history

## Win Rate and R:R

Two key metrics to evaluate an algorithm:

- **Win Rate**: % of winning trades. A 50% WR can be profitable with a good R:R.
- **Risk:Reward (R:R)**: ratio of average gain to average loss.

Example: 40% WR + 3:1 R:R → Profitable because gains exceed losses.
      `,
    },
  },
  {
    id: 16, level: "Débutant", emoji: "🛡️",
    title:    { fr: "Gestion du risque — La règle des 2%", en: "Risk Management — The 2% Rule" },
    duration: "7 min",
    desc: {
      fr: "La règle fondamentale de survie en trading. Stop loss, position sizing, drawdown maximal.",
      en: "The fundamental survival rule in trading. Stop loss, position sizing, maximum drawdown.",
    },
    content: {
      fr: `
## Pourquoi le risque management est plus important que les signaux

La plupart des traders débutants se concentrent sur l'entrée (quand acheter). Les pros se concentrent sur la sortie (quand vendre et combien risquer).

**Vérité** : tu peux avoir un win rate de 40% et être très profitable si tu gères bien le risque.

## La règle des 2%

Ne jamais risquer plus de **2% de son capital total** sur un seul trade.

Sur un portfolio de $10 000 :
- Risque max par trade = **$200**
- Si stop loss à -5% → position max = $200 / 0.05 = **$4 000**
- Si stop loss à -10% → position max = $200 / 0.10 = **$2 000**

Cette règle garantit qu'après 10 trades perdants consécutifs, il te reste encore **82% de ton capital** (0.98^10 = 0.82).

## Le Stop Loss — ton meilleur ami

Le stop loss est un ordre automatique de vente si le prix descend sous un seuil. Il limite tes pertes.

**Placement du stop loss** :
- Sous un niveau de support technique
- À un pourcentage fixe (-5%, -7%, -10%) selon ta tolérance
- Jamais "dans la bougie" — mettre un peu en dessous du support

**Règle absolue** : ne jamais déplacer un stop loss vers le bas pour "donner plus de chances" à un trade perdant. C'est le début de la catastrophe.

## Le Drawdown Maximum

Le drawdown est la perte maximale depuis un plus haut. Les pros tolèrent un drawdown de :

- **Débutant** : max 10%
- **Intermédiaire** : max 15-20%
- **Expert** : max 25%

Au-delà → stop trading, analyse pourquoi, reviens avec une nouvelle stratégie.

## Position Sizing en pratique

Sur ThePnLab ($10 000 de départ) :

| Trade | Conviction | Risque max | Stop Loss | Position max |
|-------|-----------|-----------|-----------|-------------|
| NVDA  | HIGH      | $300 (3%) | -7%       | $4 286      |
| BTC   | MEDIUM    | $200 (2%) | -10%      | $2 000      |
| SPY   | LOW       | $100 (1%) | -5%       | $2 000      |

## Le piège du revenge trading

Après une perte, l'instinct est de "récupérer" en prenant un gros trade. C'est le **revenge trading** — la cause numéro 1 de ruine des traders.

**Règle** : après 3 trades perdants consécutifs, arrête-toi 24h. Reviens avec un esprit clair.
      `,
      en: `
## Why Risk Management Matters More Than Signals

Most beginner traders focus on entry (when to buy). Pros focus on exit (when to sell and how much to risk).

**Truth**: you can have a 40% win rate and be very profitable with good risk management.

## The 2% Rule

Never risk more than **2% of total capital** on a single trade.

On a $10,000 portfolio:
- Max risk per trade = **$200**
- If stop loss at -5% → max position = $200 / 0.05 = **$4,000**
- If stop loss at -10% → max position = $200 / 0.10 = **$2,000**

This rule guarantees that after 10 consecutive losing trades, you still have **82% of your capital** (0.98^10 = 0.82).

## Stop Loss — Your Best Friend

A stop loss is an automatic sell order if the price falls below a threshold. It limits your losses.

**Placing the stop loss**:
- Below a technical support level
- At a fixed percentage (-5%, -7%, -10%) based on your tolerance
- Never "in the candle" — place slightly below support

**Absolute rule**: never move a stop loss down to "give more chance" to a losing trade. That's the beginning of disaster.

## Maximum Drawdown

Drawdown is the maximum loss from a peak. Pros tolerate:

- **Beginner**: max 10%
- **Intermediate**: max 15-20%
- **Expert**: max 25%

Beyond that → stop trading, analyze why, come back with a new strategy.
      `,
    },
  },
]

const LEVEL_COLOR = {
  'Débutant':     { bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.3)',  text: '#6EE7B7' },
  'Intermédiaire':{ bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)',  text: '#FCD34D' },
  'Avancé':       { bg: 'rgba(124,58,237,0.1)',  border: 'rgba(124,58,237,0.3)',  text: '#C4B5FD' },
  'Expert':       { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   text: '#FCA5A5' },
}

const LS_KEY = id => `thepnlab_quiz_${id}`

function getPassedCount() {
  return COURSES.filter(c => localStorage.getItem(LS_KEY(c.id)) === 'passed').length
}

/* ── QuizModal ── */
function QuizModal({ course, lang, onClose }) {
  const questions = course.quiz[lang] || course.quiz['fr']
  const [step, setStep]       = useState(0)
  const [selected, setSelected] = useState(null)
  const [answers, setAnswers]  = useState([])
  const [finished, setFinished] = useState(false)

  const current = questions[step]

  function handleOption(idx) {
    if (selected !== null) return
    setSelected(idx)
  }

  function handleNext() {
    if (selected === null) return
    const newAnswers = [...answers, selected]
    if (step + 1 < questions.length) {
      setAnswers(newAnswers)
      setSelected(null)
      setStep(step + 1)
    } else {
      setAnswers(newAnswers)
      setFinished(true)
      const score = newAnswers.filter((a, i) => a === questions[i].answer).length
      if (score >= 3) {
        localStorage.setItem(LS_KEY(course.id), 'passed')
      }
    }
  }

  function handleRetry() {
    setStep(0)
    setSelected(null)
    setAnswers([])
    setFinished(false)
  }

  const score = finished ? answers.filter((a, i) => a === questions[i].answer).length : 0
  const passed = score >= 3

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: 'linear-gradient(135deg,#0F0D1E,#1A1530)',
        border: '1px solid rgba(124,58,237,0.3)',
        borderRadius: 20, padding: 32, maxWidth: 560, width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 24 }}>
          <div style={{ fontFamily:'Syne', fontWeight:800, fontSize:'1.1rem', color:'#fff' }}>
            Quiz — {course.title[lang]}
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:20, padding:0 }}>✕</button>
        </div>

        {!finished ? (
          <>
            {/* Progress */}
            <div style={{ display:'flex', gap:6, marginBottom:24 }}>
              {questions.map((_, i) => (
                <div key={i} style={{
                  flex:1, height:4, borderRadius:2,
                  background: i < step ? '#7C3AED' : i === step ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.08)',
                  transition: 'background 0.2s',
                }} />
              ))}
            </div>

            {/* Question */}
            <div style={{ fontFamily:'DM Sans', fontWeight:600, fontSize:'1rem', color:'#F1F5F9', marginBottom:20, lineHeight:1.5 }}>
              {step + 1}. {current.q}
            </div>

            {/* Options */}
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {current.options.map((opt, i) => {
                let bg = 'rgba(255,255,255,0.04)'
                let border = '1px solid rgba(255,255,255,0.1)'
                let color = 'var(--muted)'
                if (selected !== null) {
                  if (i === current.answer) { bg = 'rgba(16,185,129,0.15)'; border = '1px solid rgba(16,185,129,0.5)'; color = '#6EE7B7' }
                  else if (i === selected && selected !== current.answer) { bg = 'rgba(239,68,68,0.12)'; border = '1px solid rgba(239,68,68,0.4)'; color = '#FCA5A5' }
                } else if (selected === i) {
                  bg = 'rgba(124,58,237,0.15)'; border = '1px solid rgba(124,58,237,0.5)'; color = '#C4B5FD'
                }
                return (
                  <button
                    key={i}
                    onClick={() => handleOption(i)}
                    style={{
                      background: bg, border, borderRadius: 10,
                      color, padding: '12px 16px', cursor: selected !== null ? 'default' : 'pointer',
                      fontFamily: 'DM Sans', fontSize: '0.9rem', textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { if (selected === null) e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)' }}
                    onMouseLeave={e => { if (selected === null) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
                  >
                    <span style={{ fontFamily:'DM Mono', fontSize:'0.78rem', marginRight:10, opacity:0.5 }}>
                      {String.fromCharCode(65 + i)}.
                    </span>
                    {opt}
                  </button>
                )
              })}
            </div>

            {/* Next button */}
            <button
              onClick={handleNext}
              disabled={selected === null}
              style={{
                marginTop: 20, width: '100%', padding: '12px 0',
                background: selected !== null ? 'linear-gradient(135deg,#7C3AED,#4F46E5)' : 'rgba(255,255,255,0.05)',
                border: 'none', borderRadius: 10, cursor: selected !== null ? 'pointer' : 'not-allowed',
                color: selected !== null ? '#fff' : 'rgba(255,255,255,0.3)',
                fontFamily: 'DM Sans', fontWeight: 700, fontSize: '0.95rem',
                transition: 'all 0.15s',
              }}
            >
              {step + 1 < questions.length ? (lang === 'fr' ? 'Suivant →' : 'Next →') : (lang === 'fr' ? 'Terminer' : 'Finish')}
            </button>
          </>
        ) : (
          /* Results */
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>{passed ? '✅' : '❌'}</div>
            <div style={{
              fontFamily: 'Syne', fontSize: '1.6rem', fontWeight: 800,
              color: passed ? '#10B981' : '#EF4444', marginBottom: 8,
            }}>
              {passed ? (lang === 'fr' ? 'Validé !' : 'Passed!') : (lang === 'fr' ? 'Essaie encore' : 'Try again')}
            </div>
            <div style={{ fontFamily:'DM Mono', fontSize:'1.1rem', color:'#F1F5F9', marginBottom:8 }}>
              {score} / {questions.length}
            </div>
            <div style={{ color:'var(--muted)', fontSize:'0.85rem', marginBottom:28 }}>
              {passed
                ? (lang === 'fr' ? 'Tu maîtrises ce cours ! Badge enregistré.' : 'You mastered this course! Badge saved.')
                : (lang === 'fr' ? `Il faut au moins 3/5 pour valider. Score : ${score}/5.` : `You need at least 3/5 to pass. Score: ${score}/5.`)}
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              {!passed && (
                <button onClick={handleRetry} style={{
                  padding:'10px 24px', borderRadius:10, cursor:'pointer',
                  background:'rgba(124,58,237,0.15)', border:'1px solid rgba(124,58,237,0.4)',
                  color:'#C4B5FD', fontFamily:'DM Sans', fontWeight:600, fontSize:'0.9rem',
                }}>
                  {lang === 'fr' ? 'Réessayer' : 'Retry'}
                </button>
              )}
              <button onClick={onClose} style={{
                padding:'10px 24px', borderRadius:10, cursor:'pointer',
                background:'linear-gradient(135deg,#7C3AED,#4F46E5)', border:'none',
                color:'#fff', fontFamily:'DM Sans', fontWeight:600, fontSize:'0.9rem',
              }}>
                {lang === 'fr' ? 'Fermer' : 'Close'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* Rendu Markdown minimaliste */
function MarkdownContent({ text }) {
  return (
    <div style={{ color: 'var(--text)', lineHeight: 1.9, fontSize: '0.91rem' }}>
      {text.trim().split('\n').map((line, i) => {
        if (line.startsWith('## '))
          return <h2 key={i} style={{ fontFamily:'Syne', fontSize:'1.15rem', fontWeight:700, color:'#fff', margin:'28px 0 10px', borderBottom:'1px solid var(--border)', paddingBottom:6 }}>{line.replace('## ','')}</h2>
        if (line.startsWith('### '))
          return <h3 key={i} style={{ fontFamily:'Syne', fontSize:'1rem', fontWeight:700, color:'#9F6CF0', margin:'18px 0 6px' }}>{line.replace('### ','')}</h3>
        if (line.startsWith('```'))
          return null
        if (line.startsWith('- '))
          return (
            <div key={i} style={{ display:'flex', gap:8, margin:'5px 0', paddingLeft:8 }}>
              <span style={{ color:'#7C3AED', flexShrink:0 }}>▸</span>
              <span dangerouslySetInnerHTML={{ __html: line.replace('- ','').replace(/\*\*(.*?)\*\*/g,'<strong style="color:#F1F5F9">$1</strong>') }} />
            </div>
          )
        if (line.startsWith('|'))
          return <div key={i} style={{ fontFamily:'DM Mono', fontSize:'0.8rem', color:'var(--muted)', padding:'2px 8px', borderLeft:'2px solid var(--border)', margin:'2px 0' }}>{line}</div>
        if (line.trim() === '')
          return <div key={i} style={{ height:8 }} />
        const isCode = i > 0 && text.trim().split('\n')[i-1]?.startsWith('```')
        return (
          <p key={i}
            style={{ margin:'4px 0', color: line.startsWith('>') ? '#9F6CF0' : 'var(--muted)', fontStyle: line.startsWith('>') ? 'italic' : 'normal', paddingLeft: line.startsWith('>') ? 12 : 0, borderLeft: line.startsWith('>') ? '3px solid #7C3AED' : 'none' }}
            dangerouslySetInnerHTML={{ __html: line.replace(/^> /,'').replace(/\*\*(.*?)\*\*/g,'<strong style="color:#F1F5F9">$1</strong>').replace(/`(.*?)`/g,'<code style="background:rgba(124,58,237,0.15);padding:1px 5px;border-radius:4px;font-family:DM Mono;font-size:0.85em;color:#C4B5FD">$1</code>') }}
          />
        )
      })}
    </div>
  )
}

export default function Academy() {
  const [selected, setSelected] = useState(null)
  const [filter, setFilter]     = useState('Tous')
  const [lang, setLang]         = useState('fr')
  const [quizOpen, setQuizOpen] = useState(false)
  const [passedCount, setPassedCount] = useState(getPassedCount)

  useEffect(() => {
    const cards = document.querySelectorAll('.course-card')
    cards.forEach((card, i) => {
      card.style.opacity = '0'
      card.style.transform = 'translateY(20px)'
      setTimeout(() => {
        card.style.transition = 'opacity 0.35s ease, transform 0.35s ease'
        card.style.opacity = '1'
        card.style.transform = 'translateY(0)'
      }, i * 50)
    })
  }, [filter])

  const levels   = ['Tous', 'Débutant', 'Intermédiaire', 'Avancé', 'Expert']
  const filtered = filter === 'Tous' ? COURSES : COURSES.filter(c => c.level === filter)

  function handleQuizClose() {
    setQuizOpen(false)
    setPassedCount(getPassedCount())
  }

  const isCoursePassed = c => localStorage.getItem(LS_KEY(c.id)) === 'passed'

  /* ── Vue cours ouvert ── */
  if (selected) {
    const isPassed = isCoursePassed(selected)
    return (
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        {quizOpen && selected.quiz && (
          <QuizModal course={selected} lang={lang} onClose={handleQuizClose} />
        )}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <button onClick={() => setSelected(null)} style={{
            background:'var(--surface)', border:'1px solid var(--border)',
            color:'var(--muted)', borderRadius:8, padding:'7px 16px',
            cursor:'pointer', fontFamily:'DM Sans', fontSize:'0.85rem',
          }}>← Retour aux cours</button>

          {/* Toggle langue */}
          <div style={{ display:'flex', gap:6 }}>
            {[{code:'fr',label:'🇫🇷 FR'},{code:'en',label:'🇬🇧 EN'}].map(l => (
              <button key={l.code} onClick={() => setLang(l.code)} style={{
                padding:'5px 14px', borderRadius:999, cursor:'pointer',
                fontFamily:'DM Sans', fontWeight:600, fontSize:'0.8rem',
                background: lang === l.code ? 'linear-gradient(135deg,#7C3AED,#4F46E5)' : 'var(--surface)',
                border:`1px solid ${lang === l.code ? 'transparent' : 'var(--border)'}`,
                color: lang === l.code ? '#fff' : 'var(--muted)',
              }}>{l.label}</button>
            ))}
          </div>
        </div>

        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:20, padding:36 }}>
          <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:28 }}>
            <div style={{
              width:56, height:56, borderRadius:14,
              background:'linear-gradient(135deg,#7C3AED,#4F46E5)',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.8rem', flexShrink:0,
            }}>{selected.emoji}</div>
            <div>
              <div style={{ fontFamily:'Syne', fontSize:'1.4rem', fontWeight:800, color:'#fff' }}>
                {selected.title[lang]}
              </div>
              <div style={{ display:'flex', gap:8, marginTop:4, flexWrap:'wrap' }}>
                <span style={{
                  fontSize:'0.72rem', fontWeight:600, padding:'2px 10px', borderRadius:999,
                  background:LEVEL_COLOR[selected.level].bg, border:`1px solid ${LEVEL_COLOR[selected.level].border}`, color:LEVEL_COLOR[selected.level].text,
                }}>{selected.level}</span>
                <span style={{ fontSize:'0.72rem', color:'var(--muted)', padding:'2px 8px' }}>⏱ {selected.duration}</span>
                {isPassed && (
                  <span style={{
                    fontSize:'0.72rem', fontWeight:700, padding:'2px 10px', borderRadius:999,
                    background:'rgba(16,185,129,0.15)', border:'1px solid rgba(16,185,129,0.4)', color:'#10B981',
                  }}>✅ {lang === 'fr' ? 'Validé' : 'Passed'}</span>
                )}
              </div>
            </div>
          </div>

          <MarkdownContent text={selected.content[lang]} />

          {selected.quiz && (
            <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border)', display:'flex', justifyContent:'center' }}>
              <button
                onClick={() => setQuizOpen(true)}
                style={{
                  padding: '12px 32px', borderRadius: 12, cursor: 'pointer',
                  background: isPassed ? 'rgba(16,185,129,0.15)' : 'linear-gradient(135deg,#7C3AED,#4F46E5)',
                  border: isPassed ? '1px solid rgba(16,185,129,0.4)' : 'none',
                  color: isPassed ? '#10B981' : '#fff',
                  fontFamily: 'DM Sans', fontWeight: 700, fontSize: '0.95rem',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                {isPassed
                  ? (lang === 'fr' ? '✅ Refaire le quiz' : '✅ Retake quiz')
                  : (lang === 'fr' ? '🎯 Tester mes connaissances' : '🎯 Test my knowledge')}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  /* ── Vue grille ── */
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontFamily:'Syne', fontSize:'1.4rem', fontWeight:800, color:'#fff' }}>
            Académie ThePnLab
          </div>
          <div style={{ color:'var(--muted)', fontSize:'0.83rem', marginTop:2 }}>
            {COURSES.length} cours · Niveau Dauphine MIF · De la bougie japonaise à Markowitz
          </div>
        </div>
        {/* Toggle langue grille */}
        <div style={{ display:'flex', gap:6 }}>
          {[{code:'fr',label:'🇫🇷 FR'},{code:'en',label:'🇬🇧 EN'}].map(l => (
            <button key={l.code} onClick={() => setLang(l.code)} style={{
              padding:'5px 14px', borderRadius:999, cursor:'pointer',
              fontFamily:'DM Sans', fontWeight:600, fontSize:'0.8rem',
              background: lang === l.code ? 'linear-gradient(135deg,#7C3AED,#4F46E5)' : 'var(--surface)',
              border:`1px solid ${lang === l.code ? 'transparent' : 'var(--border)'}`,
              color: lang === l.code ? '#fff' : 'var(--muted)',
            }}>{l.label}</button>
          ))}
        </div>
      </div>

      {/* Barre de progression quiz */}
      <div style={{ margin:'16px 0 8px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'12px 16px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <span style={{ fontFamily:'DM Sans', fontWeight:600, fontSize:'0.83rem', color:'var(--muted)' }}>
            {lang === 'fr' ? 'Progression quiz' : 'Quiz progress'}
          </span>
          <span style={{ fontFamily:'DM Mono', fontSize:'0.83rem', color:'#C4B5FD' }}>
            {passedCount} / {COURSES.length}
          </span>
        </div>
        <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:999, height:6, overflow:'hidden' }}>
          <div style={{
            height:'100%', borderRadius:999,
            width: `${(passedCount / COURSES.length) * 100}%`,
            background: passedCount === COURSES.length
              ? 'linear-gradient(90deg,#10B981,#059669)'
              : 'linear-gradient(90deg,#7C3AED,#4F46E5)',
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* Filtres niveau */}
      <div style={{ display:'flex', gap:8, margin:'20px 0 28px', flexWrap:'wrap' }}>
        {levels.map(l => (
          <button key={l} onClick={() => setFilter(l)} style={{
            padding:'6px 16px', borderRadius:999, cursor:'pointer',
            fontFamily:'DM Sans', fontWeight:600, fontSize:'0.82rem',
            background: filter === l ? 'linear-gradient(135deg,#7C3AED,#4F46E5)' : 'var(--surface)',
            border:`1px solid ${filter === l ? 'transparent' : 'var(--border)'}`,
            color: filter === l ? '#fff' : 'var(--muted)',
            transition:'all 0.15s',
          }}>{l}</button>
        ))}
      </div>

      {/* Grille cours */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:16 }}>
        {filtered.map(c => (
          <div
            key={c.id}
            className="course-card"
            onClick={() => setSelected(c)}
            style={{
              background:'var(--surface)', border:'1px solid var(--border)',
              borderRadius:16, padding:22, cursor:'pointer',
              transition:'opacity 0.35s ease, transform 0.35s ease, border-color 0.2s, box-shadow 0.2s, background 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)'
              e.currentTarget.style.background  = 'rgba(124,58,237,0.06)'
              e.currentTarget.style.transform   = 'translateY(-4px)'
              e.currentTarget.style.boxShadow   = '0 8px 32px rgba(124,58,237,0.15)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.background  = 'var(--surface)'
              e.currentTarget.style.transform   = 'translateY(0)'
              e.currentTarget.style.boxShadow   = 'none'
            }}
          >
            <div style={{ fontSize:'2rem', marginBottom:12 }}>{c.emoji}</div>
            <div style={{
              display:'inline-block', marginBottom:10,
              fontSize:'0.7rem', fontWeight:600, padding:'2px 10px', borderRadius:999,
              background:LEVEL_COLOR[c.level].bg, border:`1px solid ${LEVEL_COLOR[c.level].border}`, color:LEVEL_COLOR[c.level].text,
            }}>{c.level}</div>
            <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:'0.98rem', color:'#fff', marginBottom:8 }}>
              {c.title[lang]}
            </div>
            <div style={{ fontSize:'0.8rem', color:'var(--muted)', lineHeight:1.5, marginBottom:14 }}>
              {c.desc[lang]}
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'0.75rem', color:'var(--muted)' }}>⏱ {c.duration}</span>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                {isCoursePassed(c) && (
                  <span style={{
                    fontSize:'0.7rem', fontWeight:700, padding:'2px 8px', borderRadius:999,
                    background:'rgba(16,185,129,0.15)', border:'1px solid rgba(16,185,129,0.4)', color:'#10B981',
                  }}>✅ {lang === 'fr' ? 'Validé' : 'Passed'}</span>
                )}
                <span style={{ fontSize:'0.78rem', color:'#9F6CF0', fontWeight:600 }}>Lire →</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}