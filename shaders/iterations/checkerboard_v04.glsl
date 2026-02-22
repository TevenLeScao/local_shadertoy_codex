mat2 rot(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat2(c, -s, s, c);
}

float boxSDF(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return max(d.x, d.y);
}

float squareFill(vec2 p, float s, float blur) {
    return 1.0 - smoothstep(0.0, blur, boxSDF(p, vec2(s)));
}

float squareRing(vec2 p, float s, float t, float blur) {
    float outer = 1.0 - smoothstep(0.0, blur, boxSDF(p, vec2(s)));
    float inner = 1.0 - smoothstep(0.0, blur, boxSDF(p, vec2(max(s - t, 0.0))));
    return max(outer - inner, 0.0);
}

float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
}

void panelPattern(in vec2 p, in float idx, in float t, inout vec3 col) {
    float drift = 0.015 * sin(t * 0.8 + idx * 2.7);
    vec2 q = p + vec2(drift, -drift * 0.5);

    float microTilt = 0.07 * sin(idx * 4.3 + t * 0.35);
    q = rot(microTilt) * q;

    float ring1 = squareRing(q, 0.42, 0.07, 0.003);
    float ring2 = squareRing(q, 0.30, 0.06, 0.003);
    float ring3 = squareRing(q, 0.20, 0.05, 0.003);
    float core = squareFill(q, 0.08, 0.003);

    float parity = mod(idx, 2.0);
    vec3 ink = vec3(0.06);
    vec3 paper = vec3(0.92);
    vec3 bg = mix(paper, ink, parity);

    col = mix(col, bg, squareFill(q, 0.455, 0.005));

    float band = clamp(ring1 + ring2 + ring3 + core, 0.0, 1.0);
    vec3 motif = mix(ink, paper, parity);
    col = mix(col, motif, band);

    float speed = 0.45 + idx * 0.32;
    float dir = mix(-1.0, 1.0, step(0.5, fract(idx * 1.21)));
    vec2 inner = rot(dir * speed * t) * (q * 1.3);

    float innerRing = squareRing(inner, 0.14, 0.045, 0.003);
    float innerCore = squareFill(inner, 0.05, 0.0025);

    float accent = clamp(innerRing + innerCore, 0.0, 1.0);
    col = mix(col, motif, accent);

    float abrasion = exp(-80.0 * abs(boxSDF(q, vec2(0.455)))) * 0.12;
    col += vec3(abrasion);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
    float t = iTime;

    vec3 paper = vec3(0.90);
    float vignette = smoothstep(1.35, 0.15, length(uv));
    vec3 color = mix(vec3(0.20), paper, vignette);

    vec2 board = uv;
    board *= rot(-0.01 + 0.01 * sin(t * 0.2));

    vec2 boardSize = vec2(1.10, 1.10);
    float boardMask = squareFill(board, boardSize.x * 0.5, 0.004);

    if (boardMask > 0.0) {
        color = mix(color, vec3(0.94), boardMask);

        vec2 g = (board / boardSize + 0.5) * 2.0;
        vec2 id = floor(g);
        vec2 f = fract(g) - 0.5;

        if (all(greaterThanEqual(id, vec2(0.0))) && all(lessThan(id, vec2(2.0)))) {
            float idx = id.x + id.y * 2.0;

            vec2 p = f * 0.94;

            float frame = squareRing(f, 0.49, 0.05, 0.0025);
            color = mix(color, vec3(0.07), frame);

            vec3 panelCol = color;
            panelPattern(p, idx, t, panelCol);
            color = panelCol;

            if (id.y < 1.0) {
                float speed = 0.55 + idx * 0.30;
                float angle = speed * t * mix(-1.0, 1.0, step(0.5, fract(idx * 0.9)));
                vec2 rp = rot(angle) * p;
                float offsetCore = squareFill(rp + vec2(0.035, -0.02), 0.06, 0.003);
                color = mix(color, vec3(0.12), offsetCore * 0.9);
            }
        }

        float seam = max(squareRing(g - vec2(0.5, 1.0), 0.5, 0.02, 0.0015), squareRing(g - vec2(1.0, 0.5), 0.5, 0.02, 0.0015));
        color = mix(color, vec3(0.08), seam * 0.8);
    }

    float grain = (hash21(fragCoord + vec2(17.0, 43.0) * t) - 0.5) * 0.04;
    color += grain;

    color = clamp(color, 0.0, 1.0);
    fragColor = vec4(color, 1.0);
}
