
import { krrrr, Vector, GameObject } from "../brumbrum.js";
import { behållare, spawnare, spawn, card } from "../newtry.js";
import { knappar } from "./andrabrum.js";
import { ånger } from "./regret.js";


//en klass som samlar alla saker som man kan göra i spelet
//flytta kort, trycka på leken etc.
export class action
{

    

    static KortTillHög(kort, hög){
        

        //hämta position så kortet vet vart det ska, och skicka det dit
        let position = hög.position;
        
        //gör det som ska göras både när man flyttar till ett kort och när man flyttar till en hög
        action.GemensamKortHög(kort, position);

        //lägger koret i högen 
        hög.allakortdenhar.push(kort);
        kort.isChildAble = false;

        //tar bort old dad
        kort.hasOldDad = false; 
        kort.oldDad = undefined;

        //kollar om den redan var i en hög
        let varRedanIhög = kort.isFromBehållare;
        console.log(varRedanIhög);

        //sätter denna hög som dess gamla hög, används för när man lägger ett kort från en hög fel
        //annars kommer behållaren tro att det har förlorat kortet, utan att den faktiskt gjort det
        kort.behållare = hög;
        kort.isFromBehållare = true;

        //säger att koret är i en behållare
        kort.isFromBehållare = true;
        kort.behållare = hög;

         
        
    }



    static GemensamKortHög(kort, position){

        kort.högstSynlig();
        //flyttar kortet till rätt position
        kort.moveTill(position, spawnare.cardMoveTime); //

        //om kortet kommer från tablån direkt till högen
        //så vill vi kolla om det låg på ett kort som inte var vänt
        //kollar också om kortet hade en gamal farsa, isf ska vi lägga det i regret
        if(kort.hasOldDad){

            
            if(!kort.oldDad.isTurned){
                kort.oldDad.vänd();
            }
            
        }


        //om kortet kom från spawn vill man ta bort kortet frånspawn
        let spawnish = kort.jagÄrIspawn();//

        if(spawnish !== 69){
            
            spawnish.taBortkort(kort);
        }

        
    }

    //om man ångrar sig och kortet ska till ett kort i tablån
   


    


}

//tror detta är löst nu:
//när man lägger ut ett kort och sedan 
//felaktigt försöker lägga ut ett till 
//kort från spawn så struntar ånger att 
//lägga tillbaks det första kortet som 
//man tog från spwan av nån anledning

export class cardAction
{
    //kollar alla behållare och lägger alla behållare som överlappar med kortet i överlappare
    static ÖverlappMedHög(kort, överlappare){

        for(let i = 0; i < behållare.allabehållare.length; i++){
            let deligger = GameObject.liggerDem(kort, behållare.allabehållare[i]);
            if(deligger){
                överlappare.push(behållare.allabehållare[i]);
            }
        }
    }


    static ÖverlappMedLängd(kort, överlappare){

        for(let i = 0; i < card.SuperKort.length; i++){
            let deligger = GameObject.liggerKolumn(kort, card.SuperKort[i]);
            if(deligger){
                överlappare.push(card.SuperKort[i]);
            }
        }
    }

    static ReglerFörBehållare(kort, hållare){
        //kollar om man bara lägger tillbaks kortet eller inte
        if(kort.jagÄrIbehållare() !== 69){
            return false;
        }

        if(kort.nummer === hållare.allakortdenhar.length + 1){
            if(kort.färg === hållare.färg && kort.haschild === false){
                return true;
            }
        }
        return false;
    }

    static ReglerFörKort(kort, andraKort){
        //kollar om man bara lägger tillbaks kortet eller inte
        if(andraKort === kort.parent){
            return false;
        }

        if(kort.rödsvart !== andraKort.rödsvart){
            if(kort.nummer === andraKort.nummer - 1){
                return true;
            }
        }
        //console.log('kthis is the end');
        return false;
    }


