/** @type {HTMLCanvasElement} */
const duken = document.querySelector("#duken");
const ctx = duken.getContext("2d");

const rect = duken.getBoundingClientRect();

const bredd = duken.width;
const höjd = duken.height;

const fps = 100;
const updatetime = 1000/fps;

let nukörvideon = false;

export let krrrr = false;

import { bakgrund, behållare, spawnare, card, rörelsebarn, Vemklickades, närDenGårUpp, playing, iMeny } from "./newtry.js";
import { Fusk, Clearing, klickad, validklick, Uskare } from "./newtry.js";
import{ botton, knappar } from "./funktionerna/andrabrum.js";

class kontinuerliga
{
    //det som händer när man rör musen
    static musrörelse(event){
        

        let x = event.clientX;
        let y = event.clientY;

        mouse.position(x, y);
        if(playing || true){
            botton.KollaVilkenKnapp();
        }
        
        
    }

    //Vektorfunktion
    static AutoMovements(){
        let kör = false;
        //setInterval(this.därRörelseHänder, updatetime);
        setInterval(async() =>{

            if(kör){
                console.log('tillbaks');
                return;
            }
            
            kör = true;
            
            if(krrrr){
                await kollar();
                sant = true;
            }
            
            kontinuerliga.därRörelseHänder();
            
            kör = false;


        }, updatetime);
    }

    static därRörelseHänder(){
        /*
        if(rörelsebarn){
            Vector.DoMovements();
        }
        */

        if(rörelsebarn){
            Animation.GåIgnomAllaAnimationer();
            fysik.KollaAllFysik();
        }
    }



    //ritfunktioner

    static startaVideon(){        

        //setInterval(kontinuerliga.VideoRunning, updatetime);
        //requestAnimationFrame(kontinuerliga.VideoRunning);
        requestAnimationFrame(kontinuerliga.VideoRunning);
    }

    static VideoRunning(){
               
        
        if(false){

        }
        else{
            kontinuerliga.drawShape(bakgrund.allaBakgrundsObjekt);
            kontinuerliga.drawGameObject(behållare.synligaBehållare);
            
            botton.RitaKnappar();
            kontinuerliga.drawGameObject(spawnare.födare);
            kontinuerliga.drawGameObject(card.SynligaKort);   
                
            
            
            if(Clearing){ //clearing
                requestAnimationFrame(kontinuerliga.VideoRunning);
            }
            else{
                //knappar.allaKnappar = [];
                //let nyttSpel = new knappar('Nytt spel', nyspelPos, bredd / 5, höjd / 5, startmeny.SetStartmeny);
                let ineter = setInterval(() => {
                    requestAnimationFrame(kontinuerliga.winner);

                    if(Clearing){
                        clearInterval(ineter);
                        requestAnimationFrame(kontinuerliga.VideoRunning);
                    }
                    
                }, 50);
                //console.log(ineter);
                //går inte att ha request-animation-frame för denna, det blir as fult
                //jo när man väl fattar hur den funkar lol
            }
        }
        
       
        
    }

    static winner(){
        
        kontinuerliga.drawFysik(fysik.allaFysiska);
        ctx.globalCompositeOperation = 'destination-out';
        botton.RitaKnappar();
        ctx.globalCompositeOperation = 'source-over';
        botton.RitaKnappar();

        //botton.RitaKnappar();
    }

    static drawGameObject(listan){
        //allt som ritas är ett gameobject, minns det
        for(let i = 0; i < listan.length; i++){
            let nuvarande = listan[i];
            ctx.drawImage(nuvarande.bild, nuvarande.position.x, nuvarande.position.y, nuvarande.width, nuvarande.height);
        }
    }

    static drawFysik(listan){
        for(let i = 0; i < listan.length; i++){
            let nuvarande = listan[i].objekt;
            ctx.drawImage(nuvarande.bild, nuvarande.position.x, nuvarande.position.y, nuvarande.width, nuvarande.height);
        }
    }

    static drawShape(listan){
       
        for(let i = 0; i < listan.length; i++){
            let nuvarande = listan[i];
            let x = nuvarande.x;
            let y = nuvarande.y;

            let breedd = nuvarande.width;
            let hööjd = nuvarande.height;

            let färg = nuvarande.color;

            ctx.fillStyle = färg;
            ctx.fillRect(x, y, breedd, hööjd);
            
        }

    }

    static drawall(){
        GameObject.gåIgenomAllaSynligaOchRitaDem();
    }


