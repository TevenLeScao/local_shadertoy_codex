float fill(float d, float blur) {
    return smoothstep(blur, -blur, d);
}

float rectSDF(vec2 p, vec2 c, vec2 h) {
    vec2 d = abs(p - c) - h;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float archSDF(vec2 p, vec2 c, vec2 size) {
    vec2 q = p - c;
    float body = rectSDF(p, c - vec2(0.0, size.y * 0.2), vec2(size.x, size.y * 0.55));
    vec2 r = q - vec2(0.0, size.y * 0.22);
    float cap = max(length(r) - size.x, -r.y) - size.y * 0.03;
    return min(body, cap);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 uv = fragCoord / iResolution.xy;
    float t = iTime;
    float px = 1.5 / iResolution.y;

    vec2 p = uv;
    float bend = 0.010 * sin(8.0 * p.y + t * 1.1) + 0.006 * sin(17.0 * p.x - t * 0.9);
    p.x += bend;
    p.y += 0.004 * sin(14.0 * p.x + t * 1.4);

    vec3 skyTop = vec3(0.67, 0.74, 0.84);
    vec3 skyBot = vec3(0.86, 0.91, 0.95);
    vec3 col = mix(skyBot, skyTop, smoothstep(0.15, 1.0, p.y));

    float plaza = smoothstep(0.30, 0.0, p.y);
    col = mix(col, vec3(0.60, 0.61, 0.62), plaza);

    vec3 stone = vec3(0.84, 0.82, 0.78);
    vec3 stoneDark = vec3(0.72, 0.71, 0.68);
    vec3 metal = vec3(0.50, 0.54, 0.56);

    float mainBlock = rectSDF(p, vec2(0.50, 0.50), vec2(0.42, 0.22));
    col = mix(col, stone, fill(mainBlock, px));

    float roofBand = rectSDF(p, vec2(0.50, 0.585), vec2(0.42, 0.010));
    col = mix(col, stoneDark, fill(roofBand, px));

    float canopy = rectSDF(p, vec2(0.50, 0.355), vec2(0.42, 0.008));
    col = mix(col, metal, fill(canopy, px));

    float centerBody = rectSDF(p, vec2(0.50, 0.53), vec2(0.15, 0.16));
    col = mix(col, stone * 0.98, fill(centerBody, px));

    float pedimentTri = max(abs(p.x - 0.50) * 1.45 + (p.y - 0.69), -(p.y - 0.62));
    col = mix(col, stoneDark * 0.98, fill(pedimentTri, px));

    float clockRing = abs(length((p - vec2(0.50, 0.40)) / vec2(0.018, 0.018)) - 1.0) - 0.22;
    col = mix(col, vec3(0.95), fill(clockRing, px));

    float centralArch = archSDF(p, vec2(0.50, 0.51), vec2(0.11, 0.18));
    col = mix(col, vec3(0.73, 0.72, 0.70), fill(centralArch, px));

    float rose = abs(length((p - vec2(0.50, 0.54)) / vec2(0.085, 0.095)) - 1.0) - 0.03;
    col = mix(col, vec3(0.56, 0.58, 0.61), fill(rose, px));

    float spokes = abs(sin(20.0 * atan(p.y - 0.54, p.x - 0.50))) - 0.88;
    float roseMask = fill(rose + 0.006, px);
    col = mix(col, vec3(0.64, 0.65, 0.66), fill(spokes, 0.03) * roseMask * 0.7);

    float windowBand = fill(rectSDF(p, vec2(0.50, 0.515), vec2(0.37, 0.14)), px);
    vec2 grid = abs(fract(vec2((p.x - 0.13) / 0.052, (p.y - 0.44) / 0.088) - 0.5) - 0.5);
    float mullion = 1.0 - smoothstep(0.08, 0.12, min(grid.x, grid.y));
    col = mix(col, vec3(0.26, 0.30, 0.34), mullion * windowBand * 0.62);

    float archRow = 0.0;
    for (int i = 0; i < 15; i++) {
        float x = 0.12 + float(i) * 0.055;
        float a = archSDF(p, vec2(x, 0.315), vec2(0.022, 0.050));
        archRow = max(archRow, fill(a, px));
    }
    col = mix(col, vec3(0.18, 0.22, 0.25), archRow);

    float awnings = 0.0;
    for (int i = 0; i < 9; i++) {
        float x = 0.58 + float(i) * 0.036;
        float a = archSDF(p, vec2(x, 0.465), vec2(0.010, 0.018));
        awnings = max(awnings, fill(a, px));
    }
    col = mix(col, vec3(0.58, 0.10, 0.12), awnings);

    float tree = length((p - vec2(0.82, 0.37)) / vec2(0.085, 0.19)) - 1.0;
    float trunk = rectSDF(p, vec2(0.82, 0.23), vec2(0.012, 0.06));
    col = mix(col, vec3(0.16, 0.20, 0.10), fill(tree, px));
    col = mix(col, vec3(0.24, 0.17, 0.10), fill(trunk, px));

    float roofShadow = smoothstep(0.62, 0.32, p.y) * smoothstep(0.96, 0.62, abs(p.x - 0.5));
    col *= 1.0 - 0.12 * roofShadow;

    float grain = fract(sin(dot(fragCoord + t * 70.0, vec2(12.9898, 78.233))) * 43758.5453);
    col += (grain - 0.5) * 0.012;

    fragColor = vec4(col, 1.0);
}