    static SaveMove(kort){
        //minnesarrayen är till för att man inte ska behöva kolla allt igen när man faktiskt gör flytten
        let minnen = [];
        console.log(kort);
        let spawnish = kort.jagÄrIspawn();        
        minnen.push(spawnish);

        let behish = kort.jagÄrIbehållare();
        minnen.push(behish);

        let minnesAction;
        let läggMigI;
        let vändFadern = false;

        if(spawnish !== 69){
            //den kommer från spawn
            minnesAction = 1;            
        }
        else if(behish !== 69){
            //den kommer från behållare
            minnesAction = 0;
            läggMigI = behish;
        }
        else if(kort.parent.constructor.name === 'card'){
            minnesAction = 2; 
            läggMigI = kort.parent;

            if(kort.parent.isTurned === false){
                vändFadern = true;
                minnen.push('vänd');
                console.log('fader ska vändas');
            }
        }
        console.log('ny ånger');
        new ånger(minnesAction, kort, läggMigI, vändFadern);

        return minnen;
        
    }

    static KortTillHög(kort, hög, minnen){

        
        hög.allakortdenhar.push(kort);

        kort.isChildAble = false;
        if(minnen.length === 3){
            kort.parent.vänd();
            kort.parent.offsetY = card.offsets;
        }
        
        //kom från spawn
        if(minnen[0] !== 69){
            spawn.taBortkort(kort);
            
        }
        else if(minnen[1] === 122){

        }
        else{
            kort.removeParent();
        }

        kort.moveTill(hög.position, spawnare.cardMoveTime);
        

        let vinst = behållare.CheckWin();
         if(vinst){
            
            console.log('du vann!');
            setTimeout(behållare.OnWin, 2*spawnare.cardMoveTime);
        }

    }

    static KortTillKort(kort, andraKort, minnen){
        
        kort.isChildAble = true;
        if(minnen.length === 3){
            kort.parent.vänd();
            kort.parent.offsetY = card.offsets;
        }       
        
        if(minnen[0] !== 69){
            spawn.taBortkort(kort);
        }
        else if(minnen[1] !== 69){
            minnen[1].taBortkort(kort);
        }
        else{
            kort.removeParent();
        }
        andraKort.givechild(kort);

        /*
        let ex = kort.parent.position.x;
        let ey = kort.parent.position.y + kort.parent.offsetY;

        let nypos = new Vector(ex, ey);

        //kort.moveTill(nypos, spawnare.cardMoveTime);
        kort.ändrAllaBarnsOldPosition(nypos);
        */
    }

    //skulle kunna potimisera genom att man skickar med endast längden som man la kortet i 
    //och längden som kortet kommer från
    static FixaAllaLängder(){
        console.log('fixa längd initiated');
        let lång = card.SuperKort.length;

        for(let i = 0; i < lång; i++){
            let längden = card.SuperKort[i];

            let urban = längden.hittaUrbarn();
            if(urban.position.y > card.lägstaPosition){
                console.log('måste fixa längd');
                console.log(i);
                //kortet var för långt ner
                let differens = urban.position.y - card.lägstaPosition;

                let kollarKort = längden.child;                
                let antalIckeVända = 0;

                while(!kollarKort.isTurned){
                    antalIckeVända++;
                    kollarKort = kollarKort.child;
                }

                //kanske borde ha något speciellt ifall det bara är ett eller förre ickevända
                kollarKort = längden.child;
                for(let j = 0; j < antalIckeVända; j++){
                    
                    kollarKort.offsetY = kollarKort.offsetY - differens/antalIckeVända;
                    kollarKort = kollarKort.child;
                }

                längden.moveTill(längden.position, spawnare.cardMoveTime);

            }
            else{
                //nu vill vi att de ska ha default offset eftersom kortet inte är för långt ner
                let kollarKort = längden.child;                
                let antalIckeVända = 0;

                while(!kollarKort.isTurned){
                    antalIckeVända++;
                    kollarKort = kollarKort.child;
                }

                kollarKort = längden.child;

                for(let j = 0; j < antalIckeVända; j++){
                    kollarKort.offsetY = card.offsets;
                    kollarKort = kollarKort.child;
                }
                längden.moveTill(längden.position, spawnare.cardMoveTime);
            }
        }
    }