    //behöver typ inte denna för ritar bara över allt varje frame
    static Clear(){
        ctx.clearRect(0, 0, bredd, höjd);
    }


    //musnerfunktioner
    static Musner(event){
        if(event.button === 0){
            console.log('kollar klickande');
            Vemklickades();
        }
        
    }



    //mus upp funktioner
    static Musupp(event){
        //console.log(event);
        if(event.button === 0){
            närDenGårUpp();
        }
        
    }


    //tangentbordsgrejer
    static knappner(event){
        /*        
        if(event.key === 'a'){
            krrrr = !krrrr;
        }

        if(event.key === 's'){
            sant = false;
        }
        */
        
        fuskaktivering(event);
        console.log(behållare.allabehållare);
        
    }

}

let fuskord = '';
const lösenord = 'clanker';

function fuskaktivering(event){
    fuskord = fuskord + event.key;
    let längd = fuskord.length;

    let delord = lösenord.slice(0, längd);
   
    if(fuskord === lösenord){
        //Fusk.LäggAllaLätt();
        console.log('startar fusk');
        Uskare.StartaFusk();
        console.log('wekfkiakjf');
    }
    else if(fuskord === delord){
        
    }
    else{
        fuskord = '';
    }
}

class Random
{
    

    static Next(lägsta, högsta){
        
        return Math.floor(Math.random() * (högsta - lägsta + 1)) + lägsta;
    }
}

class Vector
{
    static allaSomSkaFlyttaSig = [];

    constructor(x = 0, y = 0){
        this.x = x;
        this.y = y;

       /*
        this.riktningx = 0;
        this.riktningy = 0;

        this.steglängd = 0;

        this.targetx;
        this.targety;

        this.isMoving = false;

        */
    }

    

    addVector(vectorny){

        this.x = this.x + vectorny.x;        
        this.y = this.y + vectorny.y;
        

    }

    setposition(nya){
        this.x = nya.x;
        this.y = nya.y;
    }




    magnitud(){
        let längd = Math.sqrt(this.x * this.x + this.y * this.y);

        return längd;
    }

    storMagnitud(){
        let längd = this.x * this.x + this.y * this.y;

        return längd;
    }


    scale(skalär){
        this.x = this.x * skalär;
        this.y = this.y * skalär;
    }


    static SubtraheraVector(från, till){
        
        let xcomp = till.x - från.x;
        let ycomp = till.y - från.y;
        return new Vector(xcomp, ycomp);
    }

    static MinusaVektor(från, tillx, tilly){
        let xcomp = tillx - från.x;
        let ycomp = tilly - från.y;
        return new Vector(xcomp, ycomp);
    }

    static AddVector(ettan, tvåan){
        
        let xcomp = ettan.x + tvåan.x;
        let ycomp = ettan.y + tvåan.y;

        return new Vector(xcomp, ycomp);
    }

    static SammaPosition(Vector1, Vector2){
        if(Vector1.x === Vector2.x && Vector1.y === Vector2.y){
            return true;
        }
        else{
            return false;
        }
    }
   

    
}

//vector klassen gör för mycket annan skit, den borde befrias fårn sina förtryckande uppgifter 
//En vector klass bör inte hålla på med animation eller fysik, den borde endast hjälpa en 
//animationsklass eller en fysikklass med deras arbeten

//tar och flyttar alla animationsgrejer till en ny klass så att
//man kan använda vector klassen ordentligt

//skapar också en fysikklass så att man få saker att röra på sig utan att behöva interpolera

//animationsklassen, man skapar ett animationsobjekt per gameobject, och skickar med 
//positionsvektorn. Sedan kör man en instansfunktion som berättar vilken typ av 
//animation som ska göras och då också vart den ska

let sant = false;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function kollar() {
    console.log('kolar');
    await sleep(300);
}
//kanske prova att lägga en "jobbar på" variabel, så att animationsobjektet 
//vet vilket objekt som den ska jobba på och därmed vet vilken vektor som 
//den ska ta och som den sedan ska uppdatera
class Animation 
{
    static allaAnimationsObjekt = [];
    static straight = [];
    static funk = [];
    static pointdupoint = [];

    static counter = 0;
    static cycle = 0;

    constructor(objektet){
        this.objekt = objektet;
        this.hastVekt;
    
        //har antagit, i action.kortillkort, att det är en enda vector och inte en array av 
        //vectorer även om jag först tänkte att man skulle kunna ha en vector menmen
        this.målpositioner;

        this.funktion;
        //this.håll;
    }

