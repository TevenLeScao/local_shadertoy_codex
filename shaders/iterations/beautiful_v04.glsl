mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);} 

float flower(vec2 p,float petals,float phase){
    float a=atan(p.y,p.x);
    float r=length(p);
    float k=0.36+0.14*cos(petals*a+phase);
    return r-k;
}

void mainImage(out vec4 fragColor,in vec2 fragCoord){
    vec2 uv=(fragCoord-0.5*iResolution.xy)/iResolution.y;
    float t=iTime*0.42;

    vec3 col=vec3(0.01,0.01,0.03);

    for(int i=0;i<4;i++){
        float fi=float(i);
        vec2 c=0.22*vec2(cos(t*0.6+fi*1.57),sin(t*0.8+fi*1.3));
        vec2 p=(uv-c)*rot(0.5*sin(t+fi));
        float f=flower(p,8.0+fi*2.0,t*(1.0+0.2*fi));
        float core=exp(-32.0*length(p));
        float edge=exp(-24.0*abs(f));
        vec3 hue=mix(vec3(0.2,0.6,1.0),vec3(1.0,0.35,0.25),0.5+0.5*sin(fi*2.0+t));
        col+=hue*(edge*0.22+core*0.4);
    }

    float a=atan(uv.y,uv.x);
    float r=length(uv);
    float swirl=sin(10.0*a-4.0*t+28.0*r);
    col+=mix(vec3(0.12,0.18,0.6),vec3(0.9,0.55,0.25),0.5+0.5*swirl)*exp(-2.8*r)*0.45;

    float veil=0.0;
    vec2 q=uv;
    for(int i=0;i<6;i++){
        q=abs(q*rot(0.35))-vec2(0.33,0.12);
        veil+=0.012/(0.02+length(q));
    }
    col+=vec3(0.95,0.92,0.8)*veil*0.35;

    col*=smoothstep(1.08,0.08,r);
    fragColor=vec4(col,1.0);
}
