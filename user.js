// ==UserScript==
// @name         test
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  基于grabcut的动漫角色提取
// @author       4FGR
// @match        *://*/*
// @connect      127.0.0.1
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    const css = `
        .ac-float-ball {
            position: fixed; top: 30%; right: 20px; z-index: 999999;
            width: 50px; height: 50px; border-radius: 50%;
            background: linear-gradient(135deg, #2f3640, #353b48);
            color: #fff; display: flex; justify-content: center; align-items: center;
            font-size: 24px; cursor: pointer;
            box-shadow: 0 4px 15px rgba(0,0,0,0.4);
            border: 2px solid rgba(255,255,255,0.1);
            transition: transform 0.2s, box-shadow 0.2s;
            user-select: none;
        }
        .ac-float-ball:hover { transform: scale(1.1); box-shadow: 0 6px 20px rgba(0,0,0,0.5); }
        .ac-overlay {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.4); z-index: 100000; cursor: crosshair;
            backdrop-filter: blur(2px);
        }
        .ac-selection-box {
            border: 2px solid #ff4757; position: absolute; display: none;
            background: rgba(255, 71, 87, 0.1);
            box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
        }
        .ac-editor-mask {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(18, 18, 18, 0.95); z-index: 200000;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            backdrop-filter: blur(5px);
        }
        .ac-toolbar {
            margin-bottom: 15px; display: flex; gap: 10px;
            background: #2d3436; padding: 8px; border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .ac-btn-group { display: flex; gap: 5px; background: #1e272e; padding: 4px; border-radius: 8px; }
        .ac-btn {
            padding: 8px 16px; border: none; border-radius: 6px;
            cursor: pointer; font-weight: 600; font-size: 13px;
            transition: all 0.2s; color: #b2bec3; background: transparent;
            display: flex; align-items: center; gap: 5px;
        }
        .ac-btn:hover { color: #fff; background: rgba(255,255,255,0.05); }
        .ac-btn.active-fg { background: #2ed573; color: #fff; box-shadow: 0 2px 8px rgba(46, 213, 115, 0.4); }
        .ac-btn.active-bg { background: #ff4757; color: #fff; box-shadow: 0 2px 8px rgba(255, 71, 87, 0.4); }
        .ac-btn.active-inpaint { background: #1e90ff; color: #fff; box-shadow: 0 2px 8px rgba(30, 144, 255, 0.4); }

        .ac-workspace { display: flex; gap: 20px; align-items: flex-start; height: 80vh; }
        .ac-canvas-box {
            position: relative; border: 2px solid #444; border-radius: 8px; overflow: hidden;
            box-shadow: 0 8px 24px rgba(0,0,0,0.3); background: #000;
        }
        .ac-result-box {
            width: 45vw; height: 100%; border: 2px dashed #555; border-radius: 8px;
            display: flex; justify-content: center; align-items: center;
            background: #ffffff; /* 纯白背景 */
            position: relative; overflow: hidden;
        }
        .ac-bottom-bar {
            margin-top: 15px; display: flex; gap: 20px;
            background: #2d3436; padding: 10px 20px; border-radius: 12px;
            align-items: center; color: #dfe6e9; font-size: 14px;
            box-shadow: 0 -4px 12px rgba(0,0,0,0.2);
        }
        .ac-checkbox-wrapper { display: flex; align-items: center; gap: 8px; cursor: pointer; }
        .ac-checkbox { accent-color: #2ed573; transform: scale(1.1); cursor: pointer; }
        .ac-divider { width: 1px; height: 24px; background: #636e72; }

        .ac-btn-action { background: #57606f; color: white; }
        .ac-btn-run { background: linear-gradient(135deg, #3742fa, #5352ed); color: white; }
        .ac-btn-run:hover { box-shadow: 0 4px 12px rgba(55, 66, 250, 0.4); transform: translateY(-1px); }
        .ac-btn-close { background: #ff4757; color: white; }
        .ac-btn-save {
            margin-top: 15px; padding: 10px 30px; background: #2ed573; color: white;
            border: none; border-radius: 20px; cursor: pointer; font-weight: bold;
            box-shadow: 0 4px 12px rgba(46, 213, 115, 0.3); transition: transform 0.2s;
        }
        .ac-btn-save:hover { transform: translateY(-2px); }
        .ac-disabled { opacity: 0.7; cursor: wait; }
    `;

    const styleEl = document.createElement('style');
    styleEl.innerHTML = css;
    document.head.appendChild(styleEl);

    let strokes = [];
    let currentImgBlob = null;
    let isDrawing = false;
    let currentStroke = null;
    let editorUI = null;
    let canvas = null;
    let ctx = null;

    let drawMode = 'fg';
    let rectStart = null;
    let rectCurrent = null;

    let useLama = false;

    // --- 0. 悬浮球 ---
    const container = document.createElement('div');
    const ball = document.createElement('div');
    ball.className = 'ac-float-ball';
    ball.innerText = '✂️';
    ball.onclick = initSelection;
    container.appendChild(ball);
    document.body.appendChild(container);

    // --- 1. 截图选区 ---
    function initSelection() {
        ball.style.display = 'none';
        const overlay = document.createElement('div');
        overlay.className = 'ac-overlay';

        const box = document.createElement('div');
        box.className = 'ac-selection-box';
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
                ball.style.display = 'flex';
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp, { once: true });
        };
        overlay.oncontextmenu = (e) => { e.preventDefault(); overlay.remove(); ball.style.display = 'flex'; };
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
        } catch (e) { console.error(e); ball.style.display = 'flex'; }
    }

    // --- 2. 编辑器 ---
    function openEditor(imgUrl) {
        ctx = null; canvas = null; strokes = [];
        drawMode = 'fg';
        rectStart = null; rectCurrent = null;
        useLama = false;

        editorUI = document.createElement('div');
        editorUI.className = 'ac-editor-mask';

        // 顶部工具栏
        const toolbar = document.createElement('div');
        toolbar.className = 'ac-toolbar';
        toolbar.innerHTML = `
            <div class="ac-btn-group">
                <button id="mode-fg" class="ac-btn">🟢 保留</button>
                <button id="mode-bg" class="ac-btn">🔴 剔除</button>
                <button id="mode-inpaint" class="ac-btn">🔵 框选去字</button>
            </div>
        `;

        // 底部工具栏
        const bottomBar = document.createElement('div');
        bottomBar.className = 'ac-bottom-bar';
        bottomBar.innerHTML = `
            <label class="ac-checkbox-wrapper">
                <input type="checkbox" id="chk-lama" class="ac-checkbox">
                <span>LaMa 智能去字</span>
            </label>
            <div class="ac-divider"></div>
            <button id="btn-undo" class="ac-btn ac-btn-action">↩️ 撤销</button>
            <button id="btn-run" class="ac-btn ac-btn-run">▶️ 生成结果</button>
            <div class="ac-divider"></div>
            <button id="btn-close" class="ac-btn ac-btn-close">关闭</button>
        `;

        // 工作区
        const workspace = document.createElement('div');
        workspace.className = 'ac-workspace';

        const editContainer = document.createElement('div');
        editContainer.className = 'ac-canvas-box';

        const imgEl = document.createElement('img');
        imgEl.src = imgUrl;
        imgEl.style.maxWidth = '45vw'; imgEl.style.maxHeight = '80vh'; imgEl.style.display = 'block';
        imgEl.ondragstart = (e) => e.preventDefault();

        canvas = document.createElement('canvas');
        Object.assign(canvas.style, { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%' });

        editContainer.appendChild(imgEl);
        editContainer.appendChild(canvas);

        // 结果区
        const rightCol = document.createElement('div');
        Object.assign(rightCol.style, { display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' });

        const resultContainer = document.createElement('div');
        resultContainer.className = 'ac-result-box';

        const resultImg = document.createElement('img');
        Object.assign(resultImg.style, { maxWidth: '100%', maxHeight: '100%', display: 'none' });
        resultContainer.appendChild(resultImg);

        const dlBtn = document.createElement('button');
        dlBtn.className = 'ac-btn-save';
        dlBtn.innerText = '💾 保存图片';
        dlBtn.style.display = 'none';

        rightCol.appendChild(resultContainer);
        rightCol.appendChild(dlBtn);

        workspace.appendChild(editContainer);
        workspace.appendChild(rightCol);

        editorUI.appendChild(toolbar);
        editorUI.appendChild(workspace);
        editorUI.appendChild(bottomBar);
        document.body.appendChild(editorUI);

        imgEl.onload = () => {
            canvas.width = imgEl.naturalWidth;
            canvas.height = imgEl.naturalHeight;
            ctx = canvas.getContext('2d');
        };

        const btnFg = document.getElementById('mode-fg');
        const btnBg = document.getElementById('mode-bg');
        const btnInpaint = document.getElementById('mode-inpaint');
        const chkLama = document.getElementById('chk-lama');
        const btnRun = document.getElementById('btn-run');
        const btnUndo = document.getElementById('btn-undo');
        const btnClose = document.getElementById('btn-close');

        chkLama.onchange = (e) => { useLama = e.target.checked; };

        function updateModeUI() {
            [btnFg, btnBg, btnInpaint].forEach(btn => {
                btn.classList.remove('active-fg', 'active-bg', 'active-inpaint');
            });

            if (drawMode === 'fg') {
                btnFg.classList.add('active-fg');
                canvas.style.cursor = 'crosshair';
            } else if (drawMode === 'bg') {
                btnBg.classList.add('active-bg');
                canvas.style.cursor = 'not-allowed';
            } else if (drawMode === 'inpaint') {
                btnInpaint.classList.add('active-inpaint');
                canvas.style.cursor = 'cell';
            }
        }
        updateModeUI();

        btnFg.onclick = () => { drawMode = 'fg'; updateModeUI(); };
        btnBg.onclick = () => { drawMode = 'bg'; updateModeUI(); };
        btnInpaint.onclick = () => { drawMode = 'inpaint'; updateModeUI(); };

        btnRun.onclick = async () => {
            if (!currentImgBlob) return;
            const originalText = btnRun.innerText;
            btnRun.innerText = '⏳ 计算中...'; btnRun.disabled = true; btnRun.classList.add('ac-disabled');

            const options = { use_lama: useLama, method: 'grabcut' };

            const fd = new FormData();
            fd.append('image', currentImgBlob, 'src.png');
            fd.append('corrections', JSON.stringify(strokes));
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
            finally { btnRun.innerText = originalText; btnRun.disabled = false; btnRun.classList.remove('ac-disabled'); }
        };

        btnUndo.onclick = () => { strokes.pop(); redrawCanvas(); };

        btnClose.onclick = () => {
            editorUI.remove();
            ball.style.display = 'flex';
            canvas = null; ctx = null;
        };

        canvas.oncontextmenu = (e) => e.preventDefault();

        canvas.onmousedown = (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            isDrawing = true;

            if (drawMode === 'inpaint') {
                rectStart = getMousePos(e);
                rectCurrent = rectStart;
            } else {
                addPoint(e);
            }
        };

        window.addEventListener('mousemove', (e) => {
            if (!isDrawing) return;
            e.preventDefault();

            if (drawMode === 'inpaint') {
                rectCurrent = getMousePos(e);
                redrawCanvas();
            } else {
                addPoint(e);
            }
        });

        window.addEventListener('mouseup', () => {
            if (isDrawing && drawMode === 'inpaint' && rectStart && rectCurrent) {
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

            strokes.forEach(s => {
                ctx.beginPath();
                if (s.type === 'fg') ctx.strokeStyle = 'rgba(46, 213, 115, 0.6)';
                else if (s.type === 'bg') ctx.strokeStyle = 'rgba(255, 71, 87, 0.6)';
                else if (s.type === 'inpaint') {
                    ctx.fillStyle = 'rgba(30, 144, 255, 0.4)';
                    ctx.strokeStyle = 'rgba(30, 144, 255, 0.8)';
                }

                if (s.shape === 'rect') {
                    const w = s.points[1][0] - s.points[0][0];
                    const h = s.points[1][1] - s.points[0][1];
                    ctx.fillRect(s.points[0][0], s.points[0][1], w, h);
                    ctx.strokeRect(s.points[0][0], s.points[0][1], w, h);
                } else {
                    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 15;
                    if (s.points.length > 0) {
                        ctx.moveTo(s.points[0][0], s.points[0][1]);
                        if (s.points.length === 1) ctx.lineTo(s.points[0][0], s.points[0][1]);
                        else s.points.forEach(p => ctx.lineTo(p[0], p[1]));
                        ctx.stroke();
                    }
                }
            });

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