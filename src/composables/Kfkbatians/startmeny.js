/** @type {HTMLCanvasElement} */
export const duken = document.querySelector("#duken");
export const ctx = duken.getContext("2d");

const rect = duken.getBoundingClientRect();

const bredd = duken.width;
const höjd = duken.height;

import { bakgrund, StartaSpelet, SetDifficulty, spawnare, card, behållare, winanimation, Clearing, IngenWinAnimation } from "./main.js";
import { knappar } from "./andrabrum.js";
import { Vector, fysik, Random } from "./brumbrum.js";

export class startmeny
{
    static SetStartmeny(){
        
        card.SynligaKort = [];
        behållare.allabehållare = [];
        behållare.synligaBehållare = [];
        spawnare.födare = [];
        bakgrund.allaBakgrundsObjekt = [];
        knappar.allaKnappar = [];
        new bakgrund(0, 0, bredd, höjd, '#07ab33');
        new bakgrund(0, 0, bredd, höjd, '#00000080');
        new bakgrund(bredd/4, höjd/4, bredd/2, höjd/2, 'rgba(255, 255, 255, 1)');

        let easypos = new Vector(bredd/4, höjd/4);
        let hardpos = new Vector(bredd/2, höjd/4);
        new knappar('easy', easypos, bredd/4, höjd/2, easy);
        new knappar('hard', hardpos, bredd/4, höjd/2, hard);

    }

    static NyttSpelKnappen(){
        if(winanimation){
            IngenWinAnimation();
        }
        else{
            startmeny.SetStartmeny();
        }
    }
}




function easy(){
    SetDifficulty('easy');
    setTimeout(StartaSpelet, 200);
}

function hard(){
    SetDifficulty('hard');
    setTimeout(StartaSpelet, 200);
}













export async function WinenrAnimation() {
    
    let valör = 12;
    let hög = 0;
    await sleep(100);

    while(winanimation && valör - 1 >= -1){
        
        let korthög = behållare.allabehållare[hög % behållare.allabehållare.length];
        let kort = korthög.allakortdenhar[valör];
        
        let fysiska = new fysik(kort, 5, 0.7, false);
        let ex = Random.Next(3, 10);
        let ey = Random.Next(1, 100);        

        let nyvektor = new Vector(-ex, -ey * 0.1);
        fysiska.setVelocity(nyvektor);

        let utanför = false;
        
        while(!utanför){
            await sleep(50);
            utanför = ärDenUtanförBild();
            //console.log('den är i bild');
        }

        hög++;
        if(hög % 4 === 0){
            valör--;
        }

    }

    startmeny.SetStartmeny();
}

function ärDenUtanförBild(){
    
    if(fysik.allaFysiska.length === 1){
        return true;
    }
    else{
        return false;
    }   
}


function sleep(väntetid){
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve('har väntat');
        }, väntetid);
    });
}






async function SkickaUtKortEnEfterEn(){
        
        let skcikar = true;
        let valör = 12;
        let hög = 0;
        while(skcikar){
            if(fysik.allaFysiska.length === 1 && valör - 1 >= -1){
                let korthög = behållare.allabehållare[hög % behållare.allabehållare.length];
                let kort = korthög.allakortdenhar[valör];
               
                let fysiska = new fysik(kort, 5, 0.7, false);
                let ex = Random.Next(3, 10);
                let ey = Random.Next(1, 100);
                

                let nyvektor = new Vector(-ex, -ey * 0.1);
                fysiska.setVelocity(nyvektor);
              
                hög++;
                if(hög % behållare.allabehållare.length === 0 && valör - 1 >= 0){
                    valör--;
                    
                }
                
                await sleep(50); // vänta 500ms mellan varje kort
            } 
            else if(valör - 1 < -1){
                
                skcikar = false;
            }          
            else {
                await sleep(50); // Vänta lite tills ett kort försvinner
            }
        }
        
    }
















