mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);} 

float fbm(vec2 p){
    float f=0.0,a=0.55;
    for(int i=0;i<5;i++){
        f+=a*sin(p.x)*cos(p.y);
        p=p*2.0+vec2(0.3,0.5);
        p*=rot(0.5);
        a*=0.55;
    }
    return f;
}

void mainImage(out vec4 fragColor,in vec2 fragCoord){
    vec2 uv=(fragCoord-0.5*iResolution.xy)/iResolution.y;
    float t=iTime*0.34;

    vec2 p=uv;
    float n=fbm(p*3.2+vec2(0.0,t*1.4));
    float m=fbm((p+vec2(0.5,-0.3))*2.6-vec2(t*0.6,0.0));
    float flow=fbm(p*4.8+vec2(n,m)*1.9+t*0.6);

    float r=length(p);
    float a=atan(p.y,p.x);

    vec3 base=vec3(0.012,0.03,0.10);
    vec3 blue=vec3(0.22,0.50,0.98);
    vec3 amber=vec3(0.98,0.62,0.25);
    vec3 pearl=vec3(0.98,0.93,0.80);

    vec3 col=base;

    float vortex=0.5+0.5*sin(9.0*a-2.4*t+13.0*flow+10.0*r);
    col+=mix(blue,amber,vortex)*(0.25+0.75*exp(-1.8*r));

    float tendrils=exp(-12.0*abs(flow+0.28*sin(6.0*r-1.2*t)-0.04));
    col+=pearl*tendrils*0.34;

    float iris=exp(-16.0*abs(r-0.34-0.04*sin(t+flow*3.4)));
    col+=mix(vec3(0.5,0.8,1.0),vec3(1.0,0.76,0.42),0.5+0.5*sin(t+flow*3.0))*iris*0.42;

    float spokes=pow(max(0.0,cos(14.0*a+2.0*flow-1.8*t)),6.0)*exp(-2.0*r);
    col+=pearl*spokes*0.26;

    col*=smoothstep(1.08,0.08,r);
    fragColor=vec4(col,1.0);
}
