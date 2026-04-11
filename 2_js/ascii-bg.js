/* ============================================================
   Interactive ASCII Hero Background
   Adapted from OpenHands (openhands.dev) — MULTI-INSTANCE
   ASCII Grid with Pixely Erase Trail on mouse move.
   ============================================================ */
(()=>{
  const CFG={
    angleDeg:0,
    frequency:11,
    contrast:0.35,
    edgeWidth:0.04,
    gapLevel:0.3,
    flowSpeed:0.018,
    driftX:0,
    driftY:-0.018,
    warpAmp:0.42,
    warpScale:1.4,
    warpSpeed:0.001,
    bandJitter:{enabled:true,amp:0.2,scale:0.85,speed:0.05},
    randomSet:Array.from(" .,:;*+![]{}<>-~"),
    lineSet:Array.from(" MAX DELAPORTE  // "),
    gapSet:Array.from("/"),
    randomChangeHz:1.5,
    lineThreshold:0,
    gapThreshold:1,
    gapFan:{enabled:true,strength:0.5},
    streaks:{
      enabled:true,count:3,char:" ",
      randomDirection:true,useDriftDirection:true,
      angleJitterDeg:75,widthMin:0.008,widthMax:0.028,
      lengthMin:0.22,lengthMax:0.7,speedMin:0.12,speedMax:0.3,
      startMargin:0.18
    },
    gapClouds:{enabled:true,density:0.08,scale:1.6,speed:0.03,octaves:3,hardness:0.85},
    erase:{enabled:true,radiusCells:12,durationSec:0.9,jitter:0.35,hardness:0.6},
    fpsCap:30
  };

  /* ---- Perlin noise helpers ---- */
  const G=[];
  for(let i=0;i<256;i++){const a=i/256*Math.PI*2;G[i]={x:Math.cos(a),y:Math.sin(a)};}
  const P=new Uint8Array(512);
  (function seedPerm(){
    const base=new Uint8Array(256);
    for(let i=0;i<256;i++)base[i]=i;
    let s=1234567;
    const rnd=()=>((s=s*1664525+1013904223>>>0)/0xffffffff);
    for(let i=255;i>0;i--){const j=rnd()*(i+1)|0;const tmp=base[i];base[i]=base[j];base[j]=tmp;}
    for(let i=0;i<512;i++)P[i]=base[i&255];
  })();

  const clamp=(v,a,b)=>v<a?a:v>b?b:v;
  const fade=t=>t*t*t*(t*(t*6-15)+10);

  function grad(ix,iy,x,y){
    const X=ix&255,Y=iy&255;
    const g=G[P[X+P[Y]]];
    return g.x*(x-ix)+g.y*(y-iy);
  }

  function perlin(x,y){
    const x0=Math.floor(x),y0=Math.floor(y);
    const x1=x0+1,y1=y0+1;
    const sx=fade(x-x0),sy=fade(y-y0);
    const n00=grad(x0,y0,x,y),n10=grad(x1,y0,x,y);
    const n01=grad(x0,y1,x,y),n11=grad(x1,y1,x,y);
    const ix0=n00+sx*(n10-n00),ix1=n01+sx*(n11-n01);
    return ix0+sy*(ix1-ix0);
  }

  function fbm(x,y,oct,gain,lac){
    oct=oct||3;gain=gain||0.5;lac=lac||2;
    let v=0,amp=1,f=1,norm=0;
    for(let i=0;i<oct;i++){v+=amp*perlin(x*f,y*f);norm+=amp;amp*=gain;f*=lac;}
    return v/(norm||1);
  }

  function hash32(n){
    n=(n>>>0)+0x9e3779b9;n^=n>>>16;
    n=Math.imul(n,0x85ebca6b);n^=n>>>13;
    n=Math.imul(n,0xc2b2ae35);n^=n>>>16;
    return n>>>0;
  }

  function hash3(x,y,z){
    let h=2166136261;
    h^=x|0;h=Math.imul(h,16777619);
    h^=y|0;h=Math.imul(h,16777619);
    h^=z|0;h=Math.imul(h,16777619);
    return h>>>0;
  }

  const pickFrom=(arr,h)=>arr[h%arr.length];
  const randRange=(a,b)=>a+Math.random()*(b-a);

  /* ---- Target all .ascii-embed containers ---- */
  const hosts=Array.from(document.querySelectorAll(".ascii-embed"));
  if(!hosts.length)return;

  hosts.forEach(host=>{
    const pre=host.querySelector(".ascii-pre")||(function(){
      const el=document.createElement("pre");
      el.className="ascii-pre";
      el.setAttribute("aria-hidden","true");
      host.appendChild(el);
      return el;
    })();

    let cols=0,rows=0,sShort=1;
    let t0=performance.now(),lastFrame=0,lastT=0;
    let cellW=8,cellH=14;
    let eraseBuf=new Float32Array(1);

    function measureCell(){
      const probe=document.createElement("span");
      probe.textContent="M".repeat(200);
      probe.style.cssText="position:absolute;left:-9999px;top:-9999px;white-space:pre;pointer-events:none;visibility:hidden;";
      const cs=getComputedStyle(pre);
      probe.style.font=cs.font;
      probe.style.letterSpacing=cs.letterSpacing;
      host.appendChild(probe);
      const totalW=probe.getBoundingClientRect().width;
      host.removeChild(probe);
      const cw=totalW/200||8;
      const lh=parseFloat(cs.lineHeight)||14;
      return{cw,lh};
    }

    function computeGrid(){
      const m=measureCell();
      cellW=m.cw; cellH=m.lh;
      const rect=host.getBoundingClientRect();
      const c=Math.max(1,Math.floor(rect.width/cellW));
      const r=Math.max(1,Math.floor(rect.height/cellH));
      if(c===cols&&r===rows)return;
      cols=c; rows=r; sShort=cols<rows?cols:rows;
      eraseBuf=new Float32Array(cols*rows);
    }

    /* ---- Streaks ---- */
    const ST={list:[]};

    function makeDir(){
      let dx=CFG.driftX||0.0001,dy=CFG.driftY||0;
      if(CFG.streaks.randomDirection){
        let base=CFG.streaks.useDriftDirection?Math.atan2(dy,dx):0;
        base+=randRange(-1,1)*CFG.streaks.angleJitterDeg*Math.PI/180;
        dx=Math.cos(base);dy=Math.sin(base);
      }
      const len=Math.hypot(dx,dy)||1;
      return{dx:dx/len,dy:dy/len,nx:-dy/len,ny:dx/len};
    }

    function makeStreak(t){
      const s=CFG.streaks,m=s.startMargin,D=makeDir();
      return{dirx:D.dx,diry:D.dy,nrmx:D.nx,nrmy:D.ny,
        p0:randRange(-m,1+m),width:randRange(s.widthMin,s.widthMax),
        length:randRange(s.lengthMin,s.lengthMax),speed:randRange(s.speedMin,s.speedMax),
        headStart:-(randRange(s.lengthMin,s.lengthMax)+m),bornAt:t};
    }

    function resetStreak(i,t){ST.list[i]=makeStreak(t);}

    function initStreaks(t){
      ST.list.length=0;
      if(!CFG.streaks.enabled||CFG.streaks.count<=0)return;
      for(let i=0;i<CFG.streaks.count;i++)ST.list.push(makeStreak(t));
    }

    function inAnyStreak(u,v,t){
      if(!CFG.streaks.enabled||!ST.list.length)return false;
      const sm=CFG.streaks.startMargin;
      for(let i=0;i<ST.list.length;i++){
        const st=ST.list[i];
        const sC=u*st.dirx+v*st.diry;
        const pC=u*st.nrmx+v*st.nrmy;
        const head=st.headStart+st.speed*t;
        const tail=head-st.length;
        if(head>1+sm){resetStreak(i,t);continue;}
        if(Math.abs(pC-st.p0)<=st.width*0.5&&sC>=tail&&sC<=head)return true;
      }
      return false;
    }

    function inGapCloud(u,v,t){
      if(!CFG.gapClouds.enabled)return false;
      const c=CFG.gapClouds;
      const n=fbm(u*c.scale+t*c.speed+11.3,v*c.scale-t*c.speed-7.9,c.octaves,0.55,2);
      const h=Math.pow(n,c.hardness);
      const cellJit=(hash3(u*9999|0,v*9999|0,Math.floor(t))%997/997)*0.02;
      return h+cellJit>1-c.density;
    }

    /* ---- Erase on mouse move ---- */
    function applyErase(cx,cy){
      if(!CFG.erase.enabled)return;
      const R=CFG.erase.radiusCells|0;
      const dur=CFG.erase.durationSec;
      const hard=clamp(CFG.erase.hardness,0,1);
      const jit=clamp(CFG.erase.jitter,0,1);
      const r2=R*R;
      const x0=Math.max(0,cx-R),x1=Math.min(cols-1,cx+R);
      const y0=Math.max(0,cy-R),y1=Math.min(rows-1,cy+R);
      for(let y=y0;y<=y1;y++){
        for(let x=x0;x<=x1;x++){
          const dx=x-cx,dy=y-cy;
          if(dx*dx+dy*dy>r2)continue;
          const d=Math.sqrt(dx*dx+dy*dy)/R;
          const falloff=Math.pow(1-d,hard*3+0.01);
          const h=hash3(x*131+y*911,y*521+x*173,cx*7+cy*13)%1000/1000;
          if(h<falloff*(1-jit)+(falloff>0.5?jit*0.6:jit*0.2)){
            const idx=y*cols+x;
            eraseBuf[idx]=Math.max(eraseBuf[idx],dur*falloff);
          }
        }
      }
    }

    function eventToCell(ev,targetEl){
      const rect=targetEl.getBoundingClientRect();
      const touch=ev.touches?ev.touches[0]:ev;
      const ex=touch.clientX-rect.left;
      const ey=touch.clientY-rect.top;
      return{
        cx:Math.min(cols-1,Math.max(0,Math.floor(ex/cellW))),
        cy:Math.min(rows-1,Math.max(0,Math.floor(ey/cellH)))
      };
    }

    // Listen on both the pre (visible background) and the whole hero section
    // so the erase effect works even when hovering over the content card
    const heroSection=host.closest('.hero')||host.parentElement;

    function onMovePre(ev){const p=eventToCell(ev,pre);applyErase(p.cx,p.cy);}
    function onMoveHero(ev){
      // Translate hero coords to pre coords (pre is absolute inset:0 within hero)
      const p=eventToCell(ev,pre);
      applyErase(p.cx,p.cy);
    }

    pre.addEventListener("mousemove",onMovePre);
    pre.addEventListener("touchstart",onMovePre,{passive:true});
    pre.addEventListener("touchmove",onMovePre,{passive:true});
    if(heroSection&&heroSection!==pre){
      heroSection.addEventListener("mousemove",onMoveHero);
      heroSection.addEventListener("touchmove",onMoveHero,{passive:true});
    }

    /* ---- Band sampling ---- */
    function sampleBands(x,y,t,rowNorm){
      const s=sShort||1;
      let u=x/s,v=y/s;
      u-=CFG.driftX*t;
      v-=CFG.driftY*t;
      const wt=t*CFG.warpSpeed;
      const wx=CFG.warpAmp*fbm(u*CFG.warpScale+10.1+wt,v*CFG.warpScale-9.3-wt,3,0.55,2);
      const wy=CFG.warpAmp*fbm(u*CFG.warpScale-30.9-wt,v*CFG.warpScale+19.7+wt,3,0.8,2);
      const ang=CFG.angleDeg*Math.PI/180;
      const rx=(u+wx)*Math.cos(ang)+(v+wy)*Math.sin(ang);
      const bandWave=0.5+0.5*Math.sin(rx*Math.PI*2*(CFG.frequency/2));
      const ink=Math.pow(bandWave,CFG.contrast);
      const gap=1-ink;
      let gLevel=CFG.gapLevel;
      if(CFG.gapFan.enabled){gLevel+=(1-rowNorm)*CFG.gapFan.strength;}
      if(CFG.bandJitter.enabled){
        const j=fbm(u*CFG.bandJitter.scale+77.1,v*CFG.bandJitter.scale-99.8,3,0.55,2);
        gLevel+=CFG.bandJitter.amp*(j-0.5)*2+Math.sin(t*CFG.bandJitter.speed)*0.02;
      }
      const aL=gLevel-CFG.edgeWidth,bL=gLevel+CFG.edgeWidth;
      const tLine=clamp(1-(gap-aL)/(bL-aL),0,1);
      const tGap=clamp((gap-aL)/(bL-aL),0,1);
      const bandIndex=Math.floor(rx*CFG.frequency);
      return{u:u+wx,v:v+wy,bandIndex,tLine,tGap};
    }

    function baseChar(x,y,t,b){
      const{u,v,bandIndex,tLine,tGap}=b;
      if(inGapCloud(u,v,t))return" ";
      if(inAnyStreak(u,v,t-t0/1000))return CFG.streaks.char;
      if(tLine>CFG.lineThreshold)return pickFrom(CFG.lineSet,hash32(bandIndex*73856093));
      if(tGap>CFG.gapThreshold)return pickFrom(CFG.gapSet,hash32(bandIndex*19349663));
      const slice=Math.floor(t*CFG.randomChangeHz);
      const h=hash32((x+1)*15485863^(y+1)*32452843^slice*49979687);
      return CFG.randomSet[h%CFG.randomSet.length];
    }

    function chooseChar(x,y,t,b){
      if(eraseBuf[y*cols+x]>0)return" ";
      return baseChar(x,y,t,b);
    }

    /* ---- Render loop ---- */
    function render(now){
      if(now-lastFrame<1000/CFG.fpsCap){requestAnimationFrame(render);return;}
      const t=(now-t0)/1000;
      const dt=t-lastT; lastT=t; lastFrame=now;
      if(CFG.erase.enabled){
        const decay=dt>0?dt:0.016;
        for(let i=0;i<eraseBuf.length;i++){const v=eraseBuf[i]-decay;eraseBuf[i]=v>0?v:0;}
      }
      let out="";
      for(let y=0;y<rows;y++){
        const rowNorm=rows<=1?0:y/(rows-1);
        for(let x=0;x<cols;x++){out+=chooseChar(x,y,t,sampleBands(x,y,t,rowNorm));}
        if(y<rows-1)out+="\n";
      }
      pre.textContent=out;
      requestAnimationFrame(render);
    }

    const ro=new ResizeObserver(computeGrid);
    ro.observe(host);

    if(document.fonts&&document.fonts.ready){
      document.fonts.ready.then(()=>{computeGrid();initStreaks(0);requestAnimationFrame(render);});
    }else{computeGrid();initStreaks(0);requestAnimationFrame(render);}

    /* ---- Pause when tab hidden to save CPU ---- */
    let pausedAt=null;
    document.addEventListener("visibilitychange",()=>{
      if(document.visibilityState==="hidden"){pausedAt=performance.now();}
      else if(pausedAt!==null){const d=performance.now()-pausedAt;t0+=d;pausedAt=null;lastFrame=0;requestAnimationFrame(render);}
    });
  });
})();
