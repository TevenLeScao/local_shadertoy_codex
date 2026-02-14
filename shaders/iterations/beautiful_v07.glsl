mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);} 

void mainImage(out vec4 fragColor,in vec2 fragCoord){
    vec2 uv=(fragCoord-0.5*iResolution.xy)/iResolution.y;
    float t=iTime*0.38;

    vec3 col=vec3(0.02,0.03,0.07);

    vec2 p=uv;
    for(int i=0;i<11;i++){
        float fi=float(i);
        p=abs(p*rot(0.33+0.05*sin(t+fi)))-vec2(0.28+0.03*cos(fi+t),0.18+0.02*sin(fi*1.3+t));
        float d=length(p);
        vec3 c=mix(vec3(0.22,0.5,1.0),vec3(1.0,0.52,0.2),0.5+0.5*sin(fi*0.8+t));
        col+=c*(0.013/(0.012+d));
    }

    float a=atan(uv.y,uv.x);
    float r=length(uv);
    float ribbon=sin(14.0*a-5.0*t+20.0*r);
    col+=mix(vec3(0.2,0.35,0.95),vec3(1.0,0.7,0.35),0.5+0.5*ribbon)*exp(-2.3*r)*0.55;

    float halo=exp(-10.0*abs(r-0.42-0.05*sin(t*1.1)));
    col+=vec3(1.0,0.96,0.82)*halo*0.25;

    col*=smoothstep(1.08,0.12,r);
    fragColor=vec4(col,1.0);
}
