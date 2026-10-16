/* Hand-drawn, small-grid toolbox artwork inspired by the Windows bitmap era. */
(function () {
  'use strict';
  const svg = (body, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" shape-rendering="crispEdges" ${extra}>${body}</svg>`;
  const p = (d, fill = '#111', extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
  const stroke = (d, extra = '') => p(d, 'none', `stroke="#111" stroke-width="1" ${extra}`);
  const icons = {
    freeSelect: svg(stroke('M6 4H12L17 6L15 10L19 14L16 19H9L5 17L7 12L4 8Z', 'stroke-dasharray="2 2"')),
    select: svg('<rect x="4.5" y="5.5" width="15" height="13" fill="none" stroke="#111" stroke-dasharray="2 2"/>'),
    eraser: svg(p('M4 13L12 5H15L21 11L12 20H9Z') + p('M6 13L12 7H14L18 11L12 17Z', '#ff8fb5') + p('M6 15L9 18H11L13 16L9 12Z', '#fff') + p('M11 19H20V20H11Z', '#777')),
    fill: svg(p('M4 10L12 3L19 10L12 17H9Z') + p('M6 10L12 5L17 10L12 15H10Z', '#fff') + p('M6 11L11 8L17 11L12 15H10Z', '#ffff57') + stroke('M9 6V3H13V7') + p('M18 12H20V15H21V18H20V20H17V19H16V17H17V14H18Z', '#185dcd') + p('M4 20H15V21H4Z', '#777')),
    picker: svg(p('M16 3H19V4H21V7L18 10L17 9L9 17L5 18L6 14L14 6L13 5Z') + p('M15 6L18 9L19 8L16 5Z', '#777') + p('M8 14L14 8L16 10L10 16H8Z', '#fff') + p('M6 17H8V19H4V18H6Z', '#243ca1')),
    zoom: svg('<circle cx="10" cy="9" r="6" fill="#111"/><circle cx="10" cy="9" r="4" fill="#fff"/>' + p('M14 13L16 12L22 18V20H20Z') + p('M7 6H11V7H7Z M6 7H7V10H6Z', '#7dc8d8') + p('M16 15L17 14L21 18L20 19Z', '#aaa')),
    pencil: svg(p('M4 20L5 14L16 3H18L21 6V8L10 19Z') + p('M7 14L16 5L18 7L9 16Z', '#ffff55') + p('M10 17L19 8L20 9L11 18Z', '#b79000') + p('M5 19L6 15L9 18Z', '#ead9b0') + p('M4 20L5 17L7 19Z') + p('M17 4H18L20 6V7L19 8L16 5Z', '#ff92ad')),
    brush: svg(p('M15 3H19V6L13 14L12 17L8 21H3V18L6 13H9L12 10Z') + p('M16 4H18V6L12 13L11 11Z', '#bb763b') + p('M9 12L12 14L11 16L8 14Z', '#aaa') + p('M6 15H8L10 17L7 20H4V18Z', '#111') + p('M4 20H8V21H4Z', '#2d4fbd')),
    airbrush: svg(p('M9 6H14V9H16V20H7V9H9Z') + p('M10 4H15V6H10Z') + p('M8 10H15V19H8Z', '#fff') + p('M9 12H14V16H9Z', '#7b8ca8') + p('M9 6H13V8H9Z', '#aaa') + p('M4 4H5V5H4Z M2 6H3V7H2Z M5 7H6V8H5Z M1 3H2V4H1Z M5 1H6V2H5Z M7 3H8V4H7Z M2 9H3V10H2Z')),
    text: svg(p('M10 4H13L19 19H21V20H14V19H16L14 14H8L6 19H8V20H2V19H4L10 4ZM9 12H13L11 7Z', '#111', 'fill-rule="evenodd"')),
    line: svg(p('M4 19L19 4L20 5L5 20Z')),
    curve: svg('<path d="M4 19C19 19 4 5 19 5" fill="none" stroke="#111" stroke-width="1.5" shape-rendering="geometricPrecision"/>'),
    rectangle: svg('<rect x="4.5" y="5.5" width="15" height="13" fill="none" stroke="#111"/>'),
    polygon: svg(stroke('M4 18L5 6L10 9L16 4L19 18Z')),
    ellipse: svg('<ellipse cx="12" cy="12" rx="8" ry="6.5" fill="none" stroke="#111" shape-rendering="geometricPrecision"/>'),
    roundedRect: svg('<rect x="4.5" y="5.5" width="15" height="13" rx="3" fill="none" stroke="#111"/>'),
    paint: svg(p('M6 4H15V5H18V7H20V10H21V16H19V18H16V20H9V19H5V17H3V14H2V9H3V6H6Z') + p('M6 5H15V6H18V8H19V11H20V15H18V17H15V19H9V18H5V16H4V13H3V9H4V7H6Z', '#f5e2a0') + p('M6 7H9V10H6Z', '#e94c42') + p('M11 6H14V9H11Z', '#f8d636') + p('M16 9H18V12H15V10H16Z', '#43a951') + p('M6 13H9V16H6Z', '#2869c8') + p('M11 15H14V18H11Z', '#aa55a1') + p('M11 10H14V13H11Z') + p('M20 2H22V5L15 14H13V12Z') + p('M20 3H21V5L15 12L14 11Z', '#996332') + p('M13 12H15V14L12 17H10V15Z', '#334f9d')),
    save: svg(p('M4 3H18L21 6V21H3V3Z') + p('M5 4H17V11H6V4Z', '#ddd') + p('M14 5H16V10H14Z') + p('M5 13H18V20H5Z', '#fff') + p('M7 15H16V16H7Z M7 18H16V19H7Z', '#9d9d9d') + p('M19 7H20V20H19Z M4 4H5V12H4Z', '#30498e')),
    undo: svg(p('M8 4L2 10L8 16V12H14L17 14V17L15 19H12V21H16L20 18V13L16 9H8Z', '#242c8d') + p('M7 7L4 10L7 13V11H15L18 14V16H19V13L16 10H7Z', '#626db5')),
    redo: svg(p('M16 4L22 10L16 16V12H10L7 14V17L9 19H12V21H8L4 18V13L8 9H16Z', '#242c8d') + p('M17 7L20 10L17 13V11H9L6 14V16H5V13L8 10H17Z', '#626db5')),
    computer: svg(p('M3 2H21V16H14V19H19V22H5V19H10V16H3Z') + p('M4 3H20V15H4Z', '#ddd') + p('M5 4H19V13H5Z') + p('M6 5H18V12H6Z', '#008080') + p('M11 16H13V20H11Z', '#aaa') + p('M6 20H18V21H6Z', '#ddd') + p('M16 14H18V15H16Z', '#37a54a'))
  };
  window.PaintIcons = Object.freeze(icons);
})();
