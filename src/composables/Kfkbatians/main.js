/** @type {HTMLCanvasElement} */
export const duken = document.querySelector('#duken')
export const ctx = duken.getContext('2d')

const rect = duken.getBoundingClientRect()

const bredd = duken.width
const höjd = duken.height

const fps = 100
const updatetime = 1000 / fps

import { kontinuerliga, Random, Vector, Animation, fysik, mouse, GameObject } from './brumbrum.js'
import { ångerknapp, ånger } from './regret.js'
import { action, cardAction, längdfix, dubbelklick } from './action.js'
import { knappar, botton } from './andrabrum.js'
import { startmeny, WinenrAnimation } from './startmeny.js'

export class bakgrund {
  static allaBakgrundsObjekt = []

  constructor(xpos, ypos, bredd, höjd, färg) {
    this.x = xpos
    this.y = ypos

    this.width = bredd
    this.height = höjd

    this.color = färg

    bakgrund.allaBakgrundsObjekt.push(this)
  }

  static SetBakgrunden() {
    bakgrund.ClearBakgrund()
    new bakgrund(0, 0, bredd, höjd, '#07ab33')
  }

  static ClearBakgrund() {
    bakgrund.allaBakgrundsObjekt = []
  }
}

export class card extends GameObject {
  static lägstaPosition = 350
  static kortbredd = 45
  static korthöjd = 70
  static baksida = '/kfkbatians/kortbilder/baksida.svg'

  static offsets = 25

  static SynligaKort = []
  static SuperKort = []

  constructor(xpos, ypos, bild, färg, nummer, offset = card.offsets) {
    super(xpos, ypos, card.kortbredd, card.korthöjd, card.baksida, offset)

    this.objekttyp = 'card';
    this.actualBild = bild
    this.isActive = false

    this.oldPosition = new Vector(xpos, ypos)

    this.isTurned = false

    this.färg = färg
    this.nummer = nummer

    this.oldDad
    this.hasOldDad = false

    this.rödsvart

    this.isChildAble = true

    this.behållare
    this.isFromBehållare = false

    if (färg == 'hjärter' || färg == 'ruter') {
      this.rödsvart = 'röd'
    } else if (färg == 'spader' || färg == 'klöver') {
      this.rödsvart = 'svart'
    }
  }

  synligGör() {
    card.SynligaKort.push(this)
  }

  osynligGör() {
    let index = card.SynligaKort.indexOf(this)

    card.SynligaKort.splice(index, 1)
  }

  högstSynlig() {
    let index = card.SynligaKort.indexOf(this)
    if (index >= 0) {
      card.SynligaKort.splice(index, 1)
      card.SynligaKort.push(this)

      if (this.haschild) {
        this.child.högstSynlig()
      }
    }
  }

  klickUpdate() {
    if (this.isActive) {
      //this.cardKlickPrep();
      validklick = true
      this.läggMigLängstUppInteract()
      this.högstSynlig()
    } else {
      let spawnish = this.jagÄrIspawn()
      if (spawnish !== 69 && spawnish.klickUpdate) {
        //spawnish.klickUpdate();
      }
    }
  }

