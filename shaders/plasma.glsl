void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 uv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
    float t = iTime;

    vec3 col = 0.5 + 0.5 * cos(t + uv.xyx * 3.0 + vec3(0.0, 2.0, 4.0));
    float v = 0.0;

    for (int i = 0; i < 20; i++) {
        float fi = float(i);
        v += sin((uv.x + fi * 0.04) * 8.0 + t) * 0.025;
        v += cos((uv.y - fi * 0.03) * 10.0 - t * 1.2) * 0.02;
    }

    col *= 0.7 + abs(v) * 2.0;
    fragColor = vec4(col, 1.0);
}
