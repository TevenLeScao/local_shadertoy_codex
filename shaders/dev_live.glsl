void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 uv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;

    float t = iTime * 0.7;
    float d = length(uv);
    float a = atan(uv.y, uv.x);

    float ring = smoothstep(0.25, 0.23, abs(sin(8.0 * d - 4.0 * t)));
    float pulse = 0.5 + 0.5 * cos(6.0 * a + 2.0 * t);

    vec3 base = mix(vec3(0.03, 0.08, 0.15), vec3(0.94, 0.68, 0.25), pulse);
    vec3 color = base * ring + vec3(0.05, 0.1, 0.15) * exp(-3.0 * d);

    fragColor = vec4(color, 1.0);
}