  offKlickUpdate() {
    console.log('offklick initiated');
    //kollar överlapp med andra objekt
    let överlappare = []
    cardAction.ÖverlappMedHög(this, överlappare)
    cardAction.ÖverlappMedLängd(this, överlappare)

    if (överlappare.length > 0) {
      //kollar om reglerna följs
      for (let i = 0; i < överlappare.length; i++) {
        let objekttyp = överlappare[i].objekttyp;
        if (objekttyp === 'behållare') {
          let reglerFöljs = cardAction.ReglerFörBehållare(this, överlappare[i])
          if (reglerFöljs) {
            //gör det som ska göras vid giltigt drag
            let minnen = cardAction.SaveMove(this)
            console.log('behållare, regler följs');
            cardAction.KortTillHög(this, överlappare[i], minnen)
            //kolla om längden ska kortas ned ska vara här
            längdfix.FixaLängder()
            break
          } else if (överlappare.length !== i + 1) {
            //det finns fler överlappare så gör inget, ba fortsätt till nästa
          } else {
            console.log('animation startad 1');
            this.moveTill(this.oldPosition, spawnare.cardMoveTime)
          }
        } else if (objekttyp === 'card') {
          let uret = överlappare[i].hittaUrbarn()
          let reglerFöljs = cardAction.ReglerFörKort(this, uret)

          if (reglerFöljs) {
            //gör det som ska göras vid giltigt drag
            let minnen = cardAction.SaveMove(this)
            console.log('regler följs för kort kort');
            cardAction.KortTillKort(this, överlappare[i], minnen)
            //kolla om längden ska kortas ned ska vara här för
            // att den ska få med senaste kortet som lades till
            console.log('kort till kort fixar längder');
            längdfix.FixaLängder()

            break
          } else if (överlappare.length !== i + 1) {
            //det finns fler överlappare så gör inget, ba fortsätt till nästa
          } else {
            console.log('animation startad 2');
            this.moveTill(this.oldPosition, spawnare.cardMoveTime)
          }
        } else {
          console.log('gick fel på card > offklickupdate')
        }
      }
    } else {
      console.log('animation startad 3');
      this.moveTill(this.oldPosition, spawnare.cardMoveTime)
    }
  }

  spawn() {
    this.addToInteractable()
    this.synligGör()
  }

  kill() {
    this.osynligGör()
    this.removeInteractable()
  }

  jagÄrIbehållare() {
    let längd = behållare.allabehållare.length
    for (let i = 0; i < längd; i++) {
      let nuvarandeBehållare = behållare.allabehållare[i]

      if (nuvarandeBehållare.allakortdenhar.indexOf(this) !== -1) {
        return nuvarandeBehållare
      }
    }

    return 69
  }

  jagÄrIspawn() {
    let längd = spawnare.födare.length
    for (let i = 0; i < längd; i++) {
      let nuvarandeSpawner = spawnare.födare[i]

      if (nuvarandeSpawner.liggandekort.indexOf(this) !== -1) {
        return nuvarandeSpawner
      }
    }

    return 69
  }

  vänd() {
    //console.log('vänder');
    if (this.isTurned) {
      //console.log('baksida');
      this.bytbild(card.baksida)
      this.isTurned = false
      this.isActive = false
    } else {
      //console.log('framsida');
      this.bytbild(this.actualBild)
      this.isTurned = true
      this.isActive = true
    }
  }

  fysikalisk() {
    this.isActive = false
    this.högstSynlig()

    let fysiker = new fysik(this, 5, 0.7)

    return fysiker
  }

  ändrAllaBarnsOldPosition(nyposition) {
    this.oldPosition = nyposition

    if (this.haschild) {
      let ex = nyposition.x
      let ey = nyposition.y + this.offsetY

      let nypos = new Vector(ex, ey)

      this.child.ändrAllaBarnsOldPosition(nypos)
    }
  }
}

class kortlek {
  //static allakortbilder = ['bilder/bitchcoin.png', 'en_fyrkant.png', 'entrea.png', 'fyrra.png', 'bilder/spawner.png'];
  static färg = ['röd', 'svart']

  constructor() {
    this.allakort = []

    this.fyllLeken()
    this.shuffle()
  }

  fyllLeken() {
    let färger = ['hjärter', 'ruter', 'klöver', 'spader']
    let valörer = ['ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king']
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 13; j++) {
        let namnpåbild =
          '/kfkbatians/kortbilder/' + färger[i] + '/' + färger[i] + '_' + valörer[j] + '.svg'

        //console.log(namnpåbild);
        let nyakortet = new card(0, 0, namnpåbild, färger[i], j + 1)

        this.allakort[13 * i + j] = nyakortet
      }
    }
  }

  taÖverstaKortet() {
    let kortet = this.allakort.shift()

    return kortet
  }

  shuffle() {
    let längd = this.allakort.length
    let nyaleken = []

    for (let i = 0; i < längd; i++) {
      let kortKvar = this.allakort.length
      let nummer = Random.Next(1, kortKvar) - 1
      nyaleken[i] = this.allakort[nummer]
      this.allakort.splice(nummer, 1)
    }

    this.allakort = nyaleken
  }
}

