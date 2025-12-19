// ==UserScript==
// @name         动漫人物抠图助手 (v7.0 工程适配版)
// @namespace    http://tampermonkey.net/
// @version      7.0
// @description  完美适配Python工程：支持GrabCut/DeepLearning切换，LaMa框选去字，保留所有Bug修复
// @author       YourName
// @match        *://*/*
// @connect      127.0.0.1
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function() {
    'use strict';

    // --- 全局变量 ---
    let strokes = [];
    let currentImgBlob = null;
    let isDrawing = false;
    let currentStroke = null;
    let editorUI = null;
    let canvas = null;
    let ctx = null; // 画笔上下文
    
    // 状态与选项
    let drawMode = 'fg'; // 'fg', 'bg', 'inpaint'
    let rectStart = null; // 框选起点
    let rectCurrent = null; // 框选当前点
    
    let useLama = false; // 是否启用去字
    let algoMethod = 'grabcut'; // 'grabcut' | 'dl'

    // --- 0. 悬浮球 ---
    const container = document.createElement('div');
    Object.assign(container.style, {
        position: 'fixed', top: '30%', right: '20px', zIndex: '999999',
        display: 'flex', flexDirection: 'column'
    });
    document.body.appendChild(container);

    const ball = document.createElement('div');
    ball.innerText = '✂️';
    Object.assign(ball.style, {
        width: '50px', height: '50px', borderRadius: '50%', background: '#2f3640', color: '#fff',
        display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '24px', cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: '2px solid rgba(255,255,255,0.2)'
    });
    container.appendChild(ball);
    ball.onclick = initSelection;

    // --- 1. 截图选区 ---
    function initSelection() {
        container.style.display = 'none';
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.3)', zIndex: '100000', cursor: 'crosshair'
        });
        
        const box = document.createElement('div');
        Object.assign(box.style, { border: '2px solid #ff4757', position: 'absolute', display: 'none' });
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        let startX, startY;
        overlay.onmousedown = (e) => {
            if (e.button !== 0) return;
            startX = e.clientX; startY = e.clientY;
            box.style.display = 'block';
            
            const onMove = (ev) => {
                const w = Math.abs(ev.clientX - startX);
                const h = Math.abs(ev.clientY - startY);
                box.style.left = Math.min(ev.clientX, startX) + 'px';
                box.style.top = Math.min(ev.clientY, startY) + 'px';
                box.style.width = w + 'px';
                box.style.height = h + 'px';
            };
            
            const onUp = async (ev) => {
                overlay.remove();
                const rect = {
                    x: Math.min(startX, ev.clientX), y: Math.min(startY, ev.clientY),
                    w: Math.abs(ev.clientX - startX), h: Math.abs(ev.clientY - startY)
                };
                if (rect.w > 10 && rect.h > 10) await doCapture(rect);
                container.style.display = 'flex';
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp, { once: true });
        };
        overlay.oncontextmenu = (e) => { e.preventDefault(); overlay.remove(); container.style.display = 'flex'; };
    }

    async function doCapture(rect) {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { displaySurface: "browser" }, audio: false, preferCurrentTab: true
            });
            const video = document.createElement('video'); video.srcObject = stream;
            await new Promise(r => { video.onloadedmetadata = () => { video.play(); setTimeout(r, 300); }});

            const c = document.createElement('canvas'); c.width = rect.w; c.height = rect.h;
            const cx = c.getContext('2d');
            const sx = video.videoWidth / window.innerWidth; const sy = video.videoHeight / window.innerHeight;
            cx.drawImage(video, rect.x * sx, rect.y * sy, rect.w * sx, rect.h * sy, 0, 0, rect.w, rect.h);
            stream.getTracks().forEach(t => t.stop());

            c.toBlob((b) => {
                currentImgBlob = b;
                openEditor(URL.createObjectURL(b));
            }, 'image/png');
        } catch (e) { console.error(e); container.style.display = 'flex'; }
    }

    // --- 2. 编辑器 ---
    function openEditor(imgUrl) {
        ctx = null; canvas = null; strokes = []; 
        drawMode = 'fg'; 
        rectStart = null; rectCurrent = null;
        // 默认选项重置
        useLama = false; algoMethod = 'grabcut';

        editorUI = document.createElement('div');
        Object.assign(editorUI.style, {
            position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
            background: 'rgba(30,30,30,0.95)', zIndex: '200000', display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        });

        // --- 顶部工具栏 (画笔模式) ---
        const toolbar = document.createElement('div');
        Object.assign(toolbar.style, {
            marginBottom: '10px', display: 'flex', gap: '15px', background: '#333', padding: '10px', borderRadius: '8px', alignItems: 'center'
        });
        const btnStyle = "padding:6px 15px; border:none; border-radius:4px; cursor:pointer; font-weight:bold; font-family:sans-serif;";
        
        toolbar.innerHTML = `
            <div style="display:flex; gap:5px; background:#444; padding:3px; border-radius:5px;">
                <button id="mode-fg" style="${btnStyle}">🟢 保留 (笔刷)</button>
                <button id="mode-bg" style="${btnStyle}">🔴 剔除 (笔刷)</button>
                <button id="mode-inpaint" style="${btnStyle}">🔵 框选去字</button>
            </div>
        `;

        // --- 底部工具栏 (选项与操作) ---
        const bottomBar = document.createElement('div');
        Object.assign(bottomBar.style, {
            marginTop: '10px', display: 'flex', gap: '20px', background: '#222', padding: '10px', borderRadius: '8px', alignItems: 'center', color: '#fff', fontSize:'14px'
        });
        bottomBar.innerHTML = `
            <div style="display:flex; alignItems:center; gap:5px;">
                <input type="checkbox" id="chk-lama" style="transform:scale(1.2);">
                <label for="chk-lama" style="cursor:pointer;">启用 LaMa 智能去字</label>
            </div>
            <div style="width:1px; height:20px; background:#555;"></div>
            <div style="display:flex; alignItems:center; gap:5px;">
                <span>算法:</span>
                <select id="sel-algo" style="padding:5px; border-radius:4px; background:#444; color:white; border:none;">
                    <option value="grabcut">GrabCut (传统交互)</option>
                    <option value="dl">AI 模型 (一键动漫)</option>
                </select>
            </div>
            <div style="width:1px; height:20px; background:#555;"></div>
            <button id="btn-undo" style="${btnStyle} background:#57606f; color:white;">↩️ 撤销</button>
            <button id="btn-run" style="${btnStyle} background:#3742fa; color:white;">▶️ 生成结果</button>
            <button id="btn-close" style="${btnStyle} background:#ff4757; color:white;">关闭</button>
        `;

        editorUI.appendChild(toolbar);

        const workspace = document.createElement('div');
        Object.assign(workspace.style, { display: 'flex', gap: '20px', alignItems: 'flex-start' });
        
        const editContainer = document.createElement('div');
        Object.assign(editContainer.style, { position: 'relative', border: '2px solid #555', lineHeight: '0' });
        
        const imgEl = document.createElement('img');
        imgEl.src = imgUrl;
        imgEl.style.maxWidth = '45vw'; imgEl.style.maxHeight = '80vh'; imgEl.style.display = 'block';
        imgEl.ondragstart = (e) => e.preventDefault();

        canvas = document.createElement('canvas');
        Object.assign(canvas.style, { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%' });
        
        editContainer.appendChild(imgEl);
        editContainer.appendChild(canvas);
        workspace.appendChild(editContainer);

        const resultContainer = document.createElement('div');
        Object.assign(resultContainer.style, { 
            width: '45vw', height: '80vh', border: '2px dashed #555', 
            display: 'flex', justifyContent: 'center', alignItems: 'center', 
            background: `url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAAXNSR0IArs4c6QAAADBJREFUOE9jZGBg+M+AH3BkYGBgYCASGwV0YwZ64aMZPprhoxk+muGjGT6a4UMyQwE53xQlqY1d7AAAAABJRU5ErkJggg==')`
        });
        const resultImg = document.createElement('img');
        Object.assign(resultImg.style, { maxWidth: '100%', maxHeight: '100%', display: 'none' });
        resultContainer.appendChild(resultImg);
        
        const dlBtn = document.createElement('button');
        dlBtn.innerText = '💾 保存图片';
        Object.assign(dlBtn.style, { marginTop: '10px', display: 'none', padding: '10px 30px', background: '#2ed573', color:'white', border:'none', borderRadius:'5px', cursor:'pointer' });
        
        const rightCol = document.createElement('div');
        Object.assign(rightCol.style, { display: 'flex', flexDirection: 'column', alignItems: 'center' });
        rightCol.appendChild(resultContainer);
        rightCol.appendChild(dlBtn);
        
        workspace.appendChild(rightCol);
        editorUI.appendChild(workspace);
        editorUI.appendChild(bottomBar); // 添加底部工具栏
        document.body.appendChild(editorUI);

        imgEl.onload = () => { 
            canvas.width = imgEl.naturalWidth; 
            canvas.height = imgEl.naturalHeight; 
            ctx = canvas.getContext('2d');
        };

        // --- 控件绑定 ---
        const btnFg = document.getElementById('mode-fg');
        const btnBg = document.getElementById('mode-bg');
        const btnInpaint = document.getElementById('mode-inpaint');
        
        const chkLama = document.getElementById('chk-lama');
        const selAlgo = document.getElementById('sel-algo');
        
        const btnRun = document.getElementById('btn-run');
        const btnUndo = document.getElementById('btn-undo');
        const btnClose = document.getElementById('btn-close');

        // 选项监听
        chkLama.onchange = (e) => { useLama = e.target.checked; };
        selAlgo.onchange = (e) => { algoMethod = e.target.value; };

        function updateModeUI() {
            [btnFg, btnBg, btnInpaint].forEach(btn => btn.style.border = '2px solid transparent');
            btnFg.style.background = 'transparent'; btnBg.style.background = 'transparent'; btnInpaint.style.background = 'transparent';

            if (drawMode === 'fg') {
                btnFg.style.background = '#2ed573'; btnFg.style.color = 'white'; btnFg.style.border = '2px solid #fff';
                canvas.style.cursor = 'crosshair';
            } else if (drawMode === 'bg') {
                btnBg.style.background = '#ff4757'; btnBg.style.color = 'white'; btnBg.style.border = '2px solid #fff';
                canvas.style.cursor = 'not-allowed';
            } else if (drawMode === 'inpaint') {
                btnInpaint.style.background = '#1e90ff'; btnInpaint.style.color = 'white'; btnInpaint.style.border = '2px solid #fff';
                canvas.style.cursor = 'cell'; // 框选光标
            }
        }
        updateModeUI();

        btnFg.onclick = () => { drawMode = 'fg'; updateModeUI(); };
        btnBg.onclick = () => { drawMode = 'bg'; updateModeUI(); };
        btnInpaint.onclick = () => { drawMode = 'inpaint'; updateModeUI(); };

        btnRun.onclick = async () => {
            if (!currentImgBlob) return;
            const originalText = btnRun.innerText;
            btnRun.innerText = '⏳ 计算中...'; btnRun.disabled = true; btnRun.style.opacity = '0.7';

            // 构建参数
            const options = {
                use_lama: useLama,
                method: algoMethod
            };

            const fd = new FormData();
            fd.append('image', currentImgBlob, 'src.png');
            fd.append('corrections', JSON.stringify(strokes));
            // 🔥 [关键更新] 发送选项到新后端
            fd.append('options', JSON.stringify(options));

            try {
                const r = await fetch('http://127.0.0.1:5000/process', { method: 'POST', body: fd });
                if(!r.ok) throw new Error("Server error");
                const resBlob = await r.blob();
                const resUrl = URL.createObjectURL(resBlob);
                resultImg.src = resUrl; resultImg.style.display = 'block';
                dlBtn.style.display = 'block';
                dlBtn.onclick = () => { const a = document.createElement('a'); a.href = resUrl; a.download = 'cutout.png'; a.click(); };
            } catch(e) { alert("处理失败，请检查后端是否开启"); }
            finally { btnRun.innerText = originalText; btnRun.disabled = false; btnRun.style.opacity = '1'; }
        };

        btnUndo.onclick = () => { strokes.pop(); redrawCanvas(); };
        
        btnClose.onclick = () => { 
            editorUI.remove(); 
            container.style.display = 'flex';
            canvas = null; ctx = null; // 清理
        };

        canvas.oncontextmenu = (e) => e.preventDefault();
        
        // --- 鼠标交互逻辑 (支持笔刷和框选) ---
        canvas.onmousedown = (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            isDrawing = true;
            
            if (drawMode === 'inpaint') {
                // 框选模式：只记录起点
                rectStart = getMousePos(e);
                rectCurrent = rectStart;
            } else {
                // 笔刷模式：开始画线
                addPoint(e);
            }
        };

        window.addEventListener('mousemove', (e) => {
            if (!isDrawing) return;
            e.preventDefault();
            
            if (drawMode === 'inpaint') {
                // 框选模式：更新预览
                rectCurrent = getMousePos(e);
                redrawCanvas();
            } else {
                // 笔刷模式：继续画线
                addPoint(e);
            }
        });

        window.addEventListener('mouseup', () => { 
            if (isDrawing && drawMode === 'inpaint' && rectStart && rectCurrent) {
                // 框选结束：保存矩形笔画
                strokes.push({
                    type: 'inpaint',
                    shape: 'rect',
                    points: [rectStart, rectCurrent]
                });
                rectStart = null; rectCurrent = null;
                redrawCanvas();
            }
            isDrawing = false; 
            currentStroke = null; 
        });

        function getMousePos(e) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            return [
                Math.round((e.clientX - rect.left) * scaleX),
                Math.round((e.clientY - rect.top) * scaleY)
            ];
        }

        function addPoint(e) {
            const pos = getMousePos(e);
            if (!currentStroke) {
                currentStroke = { type: drawMode, shape: 'line', points: [] };
                strokes.push(currentStroke);
            }
            currentStroke.points.push(pos);
            redrawCanvas();
        }

        function redrawCanvas() {
            if (!ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // 绘制已保存的笔画
            strokes.forEach(s => {
                ctx.beginPath();
                // 设置样式
                if (s.type === 'fg') ctx.strokeStyle = 'rgba(46, 213, 115, 0.6)';
                else if (s.type === 'bg') ctx.strokeStyle = 'rgba(255, 71, 87, 0.6)';
                else if (s.type === 'inpaint') {
                    ctx.fillStyle = 'rgba(30, 144, 255, 0.4)'; 
                    ctx.strokeStyle = 'rgba(30, 144, 255, 0.8)';
                }

                if (s.shape === 'rect') {
                    // 绘制矩形
                    const w = s.points[1][0] - s.points[0][0];
                    const h = s.points[1][1] - s.points[0][1];
                    ctx.fillRect(s.points[0][0], s.points[0][1], w, h);
                    ctx.strokeRect(s.points[0][0], s.points[0][1], w, h);
                } else {
                    // 绘制线条
                    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 15;
                    if (s.points.length > 0) {
                        ctx.moveTo(s.points[0][0], s.points[0][1]);
                        if (s.points.length === 1) ctx.lineTo(s.points[0][0], s.points[0][1]);
                        else s.points.forEach(p => ctx.lineTo(p[0], p[1]));
                        ctx.stroke();
                    }
                }
            });

            // 绘制拖拽中的预览框 (仅 Inpaint)
            if (isDrawing && drawMode === 'inpaint' && rectStart && rectCurrent) {
                const w = rectCurrent[0] - rectStart[0];
                const h = rectCurrent[1] - rectStart[1];
                ctx.fillStyle = 'rgba(30, 144, 255, 0.4)';
                ctx.strokeStyle = 'rgba(30, 144, 255, 0.8)';
                ctx.lineWidth = 2;
                ctx.fillRect(rectStart[0], rectStart[1], w, h);
                ctx.strokeRect(rectStart[0], rectStart[1], w, h);
            }
        }
    }
})();