// shaders.js
// One custom GLSL shader pair for the cola bottle glass.
// The Fresnel trick (stronger colour at grazing angles) comes from
// The Book of Shaders and the Three.js "webgl_materials_envmaps" example -
// I simplified it and added the time uniform so I can gently pulse the edge glow.

export const glassShader = {
    vertex: /* glsl */`
        varying vec3 vNormal;
        varying vec3 vViewDir;

        void main() {
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vec4 mvPos = viewMatrix * worldPos;

            // normal in view space so the fresnel is camera-relative
            vNormal = normalize(normalMatrix * normal);
            vViewDir = normalize(-mvPos.xyz);

            gl_Position = projectionMatrix * mvPos;
        }
    `,

    fragment: /* glsl */`
        uniform float uTime;
        uniform vec3  uTint;
        uniform vec3  uEdgeColor;
        uniform float uFresnelPow;
        uniform float uOpacity;

        varying vec3 vNormal;
        varying vec3 vViewDir;

        void main() {
            // fresnel: 1.0 at grazing angles, 0.0 head-on
            float fres = 1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0);
            fres = pow(fres, uFresnelPow);

            // gentle time-based shimmer on the rim
            float shimmer = 0.85 + 0.15 * sin(uTime * 1.5);

            vec3 colour = mix(uTint, uEdgeColor * shimmer, fres);

            // more opaque at edges (glass looks thicker there) so the
            // liquid inside reads clearly through the middle
            float alpha = uOpacity + fres * 0.55;

            gl_FragColor = vec4(colour, alpha);
        }
    `
};