export class spawnare extends GameObject {
  static födare = []
  static cardMoveTime = 300
  static redoside = '/kfkbatians/kortbilder/tomlek.svg'

  static counter = 0
  constructor(xpos, ypos, bred, hööjd) {
    super(xpos, ypos, bred, hööjd, card.baksida)

    spawnare.födare.push(this)
    this.lek = new kortlek()
    this.addToInteractable()
    this.liggandekort = []

    this.kortbaksidaVisasv = true

    this.kortpositioner = [new Vector(60, 210), new Vector(60, 175), new Vector(60, 140)]
    //this.kortpositioner = [new Vector(60, 140), new Vector(60, 175), new Vector(60, 210)];
  }

  spawnaHögsta() {
    if (this.lek.allakort.length > 0) {
      spawnare.counter++

      if (difficulty === 'easy') {
        let nyakortet = this.lek.allakort.shift()

        //tänker att man skulle kunna göra en liknande funktion där
        //man lägger tillbaks ett kort

        nyakortet.position.setposition(this.position)
        nyakortet.synligGör()
        nyakortet.addToInteractable()
        nyakortet.vänd()
        nyakortet.isChildAble = false

        //viktigt att move to position är efter att den fått sin position

        this.liggandekort.unshift(nyakortet)
      } else if (difficulty === 'hard') {
        for (let i = 0; i < 3; i++) {
          let nyakortet = this.lek.allakort.shift()

          //tänker att man skulle kunna göra en liknande funktion där
          //man lägger tillbaks ett kort

          nyakortet.position.setposition(this.position)
          nyakortet.synligGör()
          nyakortet.addToInteractable()
          nyakortet.vänd()
          nyakortet.isChildAble = false

          //viktigt att move to position är efter att den fått sin position

          this.liggandekort.unshift(nyakortet)
          this.flyttaLiggandeKort()
          if (this.lek.allakort.length === 0) {
            break
          }
        }
      }

      this.flyttaLiggandeKort()
      if (this.lek.allakort.length === 0) {
        this.bytbild(spawnare.redoside)
      }
    } else if (this.liggandekort.length > 0) {
      this.läggTillbaksKortenAnim()
      setTimeout(() => {
        this.bytbild(card.baksida)
      }, spawnare.cardMoveTime)
    }
  }

  flyttaLiggandeKort() {
    let längd = this.liggandekort.length
    if (längd === 1) {
      let current = this.liggandekort[0]
      current.isActive = true
      current.oldPosition = this.kortpositioner[0]
      current.moveTill(this.kortpositioner[2], spawnare.cardMoveTime)
    } else if (längd === 2) {
      let current = this.liggandekort[0]
      current.isActive = true
      current.oldPosition = this.kortpositioner[0]
      current.moveTill(this.kortpositioner[1], spawnare.cardMoveTime)

      this.liggandekort[1].isActive = false
    } else {
      for (let i = 0; i < längd && i < 3; i++) {
        let current = this.liggandekort[i]

        current.isActive = false
        current.oldPosition = this.kortpositioner[i]
        current.moveTill(this.kortpositioner[i], spawnare.cardMoveTime)

        if (i === 0) {
          current.isActive = true
        } else {
          current.isActive = false
        }
      }
    }
  }

  klickUpdate() {
    let antalkort = 3
    if (this.lek.allakort.length < 3) {
      antalkort = this.lek.allakort.length
    }
    new ånger(3, antalkort, undefined, undefined)
    this.spawnaHögsta()
  }

  taBortkort(removedCard) {
    let index = this.liggandekort.indexOf(removedCard)

    this.liggandekort.splice(index, 1)

    this.flyttaLiggandeKort()
  }

  läggTillbaksKortenAnim() {
    let längd = this.liggandekort.length

    let deSomLadesTillbaks = []

    for (let i = 0; i < längd; i++) {
      let nukort = this.liggandekort[0]

      nukort.moveTill(this.position, spawnare.cardMoveTime)
      nukort.vänd()
      this.lek.allakort.unshift(nukort)
      this.liggandekort.shift()
      deSomLadesTillbaks[i] = nukort
    }

    setTimeout(() => {
      this.dödaKorten(deSomLadesTillbaks)
    }, spawnare.cardMoveTime)
  }

