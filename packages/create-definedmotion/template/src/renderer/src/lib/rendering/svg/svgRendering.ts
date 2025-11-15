// svg-latex.ts
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import * as THREE from 'three';

export const CONTENT_NAME = 'SVGContent';

export function createSVGShape(svg: string, targetWidth: number, detail = 2): THREE.Group {
  const loader = new SVGLoader();
  const svgData = loader.parse(svg);

  // OUTER: stable container (caller may position/scale this)
  const container = new THREE.Group();

  // INNER: all normalization happens here
  const content = new THREE.Group();
  content.name = CONTENT_NAME;
  content.scale.y = -1; // flip SVG Y

  const CURVE_SEGMENTS = Math.max(12, Math.round(24 * detail));

  for (const path of svgData.paths) {
    const style = path.userData?.style || {};
    const fillColor   = style.fill   && style.fill   !== 'none' ? style.fill   : null;
    const strokeColor = style.stroke && style.stroke !== 'none' ? style.stroke : null;
    const strokeWidth = +style.strokeWidth || 0;
    const opacity       = style.opacity != null ? +style.opacity : 1;
    const fillOpacity   = style.fillOpacity   != null ? +style.fillOpacity   : opacity;
    const strokeOpacity = style.strokeOpacity != null ? +style.strokeOpacity : opacity;


    //collect any dm-* classes on the source SVG node
    const node = path.userData?.node as Element | undefined;
    const dmClasses = node ? collectDMClasses(node) : [];

    const attachClasses = (mesh: THREE.Mesh) => {
      if (dmClasses.length) {
        // store logical names: ["lhs", "rhs", "variable", ...]
        mesh.userData.dmClasses = dmClasses;
      }
    };



    if (fillColor) {
      const shapes = SVGLoader.createShapes(path);
      for (const shape of shapes) {
        const geom = new THREE.ShapeGeometry(shape, CURVE_SEGMENTS);
        const mat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(fillColor),
          side: THREE.DoubleSide,
          transparent: fillOpacity < 1,
          opacity: fillOpacity,
          depthTest: true,
          depthWrite: true,
          toneMapped: false,
        });
        const mesh = new THREE.Mesh(geom, mat);
        attachClasses(mesh);        
        content.add(mesh);          
      }
    }

    if (strokeColor && strokeWidth > 0) {
      const svgStyle = {
        ...style,
        strokeWidth,
        linecap: style.linecap || 'butt',
        linejoin: style.linejoin || 'miter',
        miterlimit: style.miterlimit != null ? +style.miterlimit : 4,
      };
      const strokeMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(strokeColor),
        transparent: strokeOpacity < 1,
        opacity: strokeOpacity,
        depthTest: true,
        depthWrite: true,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      for (const sub of path.subPaths) {
        const pts = sub.getPoints();
        const geom = SVGLoader.pointsToStroke(pts, svgStyle);
         if (!geom) continue;
        const mesh = new THREE.Mesh(geom, strokeMat);
        attachClasses(mesh);       
        content.add(mesh);        
      }
    }
  }

  // normalize width & center ON THE INNER CONTENT
  const preBox = new THREE.Box3().setFromObject(content);
  const preSize = preBox.getSize(new THREE.Vector3());
  if (preSize.x > 0) content.scale.multiplyScalar(targetWidth / preSize.x);

  const box = new THREE.Box3().setFromObject(content);
  const center = box.getCenter(new THREE.Vector3());
  content.position.sub(center);

  container.add(content);
  return container;
}


function collectDMClasses(node: Element | null): string[] {
  const result = new Set<string>();

  while (node) {
    const cls = node.getAttribute && node.getAttribute('class');
    if (cls) {
      for (const c of cls.split(/\s+/)) {
        const m = /^dm-(.+)$/.exec(c); // "dm-variable" -> "variable"
        if (m) result.add(m[1]);
      }
    }
    node = node.parentElement;
  }

  return [...result];
}