varying vec2 vUv;
uniform sampler2D uTexture;
uniform float uBlurAmount;
uniform vec2 uTextureSize;
uniform float sigma; // Missing uniform declaration
uniform float opacity;

// Add these at the top before calculateWeight()
const float PI = 3.141592653589793;

float calculateWeight(float x) {
    return exp(-(x * x) / (2.0 * sigma * sigma)) / (sqrt(2.0 * PI) * sigma);
}

void main() {
    vec2 texelSize = (1.0 / uTextureSize) * uBlurAmount;
    vec4 totalColor = vec4(0.0);

    // Generate weights
    float weights[11];
    float weightSum = 0.0;

    // Calculate raw weights
    for(int i = 0; i < 11; i++) {
        float x = float(i - 5);
        weights[i] = calculateWeight(x);
        weightSum += weights[i];
    }

    // Normalize 1D weights
    for(int i = 0; i < 11; i++) {
        weights[i] /= weightSum;
    }

    for(int x = -5; x <= 5; x++) {
        for(int y = -5; y <= 5; y++) {
            vec2 offset = vec2(float(x), float(y)) * texelSize;
            float weight = weights[x + 5] * weights[y + 5];
            totalColor += texture2D(uTexture, vUv + offset) * weight;
        }
    }

    gl_FragColor = totalColor * opacity;
}