  dödaKorten(allakort) {
    let längd = allakort.length

    for (let i = 0; i < längd; i++) {
      allakort[i].kill()
    }
  }

  ångraKlickande() {
    let längd = this.liggandekort.length
    if (längd === 0) {
      let kortsomskaut = this.lek.allakort.length

      this.bytbild(spawnare.redoside)
      let nyakortet
      for (let i = 0; i < kortsomskaut; i++) {
        nyakortet = this.lek.allakort.shift()
        nyakortet.synligGör()
        nyakortet.addToInteractable()
        nyakortet.vänd()
        nyakortet.position.setposition(this.position)
        nyakortet.moveTill(this.kortpositioner[2], spawnare.cardMoveTime)
        nyakortet.isChildAble = false

        this.liggandekort.unshift(nyakortet)
      }
      nyakortet.isChildAble = true
      this.flyttaLiggandeKort()
    } else {
      let kort = this.liggandekort.shift()

      this.lek.allakort.unshift(kort)

      kort.vänd()

      kort.moveTill(this.position, spawnare.cardMoveTime)

      this.flyttaLiggandeKort()

      setTimeout(() => {
        kort.kill()
        if (this.lek.allakort.length === 1) {
          this.bytbild(card.baksida)
        }
      }, spawnare.cardMoveTime)

      if (this.lek.allakort.length === 0) {
        this.bytbild(spawnare.redoside)
      } else {
        this.bytbild(card.baksida)
      }
    }
  }

  ettKortTillbaks(kort) {
    
    this.liggandekort.unshift(kort);
    this.flyttaLiggandeKort();
  }
}

//kanske borde ha typ "special zone" som man sedan lägger olika scripts på
export class behållare extends GameObject {
  static allabehållare = []
  static synligaBehållare = []
  constructor(xpos, ypos, färg, bild) {
    super(xpos, ypos, card.kortbredd, card.korthöjd, bild);
    behållare.allabehållare.push(this);
    this.addToInteractable();
    this.synligGör();

    this.objekttyp = 'behållare';
    this.allakortdenhar = [];
    this.färg = färg;
    this.överstakortet;
  }

  synligGör() {
    behållare.synligaBehållare.push(this)
  }

  osynligGör() {
    let index = behållare.synligaBehållare.indexOf(this)

    behållare.synligaBehållare.splice(index, 1)
  }

  taBortkort(kort) {
    let index = this.allakortdenhar.indexOf(kort)
    this.allakortdenhar.splice(index, 1)
  }

  static KollaAllaBehållare(krokare) {
    let längd = behållare.allabehållare.length
    for (let i = 0; i < längd; i++) {
      let current = behållare.allabehållare[i]

      let deligger = GameObject.liggerDem(current, krokare)
      if (current.färg === krokare.färg && deligger && krokare.haschild === false) {
        let sträcka = current.allakortdenhar.length

        if (krokare.nummer === sträcka + 1) {
          let minnesAction
          let läggMigI
          let fadernSkaVändas = false

          let spawnish = krokare.jagÄrIspawn()

          if (spawnish !== 69) {
            minnesAction = 1
            läggMigI = spawnish
          }

          if (krokare.hasOldDad) {
            minnesAction = 2
            läggMigI = krokare.oldDad

            if (krokare.oldDad.isTurned === false) {
              fadernSkaVändas = true
            }
          }

          new ånger(minnesAction, krokare, läggMigI, fadernSkaVändas)

          action.KortTillHög(krokare, current)
          /*
                    krokare.goodmove(current.position);
                   

                    current.allakortdenhar.push(krokare);
                    krokare.isChildAble = false;

                    krokare.hasOldDad = false;  
                    */
          let win = behållare.CheckWin()

          if (win) {
            console.log('du vann!')
            setTimeout(behållare.OnWin, spawnare.cardMoveTime + 100)
            playing = false
          }

          return false
        }
      }
    }

    return true
  }

