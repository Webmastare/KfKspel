# KfKspel

I denna repo finns all kod för nya KfKspel

## Spel

Just nu finns det 6 spel som alla är spelbara, vissa behöver fortfarande finslipas en del men spela på!

KfKblock

- Det första spelet som webmästeriet släppte på kfkb-hemsidan inför LP4 2024 då vi höll den första tävlingen. Det har nu skrivits om från original spelet till ett vue-baserad spel.

Minesweeper

- Var det andra spelet som kom ut. Det blev i princip färdigt i vanilla JS men hade en del buggar kvar, men nu är det nästan helt implementerat för vue!

Snake

- Påbörjades som det tredje spelet men det blev aldrig publicerat vilket nu också är omskrivet!!

2048

- Ett väldigt enkelt spel att göra så det slängde jag ihop ganska snabbt i vanilla JS och publicerade på kfkb.se men nu är det lite omgjort för att passa den nya layouten.

KfKbandvagn

- Ett brädspelsaktigt spel där alla spelare får tokens för att utföra handlingar, målet är att skjuta andra "bandvagnar". Jag byggde de flesta delar av spelet i JS men det blev ett stort projekt och mycket spagetti-kod, speciellt vad gäller den stackars API:n. Nu är det omskrivet till TS och bättre strukturerat samt att den använder supabase edge functions för alla API calls som är mycket bättre strukturerat. Det är spelbart men saknar ännu några funtioner och det finns nästan oändligt med möjligheter för att lägga till nya saker.

Lights Out

- Helt nytt för KfKspel, gjordes för den nya sidan :)

## Kommande ideér och förbättringar

KfKblock:

- Anti-cheat, use a hash score for the score and validate each tick to detect tampering.
- Pause before game is started shouldn't have timer

KfKbandvagn:

- Max actions per time period e.g. 10 seconds, enforce on client and edge function, UI to show if action is allowed. Disable buttons.

- Update board and player data can happen from the client instead of calling the edge function.
- Subscribe to table changes with real-time.
- On table change we do animations, e.g. moving tanks, shooting etc.

- Start on a larger board and then shrink it once a day forcing players closer together
- Have upgrades on the board that players can move to and pick up, like a long range missile that has unlimited range? Free tokens that can be picked up?

- Reviving players that are dead, consumes 1 token?

## TODO

KfKbandvagn

- Stänger inte create form när man skapar ett nytt konto
- Man får endast 10% av någons tokens när de dör
- Förflyttas snabbare accelerera och få högre fart om man kör längre?
- Förflyttas med range

Skapad av Kasper Storck 2025
