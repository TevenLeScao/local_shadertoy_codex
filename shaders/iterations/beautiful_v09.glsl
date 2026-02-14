mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);} 

float fbm(vec2 p){
    float f=0.0; float a=0.5;
    for(int i=0;i<6;i++){
        f+=a*sin(p.x)*cos(p.y);
        p=p*2.0+vec2(0.4,0.2);
        p*=rot(0.4);
        a*=0.55;
    }
    return f;
}

void mainImage(out vec4 fragColor,in vec2 fragCoord){
    vec2 uv=(fragCoord-0.5*iResolution.xy)/iResolution.y;
    float t=iTime*0.33;

    vec2 p=uv;
    float n=fbm(p*3.0+vec2(0.0,t*1.5));
    float m=fbm((p+vec2(0.7,-0.2))*2.4-vec2(t*0.5,0.0));
    float flow=fbm(p*4.2+vec2(n,m)*2.0+t);

    float r=length(p+0.07*vec2(sin(t),cos(t*0.8)));
    float a=atan(p.y,p.x);

    vec3 deep=vec3(0.02,0.05,0.14);
    vec3 blue=vec3(0.18,0.45,0.95);
    vec3 amber=vec3(0.96,0.58,0.22);
    vec3 pearl=vec3(0.96,0.9,0.78);

    vec3 col=deep;
    float bands=0.5+0.5*sin(10.0*a-2.0*t+12.0*flow+14.0*r);
    col+=mix(blue,amber,bands)*(0.35+0.65*exp(-2.0*r));

    float wisps=exp(-10.0*abs(flow+0.25*sin(5.0*r-t)-0.08));
    col+=pearl*wisps*0.35;

    float iris=exp(-14.0*abs(r-0.37-0.05*sin(t*1.4+flow*3.0)));
    col+=mix(vec3(0.4,0.7,1.0),vec3(1.0,0.75,0.4),0.5+0.5*sin(t+flow*4.0))*iris*0.4;

    col*=smoothstep(1.08,0.08,length(uv));
    fragColor=vec4(col,1.0);
}