  static OnWin() {
    console.trace('onvin')
    skaSkicka = true
    Clearing = false
    winanimation = true

    knappar.allaKnappar = []
    let nyspelPos = new Vector((3 * bredd) / 5, (4 * höjd) / 5)
    new knappar('Nytt spel', nyspelPos, bredd / 5, höjd / 5, startmeny.NyttSpelKnappen)

    //SkickaUtKortEnEfterEn();
    WinenrAnimation()
  }

  //bestämmer vilken typ av win screen man får
  static VinstFirnade() {}

  static CheckWin() {
    let antal_full = 0
    for (let i = 0; i < behållare.allabehållare.length; i++) {
      if (behållare.allabehållare[i].allakortdenhar.length === 13) {
        antal_full++
      }
    }

    if (antal_full === 4) {
      return true
    }

    return false
  }
}

export class Fusk {
  static Nyttfusk() {}

  static LäggAllaLätt() {
    console.log('fusk imitiated')
    let valörer = ['ruter', 'spader', 'klöver', 'hjärter']
    let behåll = []

    //hittar alla behållare å lägger dem i ordning
    for (let i = 0; i < 4; i++) {
      let interätt = true
      let nummer = 0
      while (interätt) {
        let nubehåll = behållare.allabehållare[nummer]
        if (nubehåll.färg === valörer[i]) {
          interätt = false
          behåll[i] = nubehåll
        } else {
          nummer++
        }
      }
    }
    let counter = 0
    //lägger in alla kort i behållarna börjar mad att ta alla kort för en viss behållare
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 13; j++) {
        if (i === 3 && j === 12) {
          //break;
        }
        let kortet = Fusk.HittaKortet(valörer[i], j)
        counter++
        if (kortet !== 69) {
          //sätter alla dess variabler rätt

          kortet.isActive = true
          if (kortet.haschild) {
            kortet.removeChild()
          }

          if (kortet.hasparent) {
            kortet.removeParent()
          }

          if (kortet.isTurned === false) {
            kortet.vänd()
          }
          kortet.högstSynlig()
          let pos = behåll[i].position

          kortet.position.setposition(pos)

          behållare.KollaAllaBehållare(kortet)
        }
      }
    }

    spawn.bytbild(spawnare.redoside)

    /*
        //lägger hjärer kung på rätt ställe
        let sista = Fusk.HittaKortet(valörer[3], 12);
        let nypos = card.SuperKort[0].position;

        sista.isActive = true;

        if(sista.haschild){
            sista.removeChild();
        }

        if(sista.hasparent){
            sista.removeParent();
        }            
        
        if(sista.isTurned === false){
            sista.vänd();
        }
        sista.position.setposition(nypos);
        sista.offKlickUpdate();
       */
  }

  static HittaKortet(färg, nummer) {
    //kollar alla kort på planen
    nummer++
    for (let i = 0; i < card.SynligaKort.length; i++) {
      let kortet = card.SynligaKort[i]
      let i_behåll = kortet.jagÄrIbehållare() //den ska va 69 för då e den inte i en behållare

      if (kortet.nummer === nummer && kortet.färg === färg && i_behåll === 69) {
        return kortet
      }
    }

    //kollar alla kort i leken
    for (let i = 0; i < spawn.lek.allakort.length; i++) {
      let kortet = spawn.lek.allakort[i]
      //console.log(kortet);
      if (kortet.nummer === nummer && kortet.färg === färg) {
        kortet.spawn()
        let index = spawn.lek.allakort.indexOf(kortet)
        spawn.lek.allakort.splice(index, 1)
        return kortet
      }
    }

    return 69
  }

  static HittaRätt(kort) {
    let bållare = behållare.allabehållare[0]
    let nummer = 0
    while (kort.färg !== bållare.färg) {
      nummer++
      bållare = behållare.allabehållare[nummer]
    }

    let bållposition = bållare.position
    kort.position.setposition(bållposition)

    behållare.KollaAllaBehållare(kort)
  }
}

export class Uskare {
  static StartaFusk() {
    //spawnare.cardMoveTime = 2000;

    console.log('fuskstart')
    let behållar = Uskare.SorteraBehållare()
    let kortlistor = [] //hjärter ruter klöver spader
    kortlistor = Uskare.LäggIallaKortIlistor()
    Uskare.VändOchSpawnaAllaKort(kortlistor)
    Uskare.Föräldrarlös(kortlistor)
    spawn.bytbild(spawnare.redoside)
    Uskare.LäggKortIbehållare(behållar, kortlistor)
  }

