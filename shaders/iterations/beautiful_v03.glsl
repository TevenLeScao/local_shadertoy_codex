float h(vec2 p){return fract(sin(dot(p,vec2(41.0,289.0)))*43758.5453);} 
mat2 r2(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);} 

float fbm(vec2 p){
    float f=0.0,a=0.55;
    for(int i=0;i<5;i++){
        f+=a*sin(p.x)*cos(p.y);
        p=p*1.9+r2(0.5)*vec2(0.2,0.4);
        a*=0.55;
    }
    return f;
}

void mainImage(out vec4 fragColor,in vec2 fragCoord){
    vec2 uv=(fragCoord-0.5*iResolution.xy)/iResolution.y;
    float t=iTime*0.28;

    vec2 p=uv;
    float z=0.0;
    vec3 col=vec3(0.01,0.02,0.04);

    for(int i=0;i<9;i++){
        float fi=float(i);
        vec2 q=p*(1.1+0.11*fi)+vec2(0.0,fi*0.4);
        q*=r2(0.2*sin(t+fi*0.9));
        float n=fbm(q*2.6+vec2(0.0,t*2.0));
        float band=exp(-8.0*abs(q.y+0.25*sin(q.x*1.7+t+fi)));
        vec3 c=mix(vec3(0.14,0.26,0.72),vec3(0.96,0.52,0.24),0.5+0.5*sin(fi*0.9+t+n));
        col+=c*band*(0.08+0.055*sin(fi+t*1.3));
        z+=0.03/(0.03+length(q-vec2(0.0,0.15*sin(t+fi))));
    }

    float r=length(uv);
    float halo=exp(-7.0*abs(r-0.36-0.05*sin(t*1.2)));
    col+=vec3(0.95,0.88,0.7)*halo*0.32;
    col+=vec3(0.78,0.9,1.0)*z*0.16;

    float stars=smoothstep(0.995,1.0,h(floor((uv+3.0)*vec2(280.0,180.0))));
    col+=vec3(1.0,0.95,0.8)*stars*0.45;

    col*=smoothstep(1.15,0.1,r);
    col+=(h(fragCoord+t*90.0)-0.5)*0.012;

    fragColor=vec4(col,1.0);
}
