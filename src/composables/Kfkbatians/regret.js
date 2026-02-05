
//import { GameObject } from "../brumbrum";

//verkar som att den skapar nya ångerobjekt 
//när den inte ska ibland, kan ligga till grund för alla problem'

//det måste ha nåt att göra med att den inte pushar det nya objektet
//det måste vara att den tror att det är ett move som inte ska sparas

//provar att lägga till en extra variabel till metoden

import { GameObject, krrrr, Vector } from "./brumbrum.js";

import { spawnare, behållare, spawn, card, difficulty } from "./main.js";
import { cardAction, längdfix } from "./action.js";






export class ånger
{
    static allRegrets = [];

    constructor(minnseaction, kort, läggmigi, vändFadern){

        this.kort = kort;
        this.minnesAction = minnseaction;

        this.läggmigi = läggmigi;

        this.vändFadern = vändFadern;

        ånger.allRegrets.push(this);

        
    }

    frIswearSistaÅngerfunktionennu(){

        switch(this.minnesAction){

            //lägg tillbaks kort i en hög
            case 0:
                this.kort.högstSynlig();
                this.kort.läggMigLängstUppInteract();
                this.kort.removeParent();
                //kolla om längden ska ändras
                this.läggmigi.allakortdenhar.push(this.kort);
                this.kort.moveTill(this.läggmigi.position, spawnare.cardMoveTime);
                längdfix.FixaLängder();
                //cardAction.FixaAllaLängderFR();
                //cardAction.FixaAllaLängderFR();
            break;

            //lägg tillbaks kort i spawn
            case 1:
                let kortiHög = this.kort.jagÄrIbehållare();

                this.kort.högstSynlig();
                this.kort.läggMigLängstUppInteract();

                if(kortiHög !== 69){
                    kortiHög.taBortkort(this.kort);
                }
                else{
                    this.kort.removeParent();
                    //kolla om längden ska ändras
                }

                spawn.ettKortTillbaks(this.kort);
                spawn.flyttaLiggandeKort();
                längdfix.FixaLängder();
                //cardAction.FixaAllaLängderFR();
                //cardAction.FixaAllaLängderFR();
            break;

            case 2:
                this.kort.högstSynlig();
                this.kort.läggMigLängstUppInteract();
                if(this.kort.hasparent){
                    this.kort.removeParent();
                }
                
                let kortHög = this.kort.jagÄrIbehållare();

                if(kortHög !== 69){
                    kortHög.taBortkort(this.kort);
                }
                if(this.vändFadern){
                    this.läggmigi.vänd();
                }

                this.läggmigi.givechild(this.kort);
                //kolla om längden behöver föyttas
                let ex = this.läggmigi.oldPosition.x;
                let ey = this.läggmigi.oldPosition.y + this.läggmigi.offsetY;

                let nypos = new Vector(ex, ey);

                this.kort.moveTill(nypos, spawnare.cardMoveTime);
                längdfix.FixaLängder();
                //cardAction.FixaAllaLängderFR();
                //cardAction.FixaAllaLängderFR();
            break;

            case 3:
                if(spawn.liggandekort.length === 0){
                    let längd = spawn.lek.allakort.length;
                    for(let i = 0; i < längd; i++){
                        
                        let nukort = spawn.lek.allakort.shift();                        
                        nukort.spawn();
                        nukort.vänd();
                        let positionen = spawn.kortpositioner[2];
                        nukort.moveTill(positionen, spawnare.cardMoveTime);
                        spawn.bytbild(spawnare.redoside);
                        spawn.liggandekort.unshift(nukort);
                    }
                }
                else{
                    if(difficulty === 'easy'){
                        let nukort = spawn.liggandekort.shift();
                        
                        nukort.vänd();
                        nukort.moveTill(spawn.position, spawnare.cardMoveTime);
                        spawn.lek.allakort.unshift(nukort);
                        
                        setTimeout( () => {
                            nukort.kill();
                            spawn.bytbild(card.baksida);
                        }, spawnare.cardMoveTime);
                    }
                    else if(difficulty === 'hard'){
                        
                        
                        for(let i = 0; i < this.kort; i++){
                            let nukort = spawn.liggandekort.shift();
                            
                            nukort.vänd();
                            nukort.moveTill(spawn.position, spawnare.cardMoveTime);
                            spawn.lek.allakort.unshift(nukort);
                            
                            setTimeout( () => {
                                nukort.kill();
                                spawn.bytbild(card.baksida);
                            }, spawnare.cardMoveTime);

                            if(spawn.liggandekort.length === 0){
                                break;
                            }
                        }
                    }
                    else{
                        console.error('error, difficulty var inte easy eller hard');
                        sfdfds.vänf();
                    }
                    

                    
                }

                spawn.flyttaLiggandeKort();
            break;
        }
    }

    
    static ÅngradeMig(){
        let reggie = ånger.allRegrets.pop();
        
        if(reggie !== undefined){
            reggie.frIswearSistaÅngerfunktionennu();
        }
    }
    

}



/*
vill kunna spara vilket kort som ska flyttas
vill ha vart det ska flyttas,
vill ha vem som ska bli dess barn
vill veta om det ska läggas tillbkas i spawnern eller i en av behållarna 

skulle kunna ha att varje instans av ångerklassen sparar all info om vad som hände
sedan kan man ha en klassarray som säger vad som sparar alla objekt i rätt ordning 

när man trycker på ångra knappen kollar den objektet högst i arrayen och gör vad som sägs där
*/



//kan försöka lära mig throw catch för att göra så att man kan ha ett gameobjekt med text
//skulle ba kunna 




export class ångerknapp extends GameObject
{

    static allaKnappar = [];

    constructor(xpos, ypos, bredd, höjd, text, färg){
        super(xpos, ypos, bredd, höjd, '');

        this.text = text;

        this.färg = färg;

        ångerknapp.allaKnappar.push(this);
        
    }

    klickUpdate(){
        
        let reggie = ånger.allRegrets.pop();
        
        if(reggie !== undefined){
            reggie.frIswearSistaÅngerfunktionennu();
        }
        

    }
}