  static SorteraBehållare() {
    let antalBehållare = 4
    let temphållare = []

    let färger = ['hjärter', 'ruter', 'klöver', 'spader']

    for (let i = 0; i < antalBehållare; i++) {
      let söker = true
      let räknare = 0
      while (söker) {
        let söktBehållare = behållare.allabehållare[räknare]
        räknare++
        if (söktBehållare.färg === färger[i]) {
          temphållare[i] = söktBehållare
          söker = false
        }
      }
    }

    return temphållare
  }

  static LäggIallaKortIlistor() {
    let tempKortlista = []
    let färger = ['hjärter', 'ruter', 'klöver', 'spader']
    for (let i = 0; i < 4; i++) {
      let tempfärg = []
      for (let j = 0; j < 13; j++) {
        tempfärg[j] = Uskare.HittaKort(färger[i], j + 1)
      }
      tempKortlista[i] = tempfärg
    }
    return tempKortlista
  }

  static HittaKort(färg, nummer) {
    //börja leta i kortleken
    let leklängd = spawn.lek.allakort.length

    for (let i = 0; i < leklängd; i++) {
      let nukort = spawn.lek.allakort[i]

      if (nukort.färg === färg && nukort.nummer === nummer) {
        let indes = spawn.lek.allakort.indexOf(nukort)
        spawn.lek.allakort.splice(indes, 1)
        return nukort
      }
    }

    //om den inte e i leken kanske den är i liggandekort
    let liggandelängd = spawn.liggandekort.length
    for (let i = 0; i < liggandelängd; i++) {
      let nukort = spawn.liggandekort[i]

      if (nukort.färg === färg && nukort.nummer === nummer) {
        let indes = spawn.liggandekort.indexOf(nukort)
        spawn.liggandekort.splice(indes, 1)
        return nukort
      }
    }

    //om det inte låg i spawn så kolla synliga kort
    let antalSynligakort = card.SynligaKort.length

    for (let i = 0; i < antalSynligakort; i++) {
      let nukort = card.SynligaKort[i]

      if (nukort.färg === färg && nukort.nummer === nummer) {
        //let indes = card.SynligaKort.indexOf(nukort);
        //card.SynligaKort.splice(indes, 1);
        return nukort
      }
    }
  }

  static VändOchSpawnaAllaKort(listamedkort) {
    for (let i = 0; i < 4; i++) {
      let kortlistan = listamedkort[i]

      for (let j = 0; j < 13; j++) {
        let kortet = kortlistan[j]
        let döttKort = card.SynligaKort.indexOf(kortet)
        if (döttKort === -1) {
          kortet.position.setposition(spawn.position)
          kortet.spawn()
        }

        if (kortet.isTurned === false) {
          kortet.vänd()
        }
      }
    }
  }

  static Föräldrarlös(kortlistalista) {
    for (let i = 0; i < 4; i++) {
      let kortlista = kortlistalista[i]

      for (let j = 0; j < 13; j++) {
        let kortet = kortlista[j]
        if (kortet.hasparent) {
          kortet.removeParent()
        }
        if (kortet.haschild) {
          kortet.removeChild()
        }
      }
    }
  }

  static LäggKortIbehållare(behållarlista, kortlistalista) {
    for (let i = 0; i < 4; i++) {
      let kortlista = kortlistalista[i]
      let behållar = behållarlista[i]

      for (let j = 0; j < 13; j++) {
        let fakeminne = [69, 122]
        let kort = kortlista[j]
        let indexAvKort = behållar.allakortdenhar.indexOf(kort)

        if (indexAvKort === -1) {
          cardAction.KortTillHög(kort, behållar, fakeminne)
        }
      }
    }
  }
}

document.addEventListener('mousedown', kontinuerliga.Musner)
document.addEventListener('mousemove', kontinuerliga.musrörelse)
document.addEventListener('mouseup', kontinuerliga.Musupp)
document.addEventListener('keydown', kontinuerliga.knappner)
document.addEventListener('dblclick', ulla)

