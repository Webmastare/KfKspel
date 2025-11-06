import { ctx, duken, playing } from "../newtry.js";
import { mouse } from "../brumbrum.js";

export class knappar
{
    static allaKnappar = [];

    constructor(text, position, bredd, höjd, funktion){

        this.text = text;

        this.position = position;

        this.bredd = bredd;
        this.höjd = höjd;

        this.isClickable = true;

        //struntar i font etc så länge, vill inte göra det för komplicerat. 
        //färg och om den ska vara understruken läggs in i (hover)fonten
        //this.font = font;
        //this.hoverfont = hoverfont;

        this.funktion = funktion;

        this.isHovered = false;

        knappar.allaKnappar.push(this);


    }

    ritaMig(){       

        
        let metrics = ctx.measureText(this.text);
        
        let ex = (this.bredd - metrics.width)/2 + this.position.x;
        //let ey = (this.höjd - metrics.actualBoundingBoxAscent)/2 + this.position.y;
        let ey = this.position.y + this.höjd/2 + metrics.actualBoundingBoxAscent/2;
       
        if(this.isHovered){
            //console.log('jag är hovered');
            ctx.strokeStyle = '#2c472f'
            ctx.beginPath();
            
            ctx.moveTo(ex - 3, ey + 5);
            ctx.lineTo(ex + metrics.width, ey + 5);
            ctx.stroke();

            ctx.fillStyle = '#2c472f';
        }
        else{
            //console.log('inte hovered');
            ctx.fillStyle = 'black';
        }

        ctx.fillText(this.text, ex, ey);

        
    }

    onklick(){
        this.funktion();
    }

    static ResetKnappar(){
        console.error('resetknappar');
        knappar.allaKnappar = [];
    }

}

export class botton
{
    static hovard;
    static RitaKnappar(){
        let krasch = false;
        ctx.font = "20px Arial";
        for(let i = 0; i < knappar.allaKnappar.length; i++){
            let knappen = knappar.allaKnappar[i];
            //console.log(knappen);
            knappen.ritaMig();
            krasch = true;
        }
       
    }

    static KollaVilkenKnapp(){

        let träffade = false;
        for(let i = 0; i < knappar.allaKnappar.length; i++){
            let qnappen = knappar.allaKnappar[i];

            if(qnappen.position.x < mouse.x && qnappen.position.x + qnappen.bredd > mouse.x && qnappen.isClickable){
                if(qnappen.position.y < mouse.y && qnappen.position.y + qnappen.höjd > mouse.y){
                    
                    träffade = true;
                    duken.style.cursor = "pointer";
                    if(botton.hovard !== qnappen && botton.hovard !== undefined){
                        botton.hovard.isHovered = false;
                        botton.hovard = qnappen;
                        qnappen.isHovered = true;
                        
                    }
                    else{
                        botton.hovard = qnappen;
                        qnappen.isHovered = true;
                    }
                    break;
                }
            }
        }

        if(!träffade){
            if(botton.hovard !== undefined){
                botton.hovard.isHovered = false;
                botton.hovard = undefined;
                
            }
            
            duken.style.cursor = "default";
        }
    }
}



export class text
{
    
}





























