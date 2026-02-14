float hash(vec2 p){return fract(sin(dot(p,vec2(91.7,271.9)))*43758.5453);} 

void mainImage(out vec4 fragColor,in vec2 fragCoord){
    vec2 uv=fragCoord/iResolution.xy;
    vec2 p=(fragCoord-0.5*iResolution.xy)/iResolution.y;
    float t=iTime*0.25;

    vec3 skyTop=vec3(0.03,0.06,0.16);
    vec3 skyMid=vec3(0.12,0.19,0.34);
    vec3 skyH=vec3(0.32,0.28,0.40);

    vec3 col=mix(skyH,skyTop,smoothstep(0.0,0.95,uv.y));
    col=mix(col,skyMid,exp(-18.0*abs(uv.y-0.52)));

    vec2 moonP=p-vec2(0.0,0.18+0.02*sin(t));
    float moon=length(moonP)-0.16;
    col=mix(col,vec3(0.96,0.93,0.82),smoothstep(0.01,-0.01,moon));

    float halo=exp(-12.0*abs(length(moonP)-0.19));
    col+=vec3(0.75,0.8,1.0)*halo*0.14;

    float water=step(uv.y,0.48);
    vec2 w=p;
    w.x+=0.03*sin(22.0*w.y-3.0*t)+0.01*sin(41.0*w.y+1.7*t);
    float refl=length(vec2(w.x,abs(w.y+0.16)))-0.16;
    vec3 waterBase=vec3(0.02,0.05,0.10);
    col=mix(col,waterBase,water);
    col=mix(col,vec3(0.70,0.72,0.76),smoothstep(0.03,-0.02,refl)*water*0.75);

    float rip=0.5+0.5*sin(120.0*uv.y+8.0*sin(uv.x*7.0)-t*3.0);
    col+=vec3(0.08,0.1,0.14)*rip*water*0.22;

    float stars=smoothstep(0.996,1.0,hash(floor(uv*vec2(600.0,260.0))));
    col+=vec3(1.0,0.96,0.82)*stars*(1.0-water)*0.45;

    col+=(hash(fragCoord+t*80.0)-0.5)*0.008;
    fragColor=vec4(col,1.0);
}