function ulla() {
  if (difficulty === 'easy') {
    dubbelklick.klickandedubbel(klickad)
  }
}
//let regret = new ångerknapp(0, 400, 200, 100, 'hej', 'röd');
//regret.addToInteractable();

const botten = new GameObject(0, höjd, bredd, 1000, '/kfkbatians/coolkort.png')

const bottfysik = new fysik(botten, 3, 0.8, true)
bottfysik.isStatic = true

export let playing = true

//ångerknappen.isClickable = false;

export let Clearing = true
export let validklick = false
export let klickad
export let rörelsebarn = true
export let winanimation = false

const kollvektor = new Vector(200, 400)

export let spawn

export let difficulty = 'easy'

export function SetDifficulty(grad) {
  difficulty = grad
}

export let iMeny = true

let skaSkicka = false

kontinuerliga.startaVideon()
kontinuerliga.AutoMovements()

setTimeout(Main, 300)

//startmeny.SetStartmeny();

export function StartaSpelet() {
  spawn = new spawnare(60, 60, 45, 70)
  bakgrund.SetBakgrunden()
  behållare.allabehållare = []
  const hjärt = new behållare(
    bredd - 120,
    100,
    'hjärter',
    '/kfkbatians/kortbilder/behållare/behållare_hjärter.svg',
  )
  const rute = new behållare(
    bredd - 120,
    190,
    'ruter',
    '/kfkbatians/kortbilder/behållare/behållare_ruter.svg',
  )
  const klöv = new behållare(
    bredd - 120,
    280,
    'klöver',
    '/kfkbatians/kortbilder/behållare/behållare_klöver.svg',
  )
  const spade = new behållare(
    bredd - 120,
    370,
    'spader',
    '/kfkbatians/kortbilder/behållare/behållare_spader.svg',
  )

  card.SynligaKort = []
  card.SuperKort = []
  LäggUtAllaSuperKort()
  setInterval(flyttaKlickad, updatetime)

  let testet = new Vector(0, 450)
  knappar.allaKnappar = []
  const ångerknappen = new knappar('Ångra', testet, 100, 50, ånger.ÅngradeMig)
  let nyspelPos = new Vector((3 * bredd) / 5, (4 * höjd) / 5)
  let nyttSpel = new knappar('Nytt spel', nyspelPos, bredd / 5, höjd / 5, startmeny.NyttSpelKnappen)
}

function Main() {
  startmeny.SetStartmeny()
  //spawn.spawnaHögsta();

  //requestAnimationFrame(flyttaKlickad);
}

function LäggUtAllaSuperKort() {
  let högarna = []
  let position = new Vector(200, 60)
  let mellanrum = new Vector(60, 0)

  let antalHögar = 7

  for (let i = 0; i < antalHögar; i++) {
    let currentCard = new card(
      position.x,
      position.y,
      '/kfkbatians/kortbilder/superkort.svg',
      '',
      14,
      0,
    )
    högarna[i] = currentCard
    currentCard.vänd()
    currentCard.synligGör()
    card.SuperKort.push(currentCard)
    position = Vector.AddVector(position, mellanrum)
  }

  LäggUtVanligaKort(högarna)
}

function LäggUtVanligaKort(högar) {
  for (let i = 0; i < högar.length; i++) {
    let till = högar[i].position
    let kurrentHög = högar[i]
    let ändringsvektor = new Vector(0, 25)
    let nukort

    for (let j = 0; j < i + 1; j++) {
      nukort = spawn.lek.taÖverstaKortet()
      nukort.spawn()

      nukort.position.setposition(spawn.position)
      nukort.moveTill(till, spawnare.cardMoveTime)

      let urbarn = kurrentHög.hittaUrbarn()
      urbarn.givechild(nukort)
      nukort.hasOldDad = true
      nukort.oldDad = urbarn

      till = Vector.AddVector(till, ändringsvektor)
    }
    nukort.vänd()

    cardAction.FixaAllaLängderFR()
  }
}