    static FixaAllaLängderFR(){
        //nu ska man ba göra denhär 7 gånger 

        //probelemt är att den tar den nuvarand epositionen, 
        // så om man släpper långt ner så tror den att högen 
        // är mycket längre ner än vad den är
        //
        //behöver ändra offset på ett kort som vänds upp till default
        for(let i = 0; i < card.SuperKort.length; i++){
            //console.log('fixar längd ' + i);
            let kortet = card.SuperKort[i];

            let urban = kortet.hittaUrbarn();

            let yet = urban.oldPosition.y;
            //console.log('urban oldposition y');
            //console.log(yet);           

            let diff = urban.oldPosition.y - card.lägstaPosition;

            //console.log('diff : ' + diff);
            let antalovända = cardAction.LängdAvOvändlängd(kortet);

            //kortet är för långt ner
            if(diff > 0){
                
                //console.log('antal ovända: ' + antalovända);
                let vända = kortet.child;
                let nyOffset;
                if(antalovända > 0){
                    nyOffset = vända.offsetY - diff/antalovända;
                }                
                //console.log('den mängd offset som ändras: ' + (- diff/antalovända));

                for(let i = 0; i < antalovända; i++){
                    
                    
                    //console.log('den har offset: ' + vända.offsetY);
                    vända.offsetY = nyOffset;
                    //console.log('den ' + i + 'e har offset:' + vända.offsetY);
                    vända = vända.child;
                }

                
            }
            else{

                if(antalovända > 0){
                    let off = kortet.child.offsetY;
                    let stand = card.offsets;

                    let teoripos = urban.oldPosition.y + antalovända*(stand - off);
                    
                    if(teoripos < card.lägstaPosition){
                        //console.log('sätter till default');
                        let korrtt = kortet.child;
                        for(let i = 0; i < antalovända; i++){

                            korrtt.offsetY = card.offsets;
                            //console.log(korrtt.offsetY);
                            korrtt = korrtt.child;
                        }
                    }
                    else{
                        //console.log('följer formel');
                        let korrtt = kortet.child;
                        let nyOffset;
                        if(antalovända > 0){
                            nyOffset = korrtt.offsetY - diff/antalovända;
                        }  
                        for(let i = 0; i < antalovända; i++){
                            korrtt.offsetY = nyOffset;
                            korrtt = korrtt.child;
                        }
                    }
                }
                

            }
            //console.log('---------------------');
            kortet.moveTill(kortet.position, spawnare.cardMoveTime);
        }
        //console.log('===========================');
    }

    static LängdAvOvändlängd(superkort){
        if(superkort.haschild){
            let barnet = superkort.child;
            let antalOvända = 0;

            while(barnet.isTurned === false){
                antalOvända++;
                barnet = barnet.child;
            }

            return antalOvända;
            
        }
        else{
            return 0;
        }
    }
}


export class längdfix
{
    static FixaLängder(){
        let antalSuperkort = card.SuperKort.length;

        for(let i = 0; i < antalSuperkort; i++){
            
            let nuvarande = card.SuperKort[i];
            let needfixing = längdfix.BehöverDenFixas(nuvarande);

            if(needfixing){
                //längden behöver fixas
                let teoripos = längdfix.RäknaUtTeoriPosition(nuvarande);
                
                let currentOffset = nuvarande.child.offsetY;
                let diff = teoripos - card.lägstaPosition;

                if(diff < 0){
                    
                    //negativ diff
                    let antalBarn = GameObject.antalBarn(nuvarande) - 1;
                    let hypotetiskaPos = antalBarn * card.offsets + nuvarande.position.y;

                    if(hypotetiskaPos < card.lägstaPosition){
                        //sätter offset till default
                        längdfix.SättOvändasOffsetTill(card.offsets, nuvarande);
                    }
                    else{
                        
                        //sätter alla offset enligt formeln
                        let antalOvända = cardAction.LängdAvOvändlängd(nuvarande);
                        let nyoffset = längdfix.Formeln(diff, antalOvända, currentOffset);

                        längdfix.SättOvändasOffsetTill(nyoffset, nuvarande);
                    }
                }
                else{
                    
                    //diff va positiv
                    let antalOvända = cardAction.LängdAvOvändlängd(nuvarande);
                    let nyoffset = längdfix.Formeln(diff, antalOvända, currentOffset);
                    
                    längdfix.SättOvändasOffsetTill(nyoffset, nuvarande);
                }
            }
            else{
                //gör inget
            }
            nuvarande.moveTill(nuvarande.position, spawnare.cardMoveTime);
        }
    }

