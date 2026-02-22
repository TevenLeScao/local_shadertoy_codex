mat2 rot(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat2(c, -s, s, c);
}

float boxSDF(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return max(d.x, d.y);
}

float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
    float r = length(uv);
    float a = atan(uv.y, uv.x);

    vec3 night = vec3(0.006, 0.01, 0.03);
    vec3 twilight = vec3(0.02, 0.04, 0.10);
    vec3 dawn = vec3(0.22, 0.11, 0.06);

    float dome = smoothstep(1.6, 0.2, r);
    float aura = 0.5 + 0.5 * sin(4.0 * a - 0.8 * iTime + r * 10.0);
    vec3 color = mix(night, twilight, dome);
    color += dawn * aura * exp(-2.2 * r) * 0.35;

    vec2 boardUV = uv * (1.9 + 0.08 * sin(iTime * 0.5));
    vec2 id = floor(boardUV);

    if (all(greaterThanEqual(id, vec2(-1.0))) && all(lessThanEqual(id, vec2(0.0)))) {
        vec2 local = fract(boardUV) - 0.5;
        float idx = (id.x + 1.0) + 2.0 * (id.y + 1.0);

        float speed = 0.55 + 0.33 * idx + 0.08 * sin(iTime * 0.7 + idx * 3.1);
        float dir = mix(-1.0, 1.0, step(0.5, fract(idx * 1.37)));
        float angle = iTime * speed * dir;

        vec2 p = rot(angle) * local;
        float sq = boxSDF(p, vec2(0.365));
        float squareMask = 1.0 - smoothstep(0.0, 0.012, sq);
        float edgeGlow = exp(-95.0 * abs(sq));

        float checker = mod(id.x + id.y, 2.0);
        vec3 whiteSq = vec3(0.985, 0.985, 0.97);
        vec3 blackSq = vec3(0.012, 0.014, 0.02);
        vec3 tile = mix(whiteSq, blackSq, checker);

        float lightSweep = 0.5 + 0.5 * sin(iTime * 1.8 + idx * 2.2 + p.x * 18.0 - p.y * 15.0);
        vec3 glowA = vec3(0.22, 0.5, 1.0);
        vec3 glowB = vec3(1.0, 0.7, 0.25);
        vec3 rim = mix(glowA, glowB, checker) * edgeGlow * (0.55 + 0.45 * lightSweep);

        float innerHalo = exp(-20.0 * max(sq + 0.16, 0.0));
        vec3 pearl = vec3(1.0, 0.95, 0.86) * innerHalo * 0.08;

        color = mix(color, tile, squareMask);
        color += rim * 0.48;
        color += pearl;
    }

    float rays = pow(max(0.0, cos(8.0 * a - iTime * 0.5)), 10.0) * exp(-1.8 * r);
    color += vec3(0.09, 0.10, 0.16) * rays;

    float dust = hash21(fragCoord + iTime * 60.0) - 0.5;
    color += dust * 0.014;

    color = pow(max(color, 0.0), vec3(0.92));
    fragColor = vec4(color, 1.0);
}
