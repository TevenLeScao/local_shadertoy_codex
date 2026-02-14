mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);} 

float star(vec2 p,float n,float m){
    float a=atan(p.y,p.x);
    float r=length(p);
    float k=cos(floor(0.5+a/3.14159265*n)*3.14159265/n-a)*m;
    return r-k;
}

void mainImage(out vec4 fragColor,in vec2 fragCoord){
    vec2 uv=(fragCoord-0.5*iResolution.xy)/iResolution.y;
    float t=iTime*0.4;
    vec2 p=uv*rot(0.12*sin(t*0.8));

    float r=length(p);
    float a=atan(p.y,p.x);

    float rosette=star(p,12.0,0.28+0.03*sin(t));
    float ring=abs(r-(0.35+0.03*sin(t*1.2)))-0.025;
    float spokes=abs(sin(12.0*a+2.0*sin(t)+r*18.0))-0.92;

    float tiles=0.0;
    vec2 q=p;
    for(int i=0;i<6;i++){
        q=abs(q*rot(0.38))-vec2(0.22,0.14+0.02*sin(t+float(i)));
        tiles+=0.011/(0.02+length(q));
    }

    vec3 col=vec3(0.03,0.04,0.08);
    vec3 c1=vec3(0.22,0.42,0.95);
    vec3 c2=vec3(0.96,0.66,0.22);
    vec3 c3=vec3(0.90,0.96,1.0);

    float mixer=0.5+0.5*sin(8.0*a-2.0*t+6.0*r);
    col+=mix(c1,c2,mixer)*(1.0-smoothstep(0.0,0.8,r))*0.8;
    col+=c3*tiles*0.55;

    col=mix(col,vec3(0.95,0.87,0.65),smoothstep(0.006,-0.006,rosette)*0.55);
    col=mix(col,vec3(0.86,0.92,1.0),smoothstep(0.004,-0.004,ring)*0.7);
    col=mix(col,vec3(1.0,0.9,0.75),smoothstep(0.03,-0.03,spokes)*0.45);

    col*=smoothstep(1.06,0.16,r);
    fragColor=vec4(col,1.0);
}
