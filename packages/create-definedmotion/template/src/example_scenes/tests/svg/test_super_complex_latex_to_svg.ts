import { AnimatedScene, HotReloadSetting, SpaceSetting } from "$renderer/lib/scene/sceneClass";
import { createSVGShape } from "$renderer/lib/rendering/svg/svgRendering";
import { latexToSVG } from "$renderer/lib/rendering/svg/latexToSVG";

export const test_super_complex_latex_to_svg = (): AnimatedScene => {
  return new AnimatedScene(
    1000, 1000,
    SpaceSetting.ThreeDim,
    HotReloadSetting.TraceFromStart,
    async (dm) => {

      // 1) Big "everything" block
      const block1 = latexToSVG(String.raw`
\begin{aligned}
\textbf{Fourier:}\quad 
  \hat{f}(\omega) &= \int_{-\infty}^{\infty} f(t)\,e^{-i\omega t}\,dt,
  & f(t) &= \frac{1}{2\pi}\int_{-\infty}^{\infty} \hat{f}(\omega)\,e^{i\omega t}\,d\omega \\[6pt]
\textbf{Gamma/Zeta:}\quad 
  \Gamma(z) &= \int_{0}^{\infty} t^{z-1} e^{-t}\,dt, 
  & \zeta(s) &= \prod_{p\in\mathbb{P}} \frac{1}{1-p^{-s}} \\[6pt]
\textbf{Cauchy–Schwarz:}\quad 
  \big|\langle \mathbf{x},\mathbf{y}\rangle\big| &\le \|\mathbf{x}\|_2\,\|\mathbf{y}\|_2 \\[6pt]
\textbf{Euler:}\quad 
  e^{i\theta} &= \cos\theta + i\sin\theta \\[6pt]
\textbf{Gradient step:}\quad 
  \theta_{t+1} &= \theta_t - \eta\,\nabla_\theta \mathcal{L}(\theta_t) \\[6pt]
\textbf{KL:}\quad 
  \mathrm{KL}\!\left(p\,\|\,q\right) &= \int p(x)\,\log\!\frac{p(x)}{q(x)}\,dx \\[6pt]
\textbf{Limits:}\quad 
  \limsup_{n\to\infty} a_n &\ge \liminf_{n\to\infty} a_n \\[6pt]
\textbf{Argmin:}\quad 
  \hat{\theta} &= \arg\min_{\theta\in\mathbb{R}^d} \; \frac{1}{n}\sum_{i=1}^n \ell\!\big(f_\theta(x_i), y_i\big) \\[6pt]
\textbf{Binomial:}\quad 
  (1+x)^n &= \sum_{k=0}^{n} \binom{n}{k} x^k
\end{aligned}
`);

      const g1 = createSVGShape(block1, 16); // width in your world units
      g1.position.set(0, 6, 0);
      dm.add(g1);


      // 2) Matrix / determinant / vector hats & bars / piecewise
      const block2 = latexToSVG(String.raw`
\begin{aligned}
\textbf{Matrix:}\quad 
  A &= \begin{bmatrix}
        a & b & c\\
        d & e & f\\
        g & h & i
      \end{bmatrix},
&\quad \det(A) &= 
  \left|\begin{matrix}
    a & b & c\\
    d & e & f\\
    g & h & i
  \end{matrix}\right| \\[6pt]
\textbf{Vectors:}\quad 
  \hat{\mathbf{v}} &= \frac{\mathbf{v}}{\|\mathbf{v}\|},\qquad 
  \overline{x} = \frac{1}{n}\sum_{k=1}^{n} x_k,\qquad 
  \vec{\nabla}\cdot\vec{E} = \frac{\rho}{\varepsilon_0} \\[6pt]
\textbf{Piecewise:}\quad 
  \mathrm{ReLU}(x) &= 
  \begin{cases}
    0, & x<0\\
    x, & x\ge 0
  \end{cases}
\end{aligned}
`);

      const g2 = createSVGShape(block2, 14);
      g2.position.set(0, -2, 0);
      dm.add(g2);


      // 3) Probability / expectation / covariance / set notation / sqrt
      const block3 = latexToSVG(String.raw`
\begin{aligned}
\textbf{Probability:}\quad 
  \mathbb{P}(A\mid B) &= \frac{\mathbb{P}(A\cap B)}{\mathbb{P}(B)},\qquad 
  \mathbb{E}[X] = \int_{\mathbb{R}} x\, d\mathbb{P}(x) \\[6pt]
\textbf{Variance/Covariance:}\quad 
  \mathrm{Var}(X) &= \mathbb{E}[X^2] - (\mathbb{E}[X])^2,\qquad 
  \mathrm{Cov}(X,Y) = \mathbb{E}[XY]-\mathbb{E}[X]\mathbb{E}[Y] \\[6pt]
\textbf{Sets/Norms:}\quad 
  \mathcal{S} &= \{\,x\in\mathbb{R}^n : \|x\|_2 \le r\,\},\qquad 
  \sqrt[n]{1+x} \approx 1 + \frac{x}{n}
\end{aligned}
`);

      const g3 = createSVGShape(block3, 12);
      g3.position.set(0, -8.5, 0);
      dm.add(g3);


    }
  );
};