    static BehöverDenFixas(superkort){
        if(superkort.haschild && superkort.child.isTurned === false){

            let teoripos = längdfix.RäknaUtTeoriPosition(superkort);

            if(teoripos < card.lägstaPosition){
                let offseten = superkort.child.offsetY;

                if(offseten !== card.offsets){
                    
                    return true;
                }
            }
            else{
                
                return true;
            }
            
            
           
        }      
       
        return false;
        
    }

    static RäknaUtTeoriPosition(superkort){
        let antalOvända = cardAction.LängdAvOvändlängd(superkort);
        let totAntalBarn = GameObject.antalBarn(superkort);
        //det sista kortet e ju det vi vill kolla på dräför -1
        let antalVända = totAntalBarn - antalOvända - 1; 
        let offseten = 0;
        
        if(superkort.haschild && superkort.child.isTurned === false){
            offseten = superkort.child.offsetY;
        }
        else{
            console.log('superkoretet hade inga ovända barn');
            awefsdf.vänt();
        }

        let teoripos = superkort.position.y + offseten * antalOvända + card.offsets * antalVända;
        
        return teoripos;

    }

    static SättOvändasOffsetTill(offset, superkort){
       
        console.log(offset);
        let antalOvända = cardAction.LängdAvOvändlängd(superkort);
        let cerrentKort = superkort.child;

        for(let i = 0; i < antalOvända; i++){
            cerrentKort.offsetY = offset;
            cerrentKort = cerrentKort.child;
        }   
        
        

    }

    static Formeln(diff, antalOvända, currentOffset){
        
        let returen = currentOffset - diff/antalOvända;
        
        if(returen < 0){
            return 0;
        }
        else{
            return returen;
        }
        
    }
}



export class dubbelklick
{
    
    static klickandedubbel(klickad){

        if(klickad.constructor.name !== 'card'){
            return;
        }
        //kollar om kortet kan läggas någonstans på tablån
        let kanFlyttaTill = dubbelklick.KollaOmDetFinnsNåtMove(klickad);

        if(kanFlyttaTill === 69){
            return;
        }
        else if(kanFlyttaTill.constructor.name === 'behållare'){
            //gör det som ska göras vid giltigt drag
            let minnen = cardAction.SaveMove(klickad);
            
            cardAction.KortTillHög(klickad, kanFlyttaTill, minnen);
            //kolla om längden ska kortas ned ska vara här
            längdfix.FixaLängder();
        }
        else if(kanFlyttaTill.constructor.name === 'card'){
            //gör det som ska göras vid giltigt drag
            let minnen = cardAction.SaveMove(klickad);                        
            cardAction.KortTillKort(klickad, kanFlyttaTill, minnen);
            //kolla om längden ska kortas ned ska vara här för 
            // att den ska få med senaste kortet som lades till 
            längdfix.FixaLängder();
        }        
        else{
            console.log('det blev något fel dubbelklick > klickadubbel');
            console.log(kanFlyttaTill);
        }

    }

    static KollaOmDetFinnsNåtMove(klickad){
        

        //kollar om regler förljs för behållare
        let längden = behållare.allabehållare.length;
        for(let i = 0; i < längden; i++){
            let behållaren = behållare.allabehållare[i];

            let reglerFöljs = cardAction.ReglerFörBehållare(klickad, behållaren);

            if(reglerFöljs){
                return behållaren;
            }
        }

        //kollar om regler följs för superkort
        längden = card.SuperKort.length;
        for(let i = 0; i < längden; i++){
            let superkoretet = card.SuperKort[i];
            let kortet = superkoretet.hittaUrbarn();

            let reglerFöljs = cardAction.ReglerFörKort(klickad, kortet);

            if(reglerFöljs){
                return superkoretet;
            }
        }

        return 69;
    }
}