function flyttaKlickad() {
  if (validklick) {
    klickad.uppdateraPosition(mouse.x - mouse.offsetX, mouse.y - mouse.offsetY)
  }
  //requestAnimationFrame(flyttaKlickad);
}

export function Vemklickades() {
  klickad = GameObject.kollaKlickad()
  if (klickad === 69) {
    if (botton.hovard !== undefined) {
      botton.hovard.onklick()
    }
  } else {
    //console.log(klickad);

    if (klickad.klickUpdate) {
      klickad.klickUpdate()
    }
  }
}

export function IngenWinAnimation() {
  winanimation = false
  Clearing = true
}

export function närDenGårUpp() {
  if (klickad.offKlickUpdate) {
    klickad.offKlickUpdate()
  }
  validklick = false
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function SkickaUtKortEnEfterEn() {
  let skcikar = true
  let valör = 12
  let hög = 0
  while (skcikar) {
    if (fysik.allaFysiska.length === 1 && valör - 1 >= -1) {
      let korthög = behållare.allabehållare[hög % behållare.allabehållare.length]
      let kort = korthög.allakortdenhar[valör]

      let fysiska = new fysik(kort, 5, 0.7, false)
      let ex = Random.Next(3, 10)
      let ey = Random.Next(1, 100)

      let nyvektor = new Vector(-ex, -ey * 0.1)
      fysiska.setVelocity(nyvektor)

      hög++
      if (hög % behållare.allabehållare.length === 0 && valör - 1 >= 0) {
        valör--
      }

      await sleep(50) // vänta 500ms mellan varje kort
    } else if (valör - 1 < -1) {
     
      skcikar = false
    } else {
      await sleep(50) // Vänta lite tills ett kort försvinner
    }
  }
}
//för kortanimeringen få rman nog kolla när de är klara med en viss kurva och sedan påbörja en ny
//det går inte att interpolera fram en bra kurva

//hade varit coolt om man döpte spelet till kfkpassians men när man går in så står det kfkbassians
//och så 'trillar' b:et ner och blir ett p

//kort
//dessa kan klickas å flyttas på och de ska vara synliga
//de ska ha höjd bredd, position, utseende, något som händer när man klickar på dem
//något som händer när man slutar klicka på den
//ärver från den allmäna objektklassen

//kortlek
//åller koll på alla kort och kan blanda etc

//något som synliggör objekt

//något som kollar om ett objekt har blivit klickat eller inte

//bör nog ha en allmän objekt klass

//när man klickar med musen ska programmet kolla om man träffade ett objekt

//hur motorn sedan ska funka är att den hela tiden kör draw och clear funktioner med ett visst mellanrum
//den kollar också hela tiden var musen är och uppdaterar musens position hela tiden

//när man klickar musen så körs ett visst antal funtioner
//när man släpper musen körs ett visst antal funktioner

//några bra allmäna gameobject funktioner kan vara att kolla om ett objekt har blivit klickat

//akta spagettikod nu, kör så lite som möjligt utanför klasser så att vi kan bygga spelet lätt sen

//för senare: när man släpper upp musen så ska kortet antingen gå till den nya positionen eller
//så ska den tillbaks, eller så ska den till en viss position

//vill nog ha att den ritar ut olika typer av objekt separat istället för att
//man bara har en stor lista med allt som ska ritas ut, så man får ba lägga till
//alla listor man vill ska ritas ut i en kö i kontinuerliga

//isActive är den variabel som säger om ett kort kan röras eller inte, för bara om isActive är true
//kommer det att hända något med kortet när man trycker på det

//hur ska behållaren funka? det ska vara en plats dit kortet snappar, man ska kunna lägga flera kort på
//varandra, med speciella regler för i vilken ordning, man ska kunna ta ett kort och flytta runt det
//när man tar ett kort ska ett kort bakom visas
//det blir ju som en spawnare, men nu ska man kunna lägga dit kort också.

//behöver ett system för att kolla vad det är som ska göras när man släpper kortet

//börja med att göra att man kan lägga ett kort på en behållare
//kan typ göra att den kollar "viktiga positioner" först innan den kollar om den ligger på nåt kort

//måste komma ihåg att göra att den uppdaterar behållaren när man släpper koret fel
