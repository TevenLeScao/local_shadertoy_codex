float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);} 
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);} 

void mainImage(out vec4 fragColor, in vec2 fragCoord){
    vec2 uv=(fragCoord-0.5*iResolution.xy)/iResolution.y;
    float t=iTime*0.35;

    vec3 col=vec3(0.01,0.02,0.05);
    float glow=0.0;

    vec2 p=uv;
    for(int k=0;k<7;k++){
        float fi=float(k);
        p=abs(p)*rot(0.35+0.06*sin(t+fi))-vec2(0.34+0.03*sin(fi+t*1.3),0.21);
        float d=length(p);
        glow+=0.016/(d+0.015);
    }

    float r=length(uv);
    float a=atan(uv.y,uv.x);
    float petals=0.5+0.5*cos(7.0*a-2.0*t+8.0*r);
    float wave=0.5+0.5*sin(24.0*r-3.0*t);

    vec3 paletteA=vec3(0.18,0.34,0.85);
    vec3 paletteB=vec3(0.95,0.48,0.28);
    vec3 paletteC=vec3(0.96,0.92,0.72);

    col+=mix(paletteA,paletteB,petals)*(0.35+0.65*wave)*exp(-2.1*r);
    col+=paletteC*glow*0.85;

    float vign=smoothstep(1.1,0.15,r);
    col*=vign;

    float grain=(hash(fragCoord+iTime*60.0)-0.5)*0.018;
    col+=grain;

    fragColor=vec4(col,1.0);
}
