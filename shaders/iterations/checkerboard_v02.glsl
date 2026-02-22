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

    vec3 deep = vec3(0.01, 0.02, 0.05);
    vec3 haze = vec3(0.04, 0.06, 0.12);
    float vignette = smoothstep(1.4, 0.15, length(uv));
    vec3 color = mix(deep, haze, vignette);

    vec2 cellCoord = uv * 2.0;
    vec2 id = floor(cellCoord);

    if (all(greaterThanEqual(id, vec2(-1.0))) && all(lessThanEqual(id, vec2(0.0)))) {
        vec2 local = fract(cellCoord) - 0.5;

        float idx = (id.x + 1.0) + 2.0 * (id.y + 1.0);
        float speed = 0.5 + 0.42 * idx;
        float dir = mix(-1.0, 1.0, step(0.5, fract(idx * 0.7)));
        float angle = iTime * speed * dir;

        vec2 p = rot(angle) * local;
        float sq = boxSDF(p, vec2(0.38));
        float squareMask = 1.0 - smoothstep(0.0, 0.01, sq);
        float edge = exp(-90.0 * abs(sq));

        float checker = mod(id.x + id.y, 2.0);
        vec3 whiteSq = vec3(0.98, 0.98, 0.96);
        vec3 blackSq = vec3(0.03, 0.03, 0.04);
        vec3 tile = mix(whiteSq, blackSq, checker);

        float pulse = 0.55 + 0.45 * sin(iTime * 1.6 + idx * 1.7 + length(p) * 20.0);
        vec3 rim = mix(vec3(0.12, 0.30, 0.85), vec3(1.0, 0.72, 0.20), checker) * edge * pulse;

        color = mix(color, tile, squareMask);
        color += rim * 0.38;
    }

    float dust = hash21(fragCoord + iTime * 60.0) - 0.5;
    color += dust * 0.015;

    fragColor = vec4(color, 1.0);
}
