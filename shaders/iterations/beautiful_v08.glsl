mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);} 

float softmin(float a,float b,float k){float h=max(k-abs(a-b),0.0)/k;return min(a,b)-h*h*k*0.25;}

void mainImage(out vec4 fragColor,in vec2 fragCoord){
    vec2 uv=(fragCoord-0.5*iResolution.xy)/iResolution.y;
    float t=iTime*0.36;

    float r=length(uv);
    float a=atan(uv.y,uv.x);

    vec3 col=vec3(0.005,0.008,0.02);

    float field=0.0;
    vec2 p=uv;
    for(int i=0;i<8;i++){
        float fi=float(i);
        p=abs(p*rot(0.45+0.08*sin(t+fi)))-vec2(0.32,0.18+0.02*sin(fi+t));
        field+=0.018/(0.02+length(p));
    }

    float s1=sin(12.0*a-3.0*t+18.0*r);
    float s2=sin(7.0*a+2.0*t-26.0*r);
    float pat=0.5+0.5*s1*s2;

    vec3 blue=vec3(0.12,0.36,0.95);
    vec3 amber=vec3(0.98,0.58,0.22);
    vec3 white=vec3(1.0,0.95,0.88);

    col+=mix(blue,amber,pat)*exp(-2.4*r)*0.85;
    col+=white*field*0.35;

    float ring1=abs(r-(0.43+0.03*sin(t*1.2)))-0.02;
    float ring2=abs(r-(0.27+0.02*cos(t*1.5)))-0.012;
    float rings=softmin(ring1,ring2,0.05);
    col=mix(col,white,smoothstep(0.008,-0.008,rings)*0.5);

    float sparks=pow(max(0.0,1.0-abs(fract((a+3.14159)/(6.28318)*20.0+t*0.2)-0.5)*2.0),18.0);
    col+=vec3(1.0,0.8,0.45)*sparks*exp(-3.0*abs(r-0.5))*0.7;

    col*=smoothstep(1.08,0.12,r);
    fragColor=vec4(col,1.0);
}
