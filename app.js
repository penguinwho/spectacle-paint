(() => {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const icons = window.PaintIcons || {};
  const canvas = $('#canvas'), overlay = $('#overlay'), wrap = $('#canvas-wrap');
  let fileName = 'Untitled', dirty = false, minimized = false, currentTool = 'pencil';
  let fg = '#000000', bg = '#ffffff', clipboard = null;
  const tools = [
    ['freeSelect','Free-Form Select'], ['select','Select'], ['eraser','Eraser'], ['fill','Fill With Color'],
    ['picker','Pick Color'], ['zoom','Magnifier'], ['pencil','Pencil'], ['brush','Brush'],
    ['airbrush','Airbrush'], ['text','Text'], ['line','Line'], ['curve','Curve'],
    ['rectangle','Rectangle'], ['polygon','Polygon'], ['ellipse','Ellipse'], ['roundedRect','Rounded Rectangle']
  ];
  const palette = ['#000000','#808080','#800000','#808000','#008000','#008080','#000080','#800080','#808040','#004040','#0080ff','#0000a0','#8000a0','#4080a0','#ffffff','#c0c0c0','#ff0000','#ffff00','#00ff00','#00ffff','#0000ff','#ff00ff','#ffff80','#80ffff','#80c0ff','#ff80ff','#ff8080','#ffc080'];
  const status = (text) => $('#status-message').textContent = text;
  function svg(name) { return icons[name] || ''; }
  function installIcons() { $$('[data-icon]').forEach(el => el.innerHTML = svg(el.dataset.icon)); }
  installIcons();
  function setColor(which, value) { if (which === 'fg') fg = value; else bg = value; $('#color-front').style.background = fg; $('#color-back').style.background = bg; engine.setColors(fg,bg); }
  let engine;
  engine = new PaintEngine(canvas, overlay, {
    onChange: state => {
      if (state.pickedColor) setColor(state.pickedBackground ? 'bg' : 'fg', state.pickedColor);
      if (typeof state.dirty === 'boolean') { dirty = state.dirty; updateTitle(); }
      $('#status-size').textContent = `${state.width || canvas.width} × ${state.height || canvas.height} px`;
      $('#canvas-size-tag').textContent = `${state.width || canvas.width} × ${state.height || canvas.height} px`;
      refreshMenus();
    },
    onPosition: p => $('#status-position').textContent = `${Math.max(0,Math.round(p.x))}, ${Math.max(0,Math.round(p.y))} px`,
    onText: p => textDialog(p),
    onZoom: zoom => { $('#zoom-select').value = String(zoom); scaleCanvas(zoom); }
  });
  window.engine = engine;
  let paintHost = null;
  if (window.qt && window.QWebChannel) new QWebChannel(qt.webChannelTransport, channel => { paintHost = channel.objects.paintHost; window.paintHost = paintHost; });
  function updateTitle() { const label = `${dirty ? '*' : ''}${fileName} - Paint`; $('#window-title').textContent = label; document.title = label; }
  function scaleCanvas(zoom) { wrap.style.width = `${canvas.width * zoom}px`; wrap.style.height = `${canvas.height * zoom}px`; }
  function chooseTool(name) { currentTool = name; engine.setTool(name); $$('.tool').forEach(b => b.classList.toggle('active',b.dataset.tool === name)); renderOptions(); status((tools.find(t=>t[0]===name)||[])[1] || 'Ready.'); }
  function renderTools() { $('#tools').innerHTML = tools.map(([id,title]) => `<button class="tool${id==='pencil'?' active':''}" data-tool="${id}" title="${title}" aria-label="${title}">${svg(id)}</button>`).join(''); $('#tools').onclick=e=>{const b=e.target.closest('.tool');if(b)chooseTool(b.dataset.tool)}; }
  function renderOptions() {
    const box = $('#tool-options');
    if (['line','curve','rectangle','polygon','ellipse','roundedRect'].includes(currentTool)) {
      box.innerHTML = `<button class="mode-option active" data-mode="outline" title="Outline"><i></i></button><button class="mode-option" data-mode="filled-outline" title="Filled with outline"><i></i></button><button class="mode-option" data-mode="filled" title="Filled"><i></i></button>`;
      box.onclick=e=>{ const b=e.target.closest('button'); if(!b)return; $$('.mode-option').forEach(x=>x.classList.toggle('active',x===b));engine.setShapeMode(b.dataset.mode);};
    } else if (currentTool === 'text') box.innerHTML = '<div class="text-options">A</div>';
    else if (['fill','picker','zoom','select','freeSelect'].includes(currentTool)) box.innerHTML = '<div class="text-options"> </div>';
    else {
      const max = currentTool === 'eraser' ? 4 : 5;
      box.innerHTML = Array.from({length:max},(_,i)=>`<button class="size-option${i===1?' active':''}" data-size="${i+1}" title="Size ${i+1}"><i style="width:${2+i*3}px;height:${2+i*3}px;border-radius:${currentTool==='brush'?'50%':'0'}"></i></button>`).join('');
      box.onclick=e=>{const b=e.target.closest('button');if(!b)return;$$('.size-option').forEach(x=>x.classList.toggle('active',x===b));engine.setSize(+b.dataset.size)};
    }
  }
  function renderPalette() { $('#swatches').innerHTML = palette.map(c=>`<button class="swatch" data-color="${c}" title="${c}"><i style="background:${c}"></i></button>`).join(''); $('#swatches').oncontextmenu=e=>e.preventDefault(); $('#swatches').onpointerdown=e=>{const b=e.target.closest('.swatch');if(!b)return;e.preventDefault();setColor(e.button===2?'bg':'fg',b.dataset.color);}; }
  const menus = {
    File: [['New','Ctrl+N','new'],['Open...','Ctrl+O','open'],['Save','Ctrl+S','save'],['Save As...','', 'saveas'],['','', 'sep'],['Page Setup...','', 'page'],['Print...','Ctrl+P','print'],['','', 'sep'],['Exit','Alt+F4','exit']],
    Edit: [['Undo','Ctrl+Z','undo'],['Repeat','F4','redo'],['','', 'sep'],['Cut','Ctrl+X','cut'],['Copy','Ctrl+C','copy'],['Paste','Ctrl+V','paste'],['Clear Selection','Del','delete'],['','', 'sep'],['Select All','Ctrl+A','selectall'],['','', 'sep'],['Copy To...','', 'copyto'],['Paste From...','', 'pastefrom']],
    View: [['Tool Box','', 'toolbox','check'],['Color Box','', 'colors','check'],['Status Bar','', 'statusbar','check'],['','', 'sep'],['Zoom','', 'zoom'],['View Bitmap','Ctrl+F','viewbitmap']],
    Image: [['Flip/Rotate...','Ctrl+R','flip'],['Stretch/Skew...','Ctrl+W','stretch'],['Invert Colors','Ctrl+I','invert'],['','', 'sep'],['Attributes...','Ctrl+E','attributes'],['Clear Image','Ctrl+Shift+N','clear'],['Draw Opaque','', 'opaque','check']],
    Colors: [['Edit Colors...','', 'editcolors']],
    Help: [['Help Topics','F1','help'],['','', 'sep'],['About Paint','', 'about']]
  };
  function renderMenus(){ $('#menubar').innerHTML=Object.entries(menus).map(([name,items])=>`<div class="menu-root"><button class="menu-trigger">${name.replace(/^(.)(.*)$/,'<u>$1</u>$2')}</button><div class="menu-popup" hidden>${items.map(i=>i[2]==='sep'?'<hr>':`<button data-action="${i[2]}" ${i[3]==='check'?'data-check="1"':''}><span class="check">${i[3]==='check'?'✓':''}</span><span>${i[0]}</span><span class="shortcut">${i[1]}</span></button>`).join('')}</div></div>`).join('');
    $$('.menu-trigger').forEach(b=>b.onclick=e=>{e.stopPropagation();const r=b.parentElement,was=r.classList.contains('open');closeMenus();if(!was){r.classList.add('open');r.querySelector('.menu-popup').hidden=false;}});
    $$('.menu-popup button').forEach(b=>b.onclick=()=>{closeMenus();doAction(b.dataset.action)});refreshMenus(); }
  function closeMenus(){ $$('.menu-root').forEach(r=>{r.classList.remove('open');r.querySelector('.menu-popup').hidden=true}) }
  function refreshMenus(){ const s=engine?.getState ? engine.getState() : {}; $$('[data-action=undo]').forEach(x=>x.disabled=!s.canUndo);$$('[data-action=redo]').forEach(x=>x.disabled=!s.canRedo); }
  function dialog(title, body, actions=[['OK','ok','primary']]) { $('#dialog-title').textContent=title;$('#dialog-content').innerHTML=body;$('#dialog-actions').innerHTML=actions.map(([label,id,cls])=>`<button class="classic-button ${cls||''}" value="${id}" data-id="${id}">${label}</button>`).join(''); $('#dialog').showModal(); return new Promise(resolve=>{const d=$('#dialog'); const close=e=>{d.removeEventListener('close',close);resolve(d.returnValue||'cancel')};d.addEventListener('close',close);}); }
  $('#dialog-close').onclick=()=>$('#dialog').close('cancel');
  async function textDialog(p){ const answer=await dialog('Text',`<p>Type your text, then press OK to place it on the canvas.</p><textarea id="text-entry" autofocus></textarea><div class="field-row"><label>Font <select id="text-font"><option>MS Sans Serif</option><option>Arial</option><option>Times New Roman</option><option>Courier New</option></select></label><label>Size <input id="text-size" type="number" value="12" min="6" max="72"></label></div><label><input type="checkbox" id="text-bold"> Bold</label> <label><input type="checkbox" id="text-italic"> Italic</label>`, [['OK','ok','primary'],['Cancel','cancel']]); if(answer==='ok'){const t=$('#text-entry').value;if(t)engine.addText(t,p.x,p.y,{font:$('#text-font').value,size:+$('#text-size').value,bold:$('#text-bold').checked,italic:$('#text-italic').checked});} }
  async function attributes(){const a=await dialog('Attributes',`<p>Choose the size of your picture.</p><div class="field-row"><label>Width <input id="attr-w" type="number" min="1" max="3000" value="${canvas.width}"> pixels</label></div><div class="field-row"><label>Height <input id="attr-h" type="number" min="1" max="3000" value="${canvas.height}"> pixels</label></div><fieldset><legend>Colors</legend><label><input type="radio" name="colors" checked> Color</label><label><input type="radio" name="colors"> Black and white</label></fieldset>`,[['OK','ok','primary'],['Cancel','cancel']]);if(a==='ok'){engine.resize(+$('#attr-w').value,+$('#attr-h').value);scaleCanvas(+$('#zoom-select').value)}}
  async function flip(){const a=await dialog('Flip and Rotate',`<fieldset><legend>Flip</legend><label><input type="radio" name="transform" value="fh" checked> Flip horizontal</label><label><input type="radio" name="transform" value="fv"> Flip vertical</label></fieldset><fieldset><legend>Rotate</legend><label><input type="radio" name="transform" value="r90"> By angle: 90°</label><label><input type="radio" name="transform" value="r180"> 180°</label><label><input type="radio" name="transform" value="r270"> 270°</label></fieldset>`,[['OK','ok','primary'],['Cancel','cancel']]);if(a==='ok'){let v=$('input[name=transform]:checked').value;if(v==='fh')engine.flip(true);else if(v==='fv')engine.flip(false);else engine.rotate(+v.slice(1));}}
  async function stretch(){const a=await dialog('Stretch and Skew',`<fieldset><legend>Stretch</legend><div class="field-row"><label>Horizontal <input id="stretch-x" type="number" value="100" min="1" max="500"> %</label><label>Vertical <input id="stretch-y" type="number" value="100" min="1" max="500"> %</label></div></fieldset><p class="dialog-note">Stretching creates a new bitmap using the selected percentages.</p>`,[['OK','ok','primary'],['Cancel','cancel']]);if(a==='ok'){const x=+$('#stretch-x').value/100,y=+$('#stretch-y').value/100;const tmp=document.createElement('canvas');tmp.width=Math.max(1,Math.round(canvas.width*x));tmp.height=Math.max(1,Math.round(canvas.height*y));tmp.getContext('2d').drawImage(canvas,0,0,tmp.width,tmp.height);engine.loadImage(tmp);engine.resize(tmp.width,tmp.height);scaleCanvas(+$('#zoom-select').value)}}
  async function doAction(action){
    if(!action)return; const state=engine.getState?engine.getState():{};
    if(action==='new'){if(dirty){const a=await dialog('Paint', '<p>Save changes to the current picture?</p>',[['Yes','yes','primary'],['No','no'],['Cancel','cancel']]);if(a==='cancel')return;if(a==='yes')save();}engine.newDocument(900,560);fileName='Untitled';dirty=false;updateTitle();scaleCanvas(+$('#zoom-select').value);}
    else if(action==='open'||action==='pastefrom') $('#open-file').click();
    else if(action==='save'||action==='saveas') save();
    else if(action==='print'){const img=engine.exportPNG();const w=window.open('','_blank');w.document.write(`<title>${fileName}</title><img class="print-image" src="${img}"><script>onload=()=>print()<\/script>`);w.document.close();}
    else if(action==='exit') $('#close-window').click();
    else if(action==='undo')engine.undo(); else if(action==='redo')engine.redo();
    else if(action==='cut'){clipboard=engine.cutSelection();status(clipboard?'Selection cut.':'Select something first.');}
    else if(action==='copy'){clipboard=engine.copySelection();status(clipboard?'Selection copied.':'Select something first.');}
    else if(action==='paste'){if(clipboard)engine.pasteImage(clipboard);else status('The Clipboard is empty.');}
    else if(action==='delete')engine.deleteSelection();else if(action==='selectall')engine.selectAll();
    else if(action==='copyto')save();
    else if(action==='toolbox'||action==='colors'||action==='statusbar'){const el=action==='toolbox'?$('.toolbox'):action==='colors'?$('.colors'):$('.statusbar');el.hidden=!el.hidden;}
    else if(action==='zoom'){$('#zoom-select').focus();$('#zoom-select').click();}
    else if(action==='viewbitmap'){const d=engine.exportPNG();const win=window.open();win.document.write(`<title>${fileName} (Bitmap)</title><body style="margin:0;background:#777"><img src="${d}" style="display:block;margin:auto"></body>`);}
    else if(action==='flip')flip();else if(action==='stretch')stretch();else if(action==='invert')engine.invert();else if(action==='attributes')attributes();
    else if(action==='clear'){const a=await dialog('Paint','<p>Are you sure you want to clear the picture?</p>',[['Yes','yes','primary'],['No','no']]);if(a==='yes')engine.clear();}
    else if(action==='editcolors')customColor(); else if(action==='help')help();else if(action==='about')about();else if(action==='page')dialog('Page Setup','<p>Page setup is handled by your browser when printing.</p>',[['OK','ok','primary']]);
  }
  function save(){
    const name=`${fileName==='Untitled'?'untitled':fileName}.png`, image=engine.exportPNG();
    const finish=()=>{dirty=false;updateTitle();status('Picture saved as PNG.');};
    if(paintHost){paintHost.savePng(image,name,saved=>{if(saved)finish();else status('Picture was not saved.');});}
    else {const a=document.createElement('a');a.href=image;a.download=name;a.click();finish();}
  }
  async function customColor(){const a=await dialog('Edit Colors',`<div class="field-row"><input id="custom-picker" type="color" value="${fg}"><div><p>Choose a color, then add it to the palette.</p><button type="button" class="classic-button" id="add-color">Add to Custom Colors</button></div></div><p class="dialog-note">The selected color is used as your foreground color.</p>`,[['OK','ok','primary'],['Cancel','cancel']]);if(a==='ok')setColor('fg',$('#custom-picker').value);}
  function about(){dialog('About Spectacle Paint',`<div class="about-heading">${svg('paint')}<div><h1>Spectacle Paint</h1><small>Version 1.0 · a classic pixel-painting program</small></div></div><p>Bring your ideas to life, one pixel at a time.</p><p class="dialog-note">Built for blank-canvas afternoons and excellent doodles.</p>`,[['OK','ok','primary']]);}
  function help(){dialog('Paint Help',`<p>Everything you need is on the canvas.</p><div class="help-grid"><kbd>P</kbd><span>Pencil</span><kbd>B</kbd><span>Brush</span><kbd>F</kbd><span>Fill with color</span><kbd>E</kbd><span>Eraser</span><kbd>Ctrl+Z</kbd><span>Undo your last stroke</span><kbd>Ctrl+S</kbd><span>Save as a PNG</span></div><p class="dialog-note">Tip: left-click uses the foreground color. Right-click uses the background color.</p>`,[['OK','ok','primary']]);}
  $('#custom-color').onclick=customColor;$('#swap-colors').onclick=()=>{const c=fg;setColor('fg',bg);setColor('bg',c)};
  $('#zoom-select').onchange=e=>engine.setZoom(+e.target.value);
  $('#open-file').onchange=e=>{const f=e.target.files[0];if(!f)return;const im=new Image();im.onload=()=>{engine.loadImage(im);fileName=f.name.replace(/\.[^.]+$/,'');dirty=false;updateTitle();scaleCanvas(+$('#zoom-select').value);status('Picture opened.');};im.src=URL.createObjectURL(f);e.target.value='';};
  document.addEventListener('pointerdown',e=>{if(!e.target.closest('.menu-root'))closeMenus()});
  document.addEventListener('keydown',e=>{if($('#dialog').open)return; if(e.ctrlKey){const m={n:'new',o:'open',s:'save',z:'undo',y:'redo',x:'cut',c:'copy',v:'paste',a:'selectall',i:'invert',r:'flip',w:'stretch',e:'attributes',f:'viewbitmap'};const a=m[e.key.toLowerCase()];if(a){e.preventDefault();doAction(a);return;}}if(e.key==='Delete'){engine.deleteSelection();return}if(e.key.toLowerCase()==='x'){const c=fg;setColor('fg',bg);setColor('bg',c)}const shortcuts={p:'pencil',b:'brush',f:'fill',e:'eraser',l:'line',r:'rectangle',o:'ellipse',t:'text'};if(shortcuts[e.key.toLowerCase()]&&!e.altKey)chooseTool(shortcuts[e.key.toLowerCase()]);});
  $('#minimize').onclick=()=>{if(paintHost)paintHost.minimize()};
  $('#maximize').onclick=()=>{if(paintHost)paintHost.toggleMaximize();else $('.paint-window').classList.toggle('maximized')};
  $('#close-window').onclick=async()=>{if(dirty){const a=await dialog('Paint','<p>Save changes to the current picture?</p>',[['Yes','yes','primary'],['No','no'],['Cancel','cancel']]);if(a==='cancel')return;if(a==='yes')save();}if(paintHost)paintHost.close();else window.close()};
  $('#desktop-paint').onclick=()=>{};
  $('#start-button').onclick=()=>{};
  function resizeDrag(handle,axis){handle.onpointerdown=e=>{e.preventDefault();const start={x:e.clientX,y:e.clientY,w:canvas.width,h:canvas.height};const move=x=>{let w=start.w,h=start.h;if(axis.includes('x'))w=Math.max(100,Math.round((start.w+x.clientX-start.x)/(+$('#zoom-select').value)));if(axis.includes('y'))h=Math.max(80,Math.round((start.h+x.clientY-start.y)/(+$('#zoom-select').value)));engine.resize(w,h);scaleCanvas(+$('#zoom-select').value)};const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up)}}resizeDrag($('.resize-handle.east'),'x');resizeDrag($('.resize-handle.south'),'y');resizeDrag($('.resize-handle.corner'),'xy');
  function clock(){const d=new Date();$('#clock').textContent=d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});}clock();setInterval(clock,30000);
  renderTools();renderOptions();renderPalette();renderMenus();setColor('fg',fg);setColor('bg',bg);scaleCanvas(1);updateTitle();
})();
