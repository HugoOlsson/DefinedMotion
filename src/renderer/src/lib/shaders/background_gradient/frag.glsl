uniform vec3 topColor;
uniform vec3 bottomColor;
uniform float opacity;

varying vec3 vWorldPosition;

void main() {
    vec3 direction = normalize(vWorldPosition);
    float gradient = (direction.y + 1.0) * 0.5;
    vec3 color = mix(bottomColor, topColor, gradient);
    gl_FragColor = vec4(color, opacity);
}