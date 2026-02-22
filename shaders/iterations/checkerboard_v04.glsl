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

    float baseSpeed = 0.52 + 0.07 * sin(idx * 2.3);
    float dir = mix(-1.0, 1.0, step(0.5, fract(idx * 1.21)));
    float phaseBase = 6.2831853 * hash21(vec2(idx + 0.13, 1.91));

    float w1 = baseSpeed + (hash21(vec2(idx + 0.31, 2.27)) - 0.5) * 0.05;
    float w2 = baseSpeed + (hash21(vec2(idx + 0.47, 2.93)) - 0.5) * 0.05;
    float w3 = baseSpeed + (hash21(vec2(idx + 0.59, 3.57)) - 0.5) * 0.05;
    float w4 = baseSpeed + (hash21(vec2(idx + 0.71, 4.11)) - 0.5) * 0.05;
    float w5 = baseSpeed + (hash21(vec2(idx + 0.83, 4.67)) - 0.5) * 0.05;
    float w6 = baseSpeed + (hash21(vec2(idx + 0.97, 5.19)) - 0.5) * 0.05;

    vec2 q1 = rot(dir * w1 * t + phaseBase + 6.2831853 * hash21(vec2(idx + 0.89, 4.73))) * q;
    vec2 q2 = rot(dir * w2 * t + phaseBase + 6.2831853 * hash21(vec2(idx + 1.07, 5.41))) * q;
    vec2 q3 = rot(dir * w3 * t + phaseBase + 6.2831853 * hash21(vec2(idx + 1.29, 6.19))) * q;
    vec2 q4 = rot(dir * w4 * t + phaseBase + 6.2831853 * hash21(vec2(idx + 1.43, 6.83))) * q;
    vec2 q5 = rot(dir * w5 * t + phaseBase + 6.2831853 * hash21(vec2(idx + 1.61, 7.37))) * q;
    vec2 q6 = rot(dir * w6 * t + phaseBase + 6.2831853 * hash21(vec2(idx + 1.79, 7.91))) * q;

    float ring1 = squareRing(q1, 0.42, 0.07, 0.003);
    float ring2 = squareRing(q2, 0.34, 0.055, 0.003);
    float ring3 = squareRing(q3, 0.27, 0.05, 0.003);
    float ring4 = squareRing(q4, 0.21, 0.045, 0.003);
    float ring5 = squareRing(q5, 0.16, 0.035, 0.003);
    float core = squareFill(q6, 0.085, 0.003);

    float parity = mod(idx, 2.0);
    vec3 ink = vec3(0.06);
    vec3 paper = vec3(0.92);
    vec3 bg = mix(paper, ink, parity);

    col = mix(col, bg, squareFill(q, 0.455, 0.005));

    float band = clamp(ring1 + ring2 + ring3 + ring4 + ring5 + core, 0.0, 1.0);
    vec3 motif = mix(ink, paper, parity);
    col = mix(col, motif, band);

    float speed = baseSpeed + (hash21(vec2(idx + 1.91, 7.37)) - 0.5) * 0.06;
    float phaseInner = 6.2831853 * hash21(vec2(idx + 2.11, 8.03));
    vec2 inner = rot(dir * speed * t + phaseInner) * (q * 1.3);

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
