// Full-screen quad vertex shader
export const VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main(){
  v_uv = a_pos*.5+.5;
  gl_Position = vec4(a_pos, 0, 1);
}`

// Raymarched fractal lattice with chromatic aberration,
// volumetric glow, energy rings, and domain warping
export const FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
uniform float u_time;
uniform vec2 u_res;
out vec4 fc;

#define STEPS 90
#define FAR 70.0
#define EPS 0.001
#define PI 3.14159265

mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}

float box(vec3 p,vec3 b){
  vec3 q=abs(p)-b;
  return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);
}

float octahedron(vec3 p,float s){
  p=abs(p);
  return (p.x+p.y+p.z-s)*0.577;
}

float smin(float a,float b,float k){
  float h=clamp(.5+.5*(a-b)/k,0.,1.);
  return mix(a,b,h)-k*h*(1.-h);
}

// Cross-Menger fractal hybrid
float fractal(vec3 p,float t){
  float d=box(p,vec3(1.));
  float s=1.;
  for(int i=0;i<3;i++){
    vec3 a=mod(p*s,2.)-1.;
    s*=3.;
    vec3 r=abs(1.-3.*abs(a));
    r.xy*=rot(t*.1+float(i));
    float da=max(r.x,r.y);
    float db=max(r.y,r.z);
    float dc=max(r.z,r.x);
    float c=(min(da,min(db,dc))-1.)/s;
    d=max(d,c);
  }
  return d;
}

vec2 scene(vec3 p){
  float t=u_time;
  float d=FAR, m=0.;

  float R=6.0;
  // Domain warp -- space breathes
  p.x+=sin(p.z*.15+t*.4)*.8;
  p.y+=cos(p.x*.12+t*.3)*.5;

  vec3 id=round(p/R);
  vec3 q=p-R*id;
  float ph=dot(id,vec3(1.7,0.9,2.3));

  // Aggressive rotation per cell
  q.xz*=rot(t*.4+ph);
  q.yz*=rot(t*.3+ph*.7);
  q.xy*=rot(t*.15+ph*.3);

  // Morphing fractal structure
  float sz=1.8+.5*sin(t*.7+ph);
  float morph=sin(t*.3+ph)*.5+.5;
  float shell=max(octahedron(q,sz),-(length(q)-sz*.5));
  float frac=fractal(q*(.8+.2*sin(t*.2)),t)*.8;
  float structure=mix(shell,frac,morph*.6);
  if(structure<d){d=structure;m=0.;}

  // Pulsing core
  float coreSize=.4+.25*sin(t*3.+ph)+.15*sin(t*7.+ph*2.);
  float core=length(q)-coreSize;
  if(core<d){d=core;m=3.;}

  // Triple beam system
  vec3 b1=p; b1.xz=mod(b1.xz+R*.5,R)-R*.5;
  float bY=length(b1.xz)-.04-.02*sin(p.y*3.+t*5.);
  vec3 b2=p; b2.xy=mod(b2.xy+R*.5,R)-R*.5;
  float bZ=length(b2.xy)-.04-.02*sin(p.z*3.+t*4.);
  vec3 b3=p; b3.yz=mod(b3.yz+R*.5,R)-R*.5;
  float bX=length(b3.yz)-.04-.02*sin(p.x*3.+t*6.);
  float beams=min(bY,min(bZ,bX));
  if(beams<d){d=beams;m=2.;}

  // Floating energy rings
  float ring=abs(length(q.xz)-1.8-.3*sin(t*2.+ph))-.06;
  ring=max(ring,abs(q.y)-.08);
  if(ring<d){d=ring;m=4.;}

  // Ground with displacement
  float gnd=p.y+4.5+.4*sin(p.x*.5+t)*.5*sin(p.z*.5+t*.7);
  if(gnd<d){d=gnd;m=1.;}

  return vec2(d,m);
}

vec3 normal(vec3 p){
  vec2 e=vec2(EPS,0);
  float d=scene(p).x;
  return normalize(vec3(
    scene(p+e.xyy).x-d,
    scene(p+e.yxy).x-d,
    scene(p+e.yyx).x-d
  ));
}

float ao(vec3 p,vec3 n){
  float r=0.,s=1.;
  for(int i=1;i<=4;i++){
    float h=.05*float(i);
    r+=(h-scene(p+h*n).x)*s;
    s*=.8;
  }
  return clamp(1.-5.*r,0.,1.);
}

vec3 march(vec3 ro,vec3 rd,float t,out float totalDist,out bool didHit,out float matId){
  totalDist=0.;
  vec3 glow=vec3(0);
  didHit=false;
  matId=0.;

  float pulse=.7+.3*sin(t*2.);
  float fastPulse=.8+.2*sin(t*8.);

  for(int i=0;i<STEPS;i++){
    vec3 p=ro+rd*totalDist;
    vec2 r=scene(p);
    float h=r.x;

    float g=.018/(1.+h*h*6.)*pulse;
    float hue=fract(totalDist*.08+t*.15);
    vec3 gc=.5+.5*cos(6.28*(hue+vec3(0,.33,.67)));
    float dataPulse=pow(max(sin(p.y*4.-t*12.)*.5+.5,0.),6.)
                   +pow(max(sin(p.x*4.+t*10.)*.5+.5,0.),6.)*.5
                   +pow(max(sin(p.z*4.-t*9.)*.5+.5,0.),6.)*.3;
    gc*=1.+dataPulse*2.*fastPulse;
    glow+=g*gc;

    if(h<EPS){matId=r.y;didHit=true;break;}
    totalDist+=h;
    if(totalDist>FAR)break;
  }
  return glow;
}

void main(){
  vec2 uv=(gl_FragCoord.xy-.5*u_res)/u_res.y;
  float t=u_time;

  // Fast swooping camera
  float speed=4.0;
  vec3 ro=vec3(
    sin(t*.17)*12.+cos(t*.31)*4.,
    2.5+sin(t*.23)*3.+cos(t*.41)*1.5,
    t*speed
  );
  vec3 ta=ro+vec3(
    sin(t*.13+1.)*4.+cos(t*.29)*2.,
    sin(t*.19)*2.-1.,
    6.
  );
  float roll=sin(t*.11)*.15;
  vec3 ww=normalize(ta-ro);
  vec3 uu=normalize(cross(ww,vec3(sin(roll),cos(roll),0)));
  vec3 vv=cross(uu,ww);
  vec3 rd=normalize(uv.x*uu+uv.y*vv+1.3*ww);

  // Chromatic aberration -- 3 ray marches
  float caStr=.008+.004*sin(t*1.5);
  vec3 rdR=normalize(rd+uu*caStr);
  vec3 rdB=normalize(rd-uu*caStr);

  float distG,distR,distB;
  bool hitG,hitR,hitB;
  float matG,matR,matB;

  vec3 glowG=march(ro,rd,t,distG,hitG,matG);
  vec3 glowR=march(ro,rdR,t,distR,hitR,matR);
  vec3 glowB=march(ro,rdB,t,distB,hitB,matB);

  vec3 col=vec3(.003,.003,.01);

  if(hitG){
    vec3 p=ro+rd*distG;
    vec3 n=normal(p);
    vec3 li=normalize(vec3(sin(t*.4),1,cos(t*.4)));
    float dif=max(dot(n,li),0.);
    float spc=pow(max(dot(reflect(-li,n),-rd),0.),64.);
    float occ=ao(p,n);
    float frs=pow(1.-max(dot(n,-rd),0.),4.);

    vec3 mc;
    if(matG<.5){
      float edge=1.-abs(dot(n,-rd));
      float edgePow=pow(edge,3.)*3.;
      mc=vec3(.05,.5,.8)+vec3(.2,.6,1.)*edgePow;
      mc+=vec3(1.,.3,.7)*edgePow*sin(t*3.+p.y*2.)*.5;
    } else if(matG<1.5){
      vec2 gp=fract(p.xz*.5)-.5;
      float gr=smoothstep(.015,0.,min(abs(gp.x),abs(gp.y)));
      float wave=sin(length(p.xz)*1.5-t*4.)*.5+.5;
      mc=vec3(.01,.02,.05)+gr*vec3(0,.3,.5)*.6;
      mc+=wave*vec3(0,.15,.3)*.3;
      mc+=frs*vec3(.1,.3,.6)*.5;
    } else if(matG<2.5){
      float flow=pow(max(sin(p.y*4.-t*12.)*.5+.5,0.),6.);
      float flow2=pow(max(sin(p.x*4.+t*10.)*.5+.5,0.),6.);
      float totalFlow=max(flow,flow2);
      mc=mix(vec3(0,.5,.7),vec3(.2,1.,.9),totalFlow)*(1.+totalFlow*4.);
    } else if(matG<3.5){
      float hue=fract(t*.2+dot(p,vec3(.1)));
      mc=1.5+1.5*cos(6.28*(hue+vec3(0,.33,.67)));
      mc*=2.;
    } else {
      mc=vec3(1.,.7,.2)*2.;
      mc+=vec3(1.,.3,.1)*sin(t*5.+p.x*3.)*1.5;
    }

    col=mc*(dif*.6+.1)*occ+spc*vec3(1)*1.2+frs*vec3(.1,.2,.5)*.6;
    col=mix(vec3(.003,.005,.015),col,exp(-distG*.035));
  }

  // Apply chromatic aberration
  float colR=col.r;
  float colB=col.b;
  if(hitR){
    vec3 pR=ro+rdR*distR;
    vec3 nR=normal(pR);
    float edge=1.-abs(dot(nR,-rdR));
    colR+=pow(edge,3.)*.8;
    colR*=exp(-distR*.035);
  }
  colR+=glowR.r*.4;
  if(hitB){
    vec3 pB=ro+rdB*distB;
    vec3 nB=normal(pB);
    float edge=1.-abs(dot(nB,-rdB));
    colB+=pow(edge,3.)*.8;
    colB*=exp(-distB*.035);
  }
  colB+=glowB.b*.4;
  col.r=mix(col.r,colR,.5);
  col.b=mix(col.b,colB,.5);

  col+=glowG*.4;

  // Beat flash
  float beat=pow(max(sin(t*2.*PI*.5)*.5+.5,0.),16.);
  col+=beat*vec3(.05,.1,.2);

  // Scanlines
  col*=.94+.06*sin(gl_FragCoord.y*2.);

  // Vignette
  float vig=1.2-.6*pow(length(v_uv-.5)*1.6,2.);
  col*=vig;

  // ACES tonemap
  col=col*(2.51*col+.03)/(col*(2.43*col+.59)+.14);
  col=pow(clamp(col,0.,1.),vec3(.85));

  fc=vec4(col,1);
}
`
