mat2 r2(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);} 

float curve(vec2 p,float f,float ph){
    return abs(p.y-0.08*sin(f*p.x+ph));
}

void mainImage(out vec4 fragColor,in vec2 fragCoord){
    vec2 uv=(fragCoord-0.5*iResolution.xy)/iResolution.y;
    float t=iTime*0.32;

    vec3 col=vec3(0.015,0.02,0.05);

    for(int i=0;i<18;i++){
        float fi=float(i);
        float y=-0.55+fi*0.07;
        vec2 p=uv-vec2(0.0,y+0.01*sin(t+fi*0.7));
        float d=curve(p,2.0+fi*0.5,t*1.4+fi*0.3);
        vec3 tone=mix(vec3(0.08,0.2,0.45),vec3(0.85,0.45,0.24),fi/18.0);
        col+=tone*exp(-85.0*d)*(0.12-0.004*fi);
    }

    vec2 q=uv;
    for(int j=0;j<4;j++){
        float fj=float(j);
        vec2 c=0.23*vec2(cos(t*0.7+fj*1.4),sin(t*0.9+fj*1.7));
        float d=length((q-c)*r2(0.3*sin(t+fj)))-0.12;
        col+=mix(vec3(0.2,0.5,1.0),vec3(1.0,0.8,0.5),0.5+0.5*sin(t+fj))*exp(-38.0*abs(d))*0.16;
    }

    float vign=smoothstep(1.05,0.14,length(uv));
    col*=vign;
    fragColor=vec4(col,1.0);
}