    moveStraightTo(mål, tid){
       
        

        if(Animation.straight.indexOf(this) !== -1){
            //console.log('den fanns redan');
            let index = Animation.straight.indexOf(this);

            Animation.straight.splice(index, 1);
        }
        this.målpositioner = mål;
        this.calculateStraightSpeed(mål, tid);
        
        Animation.straight.push(this);
        this.objekt.isAnimated = true;
        
    }

    moveAlong(funktion, tid){

    }

    moveToThese(målpositioner, tid){

    }

    calculateStraightSpeed(mål, tid){
        let positionen = this.objekt.position;
        let längdvektor = Vector.SubtraheraVector(positionen, mål);
        
        let längdPerUppdatering = 1000/(tid * fps);
        längdvektor.scale(längdPerUppdatering);
        
        this.hastVekt = längdvektor;
        this.målpositioner = mål;
        
    }

    static antal = 0;

    static GåIgnomAllaAnimationer(){

        let deSomÄrFramme = [];        

        let animationslängden = Animation.straight.length;

        for(let i = 0; i < animationslängden && rörelsebarn; i++){
            
            let nuvarande = Animation.straight[i];
            let nuvarandeObjekt = nuvarande.objekt;
            let längdKvarVektor = Vector.SubtraheraVector(nuvarandeObjekt.position, nuvarande.målpositioner);
            
            let längdKvar = längdKvarVektor.storMagnitud();
            let steglängd = nuvarande.hastVekt.storMagnitud();
            if(steglängd < längdKvar){
                let nypos = Vector.AddVector(nuvarandeObjekt.position, nuvarande.hastVekt);
                nuvarandeObjekt.position.setposition(nypos);
            }
            else{
                nuvarandeObjekt.position.setposition(nuvarande.målpositioner);             

                deSomÄrFramme.unshift(nuvarande);
            }
            
        }

        let tabortlängd = deSomÄrFramme.length;

        for(let i = 0; i < tabortlängd; i++){
            let taBort = deSomÄrFramme[i];
            let index = Animation.straight.indexOf(taBort);
            Animation.straight.splice(index, 1);
            taBort.isAnimated = false;
        }

    }


}

/*
s [px], t [ms], vill ha [px]/[fps]      fps /s = fps /(10^3*10^-3*s) = (fps * 10^-3) / ms
s = v*t                                     fps[/ms]
s/t = v [px/ms]
v = s/(t*fps * 10^-3)
v = s * 1000 /(t*fps)



*/

//vill inte rita ut alla synliga kort när man vinner för 
//då ritar man ut för mycket så att det blockerar saker
//vill någ hellre rita allafysiska

class fysik
{
    static allaFysiska = [];

    constructor(objekt, vikt, elastisitet, statisk){
        this.objekt = objekt;

        this.vikt = vikt;
        this.elastisitet = elastisitet;
       
        this.isStatic = statisk;
        this.lyderLag = true;

        this.riktning;

        this.hastighet = new Vector(0,0);
        this.acceleration = new Vector(0, 0.1);
        fysik.allaFysiska.push(this);
    }

    vidkollision(andra){
        let nuvarande = this.objekt;
        ctx.drawImage(nuvarande.bild, nuvarande.position.x, nuvarande.position.y, nuvarande.width, nuvarande.height);
        let riktning = andra.riktning;

        if(riktning === 'left' || riktning === 'right'){
            let xledsHastighet = this.hastighet.x * this.elastisitet * -1;
            let yledsHastighet = this.hastighet.y;
            this.hastighet = new Vector(xledsHastighet, yledsHastighet);
            if(riktning === 'left'){
                let ex = andra.objekt.position.x + andra.objekt.width;
                let ey = this.objekt.position.y;
                this.objekt.position = new Vector(ex, ey);
            }
            else{
                let ex = andra.objekt.position.x - this.objekt.width;
                let ey = this.objekt.position.y;
                this.objekt.position = new Vector(ex, ey);
            }
        }
        else if(riktning === 'bottom' || riktning === 'top'){
            let xledsHastighet = this.hastighet.x;
            let yledsHastighet = this.hastighet.y * this.elastisitet * -1;
            this.hastighet = new Vector(xledsHastighet, yledsHastighet);
            if(riktning === 'top'){
                let ex = this.objekt.position.x;
                let ey = andra.objekt.position.y + andra.objekt.height;
                this.objekt.position = new Vector(ex, ey);
            }
            else{
                let ex = this.objekt.position.x;
                let ey = andra.objekt.position.y - this.objekt.height;
                this.objekt.position = new Vector(ex, ey);
            }
        }

    }

