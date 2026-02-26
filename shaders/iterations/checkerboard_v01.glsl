mat2 rot(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat2(c, -s, s, c);
}

float boxSDF(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return max(d.x, d.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;

    vec2 cellCoord = uv * 2.0;
    vec2 id = floor(cellCoord);

    if (any(lessThan(id, vec2(-1.0))) || any(greaterThan(id, vec2(0.0)))) {
        fragColor = vec4(0.04, 0.04, 0.04, 1.0);
        return;
    }

    vec2 local = fract(cellCoord) - 0.5;

    float idx = (id.x + 1.0) + 2.0 * (id.y + 1.0);
    float angle = iTime * (0.45 + idx * 0.35) * (mod(idx, 2.0) * 2.0 - 1.0);

    vec2 p = rot(angle) * local;
    float sq = boxSDF(p, vec2(0.39));
    float squareMask = 1.0 - smoothstep(0.0, 0.01, sq);

    float checker = mod(id.x + id.y, 2.0);
    vec3 bg = vec3(0.02);
    vec3 tileColor = mix(vec3(1.0), vec3(0.0), checker);
    vec3 color = mix(bg, tileColor, squareMask);

    fragColor = vec4(color, 1.0);
}