    setVelocity(hastigVektor){
        this.hastighet = hastigVektor;
    }

    ärJagUtanförBild(){
        let höger = this.objekt.position.x + this.objekt.width;
        let vänster = this.objekt.position.x;

        let upp = this.objekt.position.y;
        let ner = this.objekt.position.y + this.objekt.height;
        if(höger < 0 || vänster > bredd){
            //console.log('jag var ');
            return true;
        }
        if(upp > höjd){
            return true;
        }

        return false;
    }

    intelängreFysik(){
        let index = fysik.allaFysiska.indexOf(this);

        fysik.allaFysiska.splice(index, 1);
    }

    static KollaAllFysik(){
        let längd = fysik.allaFysiska.length;

        for(let i = 0; i < längd; i++){
            let nuv = fysik.allaFysiska[i];

            if(!nuv.isStatic){
                //console.log(nuv);
                let pos = nuv.objekt.position;
                
                let nypos = Vector.AddVector(pos, nuv.hastighet);

                for(let j = 0; j < längd; j++){
                    let andra = fysik.allaFysiska[j];
                    if(andra !== nuv){
                        let other = fysik.Kollision(nuv, nypos, andra);
                        //console.log(riktning);
                        if(other !== null){
                            nuv.vidkollision(other);
                        }
                    }

                    
                }
                nuv.hastighet = Vector.AddVector(nuv.hastighet, nuv.acceleration);
                nuv.objekt.position.addVector(nuv.hastighet);
                if(nuv.ärJagUtanförBild()){
                    let indes = fysik.allaFysiska.indexOf(nuv);
                    fysik.allaFysiska.splice(indes, 1);
                }
            }          
        }
    }

    //kan ha chatgpt:at denna biten till ganska stor del menmen
    //ser det på alla bra kommentarer lol
    static Kollision(ettans, nästaPos, kollande) {
        
        let förstaObjektet = ettans.objekt;
        let andra = kollande.objekt;

        let ettvänster = nästaPos.x;
        let etthöger = nästaPos.x + förstaObjektet.width;
        let ettupp = nästaPos.y;
        let ettner = nästaPos.y + förstaObjektet.height;
        
        let tvåvänster = andra.position.x;
        let tvåhöger = andra.position.x + andra.width;
        let tvåupp = andra.position.y;
        let tvåner = andra.position.y + andra.height;

        // Kontrollera om överlapp sker
        if (etthöger > tvåvänster && ettvänster < tvåhöger && ettner > tvåupp && ettupp < tvåner) {
            
            // Beräkna överlapp på båda axlarna
            let överlappVänster = etthöger - tvåvänster;
            let överlappHöger  = tvåhöger - ettvänster;
            let överlappTopp   = tvåner - ettupp;   
            let överlappBotten = ettner - tvåupp;

            let minXÖverlapp = Math.min(överlappVänster, överlappHöger);
            let minYÖverlapp = Math.min(överlappTopp, överlappBotten);

            // Bestäm riktning baserat på minsta överlapp
            if (minXÖverlapp < minYÖverlapp) {
                // X-kollision (vänster eller höger)
                if (överlappVänster < överlappHöger) {
                    kollande.riktning = 'left';
                    return kollande; // träffar från vänster
                } else {
                    kollande.riktning = 'right';
                    return kollande; // träffar från höger
                }
            } else {
                // Y-kollision (topp eller botten)
                if (överlappTopp < överlappBotten) {
                    kollande.riktning = 'top';
                    return kollande; // träffar från ovan
                } else {
                    kollande.riktning = 'bottom'
                    return kollande; // träffar från under
                }
            }
        }

        return null; // ingen kollision
}
}

class mouse
{
    static x = 0; 
    static y = 0;

    static offsetX = 0;
    static offsetY = 0;

    static position(x, y){
        const offsets = duken.getBoundingClientRect();
        mouse.x = x-offsets.left;
        mouse.y = y-offsets.top;
    }
}

class GameObject
{
    static synliga = [];
    static interactable = [];

    constructor(xpos, ypos, bredd, höjd, bildLänk, off = 50){

        this.position = new Vector(xpos, ypos);

        this.width = bredd;
        this.height = höjd;

        this.offsetY = off;

        this.bild = new Image();
        this.bild.src = bildLänk;
        this.hasImage = true;

        this.haschild = false;
        this.child;

        this.hasparent = false;
        this.parent;

        this.animering = new Animation(this);
        this.isAnimated = false;
    }

    uppdateraPosition(xpos, ypos){
        let ny = new Vector(xpos, ypos);
        this.position.setposition(ny);
        if(this.haschild){
            this.child.uppdateraPosition(this.position.x, this.position.y + this.offsetY);
        }
    }   

    addToInteractable(){
        GameObject.interactable.push(this);
    }    

    removeInteractable(){
        let index = GameObject.interactable.indexOf(this);

        GameObject.interactable.splice(index, 1);
    }

    läggMigLängstUppInteract(){
        let indextv = GameObject.interactable.indexOf(this);
        
        GameObject.interactable.splice(indextv, 1);
        GameObject.interactable.push(this);

        if(this.haschild){
            this.child.läggMigLängstUppInteract();
        }
    }

    givechild(barn){
        
        if(this.haschild){
            this.child.givechild(barn);
        }
        else{
            this.child = barn;
            this.haschild = true;

            barn.parent = this;
            barn.hasparent = true;

        }
        

        
    }

    removeChild(){
        this.child.parent = undefined;
        this.child.hasparent = false;

        this.child = undefined;
        this.haschild = false;
        
    }

    removeParent(){
        console.log('removed parent');
        this.parent.child = undefined;
        this.parent.haschild = false;

        this.parent = undefined;
        this.hasparent = false;
    }

    hittaUrfader(){
        
        let fadern;
        if(this.hasparent){
            fadern = this.parent.hittaUrfader();
        }
        else{
            return this
        }

        return fadern;
    }

    hittaUrbarn(){
        let barn;
        if(this.haschild){
            barn = this.child.hittaUrbarn();
        }
        else{
            return this
        }

        return barn;
        //vem behöver while när man kan köra rekursivt
    }

    bytbild(nybild){
        this.bild.src = nybild;
    }

    moveTill(nypos, tid){
        //let anima = new Animation(this.position);

        this.animering.moveStraightTo(nypos, tid);
        //this.position.moveToPosition(nypos, tid);
        this.oldPosition = nypos;

        if(this.haschild){
            let barnpositionen = new Vector(nypos.x, nypos.y + this.offsetY);
            this.child.oldPosition = barnpositionen;
            this.child.moveTill(barnpositionen, tid);
        }
    }

    blirDetInsest(barn){
        
        let vadBlirDet = false;
        if(this.haschild){

            if(this.child === barn){
                return true;
            }
            else {
                vadBlirDet = this.child.blirDetInsest(barn);
            }
        }

        return vadBlirDet;
    }

    static kollaKlickad(){

        for(let i = GameObject.interactable.length - 1; i >= 0; i--){

            let kollad = GameObject.interactable[i];

            if(mouse.x > kollad.position.x && mouse.x < kollad.position.x + kollad.width){
                
                if(mouse.y > kollad.position.y && mouse.y < kollad.position.y + kollad.height){
                    
                    mouse.offsetX = mouse.x - kollad.position.x;
                    mouse.offsetY = mouse.y - kollad.position.y;
                    return GameObject.interactable[i];
                }
            }
        }

        return 69;
    }

    static liggerKolumn(lådaett, lådatvå){
        if(lådaett === lådatvå){
            return false;
        }
        let ettvänster = lådaett.position.x;
        let etthöger = lådaett.position.x + lådaett.width;

        let tvåvänster = lådatvå.position.x;
        let tvåhöger = lådatvå.position.x + lådatvå.width;

        if(ettvänster < tvåhöger && etthöger > tvåvänster){
            return true;
        }

        return false;
    }

    static liggerDem(lådaett, lådatvå){
        if(lådaett === lådatvå){
            return false;
        }
        let ettvänster = lådaett.position.x;
        let etthöger = lådaett.position.x + lådaett.width;

        let tvåvänster = lådatvå.position.x;
        let tvåhöger = lådatvå.position.x + lådatvå.width;

        let ettupp = lådaett.position.y;
        let ettner = lådaett.position.y + lådaett.height;

        let tvåupp = lådatvå.position.y;
        let tvåner = lådatvå.position.y + lådatvå.height;

        if(ettvänster < tvåhöger && etthöger > tvåvänster){

            if(ettupp < tvåner && ettner > tvåupp){
                return true;
            }
        }

        return false;
    }

    static antalBarn(objekt){
        let antalet = 0;
        let objektet = objekt;

        while(objektet.haschild){
            antalet++;
            objektet = objektet.child;
        }

        return antalet;
    }
    
}

export{kontinuerliga, Random, Vector, Animation, fysik, mouse, GameObject};

////////////////////////////////////////
////////////motorgrejer upp/////////////
////////////////////////////////////////
