// ==UserScript==
// @name         动漫角色前景提取
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  基于grabcut的动漫角色抠图
// @author       4FGR
// @match        *://*/*
// @connect      127.0.0.1
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';              // 严格模式，禁止使用未声明的变量


    const css = `
        /* 悬浮球样式 */
        .ac-float-ball {
            position: fixed;
            top: 30%;
            right: 20px;
            z-index: 999999;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background:
            linear-gradient(135deg, #2f3640, #353b48);        /* 悬浮球背景渐变 */
            color: #fff;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 24px;
            cursor: move;
            box-shadow: 0 4px 15px rgba(0,0,0,0.4);
            border: 2px solid rgba(255,255,255,0.1);
            transition: transform 0.2s, box-shadow 0.2s;
            user-select: none;
            touch-action: none;
        }

        /* 悬浮球激活样式 */
        .ac-float-ball:active {
            box-shadow: 0 8px 25px rgba(0,0,0,0.6);  /* 悬浮球激活阴影 */
        }

        /* 悬浮球覆盖层样式 */
        .ac-overlay {
            position: fixed;
            top: 0; left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0,0,0,0.4);
            z-index: 100000;
            cursor: crosshair;               /* 鼠标悬停时显示为十字光标 */
        }

        /* 框选去字框样式 */
        .ac-selection-box {
            border: 2px solid #ff4757;
            position: absolute;
            display: none;
            background: rgba(255, 71, 87, 0.1);
            box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);   /* 实现“高亮选区+页面遮罩”的效果 */
        }

        /* 编辑器遮罩样式 */
        .ac-editor-mask {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(18, 18, 18, 0.95);
            z-index: 200000;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            backdrop-filter: blur(5px);                 /* 背景模糊效果 */
        }

        /* ------------------------- 工具栏（顶部）样式 ------------------------- */
        .ac-toolbar {
            margin-bottom: 15px;                         /* 工具栏底部外边距 */
            display: flex;
            gap: 10px;
            background: #2d3436;
            padding: 8px;                               /* 工具栏内边距 */
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }

        /* 工具栏按钮组样式 */
        .ac-btn-group {
            display: flex;
            gap: 5px;                               /* 按钮间距 */
            background: #1e272e;
            padding: 4px;                           /* 按钮组内边距 */
            border-radius: 8px;
        }

        /* 工具栏按钮样式 */
        .ac-btn {
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            cursor: pointer;                       /* 手型光标 */
            font-weight: 600;
            font-size: 13px;
            transition: all 0.2s;
            color: #b2bec3;
            background: transparent;               /* 背景透明 */
            display: flex;
            align-items: center;                   /* 垂直居中 */
            gap: 5px;
        }

        /* 工具栏按钮悬停样式 */
        .ac-btn:hover {
            color: #fff;
            background: rgba(255,255,255,0.05);
        }

        /* 工具栏按钮激活样式1 */
        .ac-btn.active-fg {
            background: #2ed573;
            color: #fff;
            box-shadow: 0 2px 8px rgba(46, 213, 115, 0.4);
        }

        /* 工具栏按钮激活样式2 */
        .ac-btn.active-bg {
            background: #ff4757;
            color: #fff;
            box-shadow: 0 2px 8px rgba(255, 71, 87, 0.4);
        }

        /* 工具栏按钮激活样式3 */
        .ac-btn.active-inpaint {
            background: #1e90ff;
            color: #fff;
            box-shadow: 0 2px 8px rgba(30, 144, 255, 0.4);
        }

        /* ------------------------- 工作区样式 ------------------------- */
        .ac-workspace {
            display: flex;
            gap: 20px;
            align-items: flex-start;
            height: 80vh;
        }

        /* 画布盒子样式 */
        .ac-canvas-box {
            position: relative;
            border: 2px solid #444;
            border-radius: 8px;
            overflow: hidden;                           /* 超出部分隐藏 */
            box-shadow: 0 8px 24px rgba(0,0,0,0.3);
            background: #000;
        }

        /* 输出结果盒子样式 */
        .ac-result-box {
            width: 45vw;
            height: 100%;
            border: 2px dashed #555;          /* 虚线边框 */
            border-radius: 8px;

            display: flex;
            justify-content: center;
            align-items: center;
            background: #ffffff;
            position: relative;
            overflow: hidden;
        }

        /* ------------------------- 底部栏样式 ------------------------- */
        .ac-bottom-bar {
            margin-top: 15px;
            display: flex;
            gap: 20px;
            background: #2d3436;
            padding: 10px 20px;
            border-radius: 12px;
            align-items: center;
            color: #dfe6e9;
            font-size: 14px;
            box-shadow: 0 -4px 12px rgba(0,0,0,0.2);
        }

        /* 复选框包裹样式 */
        .ac-checkbox-wrapper {
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
        }

        /* 复选框样式 */
        .ac-checkbox {
            accent-color: #2ed573;
            transform: scale(1.1);
            cursor: pointer;
        }

        /* 竖直分割线样式 */
        .ac-divider {
            width: 1px;
            height: 24px;
            background: #636e72;
        }

        /* 按钮动作样式 */
        .ac-btn-action {
            background: #57606f;
            color: white;
        }

        /* 按钮运行样式 */
        .ac-btn-run {
            background: linear-gradient(135deg, #3742fa, #5352ed);    /* 渐变背景 */
            color: white;
        }

        /* 按钮运行悬停样式 */
        .ac-btn-run:hover {
            box-shadow: 0 4px 12px rgba(55, 66, 250, 0.4);
            /* 悬停时上移1px, 微微弹起。负号代表方向：负值是向上，正值是向下。 */
            transform: translateY(-1px);
        }

        /* 按钮关闭样式 */
        .ac-btn-close {
            background: #ff4757;
            color: white;
        }

        /* 按钮保存样式 */
        .ac-btn-save {
            margin-top: 15px;
            padding: 10px 30px;
            background: #2ed573;
            color: white;
            border: none;
            border-radius: 20px;
            cursor: pointer;
            font-weight: bold;                                      /* 字体加粗 */
            box-shadow: 0 4px 12px rgba(46, 213, 115, 0.3);
            transition: transform 0.2s;                             /* 过渡效果 */
        }

        /* 按钮保存悬停样式 */
        .ac-btn-save:hover {
            transform: translateY(-2px);
        }

        /* 按钮禁用样式 */
        .ac-disabled {
            opacity: 0.7;              /* 70%不透明 */
            cursor: wait;              /* "等待"光标, 通常显示为一个旋转的圆圈或沙漏 */
        }
    `;

    // 注入样式：优先用 Tampermonkey 的 GM_addStyle，避免某些页面 <head> 不存在/被 CSP 干扰
    if (typeof GM_addStyle === 'function') {
        GM_addStyle(css);
    } else {
        const styleEl = document.createElement('style');
        styleEl.textContent = css;
        (document.head || document.documentElement).appendChild(styleEl);
    }

    let strokes = [];                              // 用来存储用户在图片上绘制的所有“路径”或“操作记录
    let currentImgBlob = null;                      // 当前图片Blob(二进制数据对象)
    let isDrawing = false;                          // 是否正在绘制
    let currentStroke = null;                       // 当前绘制路径
    let editorUI = null;                            // 编辑器UI
    let canvas = null;                              // 画布
    let ctx = null;                                  // 画布上下文

    let drawMode = 'fg';                             // 绘制模式
    let rectStart = null;                            // 框选起始点
    let rectCurrent = null;                          // 框选当前点

    let useLama = false;                             // 是否使用LaMa去字

    const container = document.createElement('div'); // 创建容器元素
    const ball = document.createElement('div');      // 创建悬浮球元素
    ball.className = 'ac-float-ball';                // 设置悬浮球类名
    ball.innerText = '✂️';                           // 设置悬浮球文本

    // 注册重置悬浮球位置命令（仅在 Tampermonkey 环境下可用）
    if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand("重置悬浮球位置", () => {
            ball.style.top = '30%';
            ball.style.right = '20px';
            ball.style.left = 'auto';
            ball.style.bottom = 'auto';
        });
    } else {
        // 如果你不是在 Tampermonkey/Violentmonkey 里跑这个脚本，这里会是 undefined
        console.warn('[anime-cutout] GM_registerMenuCommand is not available (are you running this outside a userscript manager?)');
    }

    let isDraggingBall = false;                     // 是否正在拖动悬浮球
    let hasMoved = false;                            // 是否已经移动过悬浮球
    let dragStartX, dragStartY;                      // 拖动起始X,Y坐标
    let initialLeft, initialTop;                     // 初始左,上坐标

    // 悬浮球鼠标按下事件
    ball.onmousedown = (e) => {
        if (e.button !== 0) return;                  // 如果不是左键，则返回
        isDraggingBall = true;                         // 设置为正在拖动悬浮球
        hasMoved = false;                              // 设置为未移动过悬浮球

        dragStartX = e.clientX;                        // 设置拖动起始X坐标
        dragStartY = e.clientY;                        // 设置拖动起始Y坐标

        const rect = ball.getBoundingClientRect();      // 获取悬浮球边界矩形
        initialLeft = rect.left;                        // 设置初始左坐标
        initialTop = rect.top;                          // 设置初始上坐标

        ball.style.right = 'auto';                      // 设置悬浮球右边为自动
        ball.style.bottom = 'auto';                      // 设置悬浮球底部为自动
        ball.style.left = initialLeft + 'px';            // 设置悬浮球左坐标
        ball.style.top = initialTop + 'px';              // 设置悬浮球上坐标

        ball.style.transition = 'none';                  // 设置悬浮球过渡效果为无
    };

    // 悬浮球鼠标移动事件
    window.addEventListener('mousemove', (e) => {
        if (!isDraggingBall) return;                  // 如果不是正在拖动悬浮球，则返回
        e.preventDefault();                            // 阻止默认事件

        const dx = e.clientX - dragStartX;            // 计算X轴偏移量
        const dy = e.clientY - dragStartY;            // 计算Y轴偏移量

        if (Math.abs(dx) > 2 || Math.abs(dy) > 2)
            hasMoved = true;                          // 如果X轴或Y轴偏移量大于2，则设置为已移动过悬浮球

        let newLeft = initialLeft + dx;                // 计算新的左坐标
        let newTop = initialTop + dy;                  // 计算新的上坐标

        const winW = window.innerWidth;                // 获取窗口宽度
        const winH = window.innerHeight;               // 获取窗口高度
        const ballW = ball.offsetWidth;                // 获取悬浮球宽度
        const ballH = ball.offsetHeight;               // 获取悬浮球高度

        newLeft = Math.max(0, Math.min(newLeft, winW - ballW)); // 计算新的左坐标
        newTop = Math.max(0, Math.min(newTop, winH - ballH));   // 计算新的上坐标

        ball.style.left = newLeft + 'px';                      // 设置悬浮球左坐标
        ball.style.top = newTop + 'px';                        // 设置悬浮球上坐标
    });

    // 悬浮球鼠标松开事件
    window.addEventListener('mouseup', () => {
        if (isDraggingBall) {                          // 如果正在拖动悬浮球，则设置为未拖动
            isDraggingBall = false;                     // 设置为未拖动悬浮球
            ball.style.transition = 'transform 0.2s, box-shadow 0.2s'; // 设置悬浮球过渡效果为transform 0.2s, box-shadow 0.2s
        }
    });

    // 悬浮球点击事件，初始化框选
    ball.onclick = () => {
        if (!hasMoved) {
            initSelection();                           // 初始化框选
        }
    };

    container.appendChild(ball);                      // 将悬浮球添加到容器中
    (document.body || document.documentElement).appendChild(container); // 将容器添加到页面中

    // 初始化框选
    function initSelection() {
        ball.style.display = 'none';                     // 设置悬浮球显示为无
        const overlay = document.createElement('div');    // 创建覆盖层元素
        overlay.className = 'ac-overlay';                 // 设置覆盖层类名

        const box = document.createElement('div');        // 创建框选去字框元素
        box.className = 'ac-selection-box';               // 设置框选去字框类名
        overlay.appendChild(box);                         // 将框选去字框添加到覆盖层中
        (document.body || document.documentElement).appendChild(overlay); // 将覆盖层添加到页面中

        let startX, startY;                              // 框选起始X,Y坐标
        // 初始化框选起始X,Y坐标
        overlay.onmousedown = (e) => {
            if (e.button !== 0) return;                  // 如果不是左键，则返回
            startX = e.clientX; startY = e.clientY;      // 设置框选起始X,Y坐标
            box.style.display = 'block';                  // 设置框选去字框显示为块级
            // 框选移动事件
            const onMove = (ev) => {
                const w = Math.abs(ev.clientX - startX);   // 计算框选宽度
                const h = Math.abs(ev.clientY - startY);   // 计算框选高度
                box.style.left = Math.min(ev.clientX, startX) + 'px'; // 设置框选去字框左坐标
                box.style.top = Math.min(ev.clientY, startY) + 'px'; // 设置框选去字框上坐标
                box.style.width = w + 'px';                  // 设置框选去字框宽度
                box.style.height = h + 'px';                 // 设置框选去字框高度
            };
            // 框选鼠标松开事件
            const onUp = async (ev) => {
                overlay.remove();                            // 移除覆盖层
                overlay.remove();                            // 移除覆盖层
                // 计算框选矩形
                const rect = {
                    x: Math.min(startX, ev.clientX),         // 设置框选去字框左坐标
                    y: Math.min(startY, ev.clientY),         // 设置框选去字框上坐标
                    w: Math.abs(ev.clientX - startX),         // 设置框选去字框宽度
                    h: Math.abs(ev.clientY - startY)          // 设置框选去字框高度
                };
                if (rect.w > 10 && rect.h > 10)             // 如果框选宽度大于10且框选高度大于10，则捕获框选区域
                    await doCapture(rect);                // 捕获框选区域
                ball.style.display = 'flex';                // 设置悬浮球显示为块级
            };
            window.addEventListener('mousemove', onMove);             // 添加框选移动事件
            window.addEventListener('mouseup', onUp, { once: true }); // 添加框选鼠标松开事件
        };

        // 覆盖层鼠标右键事件
        overlay.oncontextmenu = (e) => {
            e.preventDefault();                            // 阻止默认事件
            overlay.remove();                               // 移除覆盖层
            ball.style.display = 'flex';                    // 设置悬浮球显示为块级
        };
    }

    // 捕获框选区域
    async function doCapture(rect) {
        try {
            // 获取屏幕捕获流
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { displaySurface: "browser" },      // 显示Surface为浏览器
                audio: false,                              // 不捕获音频
                preferCurrentTab: true                     // 优先捕获当前标签页
            });
            const video = document.createElement('video'); // 创建视频元素
            video.srcObject = stream;                      // 设置视频源为捕获流
            // 等待视频加载元数据完成后播放视频
            await new Promise(r => {
                // 视频加载元数据完成后
                video.onloadedmetadata = () => {
                    video.play();                             // 播放视频
                    setTimeout(r, 300);                      // 设置超时时间为300毫秒
                }
            });

            const c = document.createElement('canvas'); // 创建画布元素
            c.width = rect.w;                            // 设置画布宽度为框选宽度
            c.height = rect.h;                          // 设置画布高度为框选高度
            const cx = c.getContext('2d');              // 获取画布上下文
            const sx = video.videoWidth / window.innerWidth;   // 设置水平缩放比例
            const sy = video.videoHeight / window.innerHeight; // 设置垂直缩放比例
            // 绘制视频到画布
            cx.drawImage(video, rect.x * sx, rect.y * sy, rect.w * sx, rect.h * sy, 0, 0, rect.w, rect.h);
            stream.getTracks().forEach(t => t.stop());
            // 停止捕获流，并转换为Blob
            c.toBlob((b) => {
                currentImgBlob = b;                               // 设置当前图片Blob
                openEditor(URL.createObjectURL(b));             // 打开编辑器
            }, 'image/png');                                     // 设置图片格式为PNG
        } catch (e) {                                          // 捕获错误
            console.error(e);                                   // 打印错误信息
            ball.style.display = 'flex';                        // 设置悬浮球显示为块级
        }
    }

    // 打开编辑器
    function openEditor(imgUrl) {
        ctx = null;                                         // 设置画布上下文为空
        canvas = null;                                      // 设置画布为空
        strokes = [];                                        // 设置绘制路径为空
        drawMode = 'fg';                                     // 设置绘制模式为前景
        rectStart = null; rectCurrent = null;                // 设置框选起始点为空
        useLama = false;                                    // 设置使用LaMa为false

        editorUI = document.createElement('div');             // 创建编辑器UI元素
        editorUI.className = 'ac-editor-mask';                 // 设置编辑器遮罩类名

        const toolbar = document.createElement('div');        // 创建工具栏元素
        toolbar.className = 'ac-toolbar';                     // 设置工具栏类名
        // 工具栏HTML内容
        toolbar.innerHTML = `
            <div class="ac-btn-group">
                <button id="mode-fg" class="ac-btn">🟢 保留</button>
                <button id="mode-bg" class="ac-btn">🔴 剔除</button>
                <button id="mode-inpaint" class="ac-btn" style="display: none;">🔵 框选去字</button>
            </div>
        `;

        const bottomBar = document.createElement('div');        // 创建底部栏元素
        bottomBar.className = 'ac-bottom-bar';                   // 设置底部栏类名
        // 底部栏HTML内容
        bottomBar.innerHTML = `
            <label class="ac-checkbox-wrapper" style="display: none;">
                <input type="checkbox" id="chk-lama" class="ac-checkbox">
                <span>LaMa 智能去字</span>
            </label>
            <div class="ac-divider"></div>
            <button id="btn-undo" class="ac-btn ac-btn-action">↩️ 撤销</button>
            <button id="btn-run" class="ac-btn ac-btn-run">▶️ 生成结果</button>
            <div class="ac-divider"></div>
            <button id="btn-close" class="ac-btn ac-btn-close">关闭</button>
        `;

        const workspace = document.createElement('div');        // 创建工作区元素
        workspace.className = 'ac-workspace';                     // 设置工作区类名

        const editContainer = document.createElement('div');        // 创建编辑容器元素
        editContainer.className = 'ac-canvas-box';                   // 设置编辑容器类名

        const imgEl = document.createElement('img');                // 创建图片元素
        imgEl.src = imgUrl;                                        // 设置图片源为图片URL
        imgEl.style.maxWidth = '45vw';                             // 设置图片最大宽度为45vw
        imgEl.style.maxHeight = '80vh';                            // 设置图片最大高度为80vh
        imgEl.style.display = 'block';                              // 设置图片显示为块级
        imgEl.ondragstart = (e) => e.preventDefault();             // 阻止图片拖动事件

        canvas = document.createElement('canvas');               // 创建画布元素
        Object.assign(canvas.style, {
            position: 'absolute',
            top: '0', left: '0',
            width: '100%',
            height: '100%'
        });

        editContainer.appendChild(imgEl);                         // 将图片添加到编辑容器中
        editContainer.appendChild(canvas);                      // 将画布添加到编辑容器中

        const rightCol = document.createElement('div');            // 创建右侧列元素
        // 设置右侧列样式
        Object.assign(rightCol.style, {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            height: '100%'
        });

        const resultContainer = document.createElement('div');        // 创建结果容器元素
        resultContainer.className = 'ac-result-box';                   // 设置结果容器类名

        const resultImg = document.createElement('img');                // 创建结果图片元素
        Object.assign(resultImg.style, {
            maxWidth: '100%',
            maxHeight: '100%',
            display: 'none' });
        resultContainer.appendChild(resultImg);                        // 将结果图片添加到结果容器中

        const dlBtn = document.createElement('button');                // 创建保存按钮元素
        dlBtn.className = 'ac-btn-save';                               // 设置保存按钮类名
        dlBtn.innerText = '💾 保存图片';                               // 设置保存按钮文本
        dlBtn.style.display = 'none';                                  // 设置保存按钮显示为无

        rightCol.appendChild(resultContainer);                         // 将结果容器添加到右侧列中
        rightCol.appendChild(dlBtn);                                   // 将保存按钮添加到右侧列中

        workspace.appendChild(editContainer);                         // 将编辑容器添加到工作区中
        workspace.appendChild(rightCol);                              // 将右侧列添加到工作区中

        editorUI.appendChild(toolbar);                                 // 将工具栏添加到编辑器UI中
        editorUI.appendChild(workspace);                               // 将工作区添加到编辑器UI中
        editorUI.appendChild(bottomBar);                               // 将底部栏添加到编辑器UI中
        (document.body || document.documentElement).appendChild(editorUI); // 将编辑器UI添加到页面中

        // 图片加载完成后设置画布宽度和高度
        imgEl.onload = () => {
            canvas.width = imgEl.naturalWidth;                          // 设置画布宽度为图片自然宽度
            canvas.height = imgEl.naturalHeight;                         // 设置画布高度为图片自然高度
            ctx = canvas.getContext('2d');                              // 获取画布上下文
        };

        const btnFg = document.getElementById('mode-fg');                // 获取前景模式按钮元素
        const btnBg = document.getElementById('mode-bg');                // 获取背景模式按钮元素
        const btnInpaint = document.getElementById('mode-inpaint');      // 获取框选去字模式按钮元素
        const chkLama = document.getElementById('chk-lama');            // 获取LaMa智能去字复选框元素
        const btnRun = document.getElementById('btn-run');              // 获取生成结果按钮元素
        const btnUndo = document.getElementById('btn-undo');            // 获取撤销按钮元素
        const btnClose = document.getElementById('btn-close');          // 获取关闭按钮元素
        // LaMa智能去字复选框事件
        chkLama.onchange = (e) => {
            useLama = e.target.checked;                                // 设置使用LaMa为复选框的选中状态
        };

        // 更新模式UI
        function updateModeUI() {
            // 移除所有模式按钮的激活状态
            [btnFg, btnBg, btnInpaint].forEach(btn => {
                btn.classList.remove('active-fg', 'active-bg', 'active-inpaint'); // 移除前景模式按钮的激活状态
            });
            // 根据绘制模式设置模式按钮的激活状态
            if (drawMode === 'fg') {                                         // 如果绘制模式为前景
                btnFg.classList.add('active-fg');                         // 添加前景模式按钮的激活状态
                canvas.style.cursor = 'crosshair';                      // 设置画布光标为十字线
            } else if (drawMode === 'bg') {                                // 如果绘制模式为背景
                btnBg.classList.add('active-bg');                         // 添加背景模式按钮的激活状态
                canvas.style.cursor = 'not-allowed';                      // 设置画布光标为不允许
            } else if (drawMode === 'inpaint') {                          // 如果绘制模式为框选去字
                btnInpaint.classList.add('active-inpaint');                // 添加框选去字模式按钮的激活状态
                canvas.style.cursor = 'cell';                             // 设置画布光标为单元格
            }
        }
        updateModeUI();                                            // 更新模式UI

        btnFg.onclick = () => { drawMode = 'fg'; updateModeUI(); };           // 前景模式按钮点击事件
        btnBg.onclick = () => { drawMode = 'bg'; updateModeUI(); };           // 背景模式按钮点击事件
        btnInpaint.onclick = () => { drawMode = 'inpaint'; updateModeUI(); }; // 框选去字模式按钮点击事件

        // 生成结果按钮点击事件
        btnRun.onclick = async () => {
            if (!currentImgBlob) return;                                // 如果当前图片Blob为空，则返回
            const originalText = btnRun.innerText;                      // 设置生成结果按钮文本为原始文本
            btnRun.innerText = '⏳ 计算中...';                           // 设置生成结果按钮文本为计算中...
            btnRun.disabled = true;                                      // 设置生成结果按钮为禁用
            btnRun.classList.add('ac-disabled');                         // 添加生成结果按钮的禁用状态

            // 设置选项
            const options = {
                use_lama: useLama,                                    // 设置使用LaMa为useLama
                method: 'grabcut'                                      // 设置方法为grabcut
            };

            const fd = new FormData();                                // 创建FormData对象
            fd.append('image', currentImgBlob, 'src.png');             // 添加图片到FormData对象
            fd.append('corrections', JSON.stringify(strokes));         // 添加绘制路径到FormData对象
            fd.append('options', JSON.stringify(options));             // 添加选项到FormData对象

            // 发送请求
            try {
                // 发送请求到后端处理图片
                const r = await fetch('http://127.0.0.1:5000/process', {
                    method: 'POST',   // 发送POST请求
                    body: fd         // 发送FormData对象
                });
                if(!r.ok) throw new Error("Server error");          // 如果请求失败，则抛出错误
                const resBlob = await r.blob();                      // 获取响应Blob
                const resUrl = URL.createObjectURL(resBlob);         // 创建响应URL
                resultImg.src = resUrl;                              // 设置结果图片源为响应URL
                resultImg.style.display = 'block';                    // 设置结果图片显示为块级
                dlBtn.style.display = 'block';                        // 设置保存按钮显示为块级
                // 保存按钮点击事件
                dlBtn.onclick = () => {
                    const a = document.createElement('a');             // 创建a元素
                    a.href = resUrl;                                    // 设置a元素href为响应URL
                    a.download = 'cutout.png';                          // 设置a元素download为cutout.png
                    a.click();                                          // 点击a元素
                };
            } catch(e) {                                              // 捕获错误
                alert("处理失败，请检查后端是否开启");                      // 弹出错误信息
            }
            finally {
                btnRun.innerText = originalText;                  // 设置生成结果按钮文本为原始文本
                btnRun.disabled = false;                          // 设置生成结果按钮为启用
                btnRun.classList.remove('ac-disabled');             // 移除生成结果按钮的禁用状态
            }
        };

        // 撤销按钮点击事件
        btnUndo.onclick = () => {
            strokes.pop();                                      // 删除最后一个绘制路径
            redrawCanvas();                                      // 重新绘制画布
        };

        // 关闭按钮点击事件
        btnClose.onclick = () => {
            editorUI.remove();                                    // 移除编辑器UI
            ball.style.display = 'flex';                          // 设置悬浮球显示为块级
            canvas = null; ctx = null;                            // 设置画布为空
        };

        canvas.oncontextmenu = (e) => e.preventDefault();        // 阻止画布右键事件

        // 画布鼠标按下事件
        canvas.onmousedown = (e) => {
            if (e.button !== 0) return;                          // 如果不是左键，则返回
            e.preventDefault();                                  // 阻止默认事件
            isDrawing = true;                                     // 设置为正在绘制

            if (drawMode === 'inpaint') {                        // 如果绘制模式为框选去字
                rectStart = getMousePos(e);                      // 设置框选起始点
                rectCurrent = rectStart;                          // 设置框选当前点
            } else {
                addPoint(e);                                      // 添加绘制点
            }
        };

        // 画布鼠标移动事件
        window.addEventListener('mousemove', (e) => {
            if (!isDrawing) return;                              // 如果不是正在绘制，则返回
            e.preventDefault();                                  // 阻止默认事件

            if (drawMode === 'inpaint') {
                rectCurrent = getMousePos(e);                      // 设置框选当前点
                redrawCanvas();                                      // 重新绘制画布
            } else {
                addPoint(e);                                      // 添加绘制点
            }
        });

        window.addEventListener('mouseup', () => {
            if (isDrawing && drawMode === 'inpaint' && rectStart && rectCurrent) { // 如果正在绘制且绘制模式为框选去字且框选起始点和框选当前点不为空
                // 添加绘制路径
                strokes.push({
                    type: 'inpaint',                              // 设置绘制模式为框选去字
                    shape: 'rect',                                // 设置绘制形状为矩形
                    points: [rectStart, rectCurrent]              // 设置绘制点为框选起始点和框选当前点
                });
                rectStart = null; rectCurrent = null;              // 设置框选起始点和框选当前点为空
                redrawCanvas();                                    // 重新绘制画布
            }
            isDrawing = false;                                     // 设置为未正在绘制
            currentStroke = null;                                  // 设置当前绘制路径为空
        });

        // 获取鼠标位置
        function getMousePos(e) {
            const rect = canvas.getBoundingClientRect();              // 获取画布边界矩形
            const scaleX = canvas.width / rect.width;                // 计算水平缩放比例
            const scaleY = canvas.height / rect.height;              // 计算垂直缩放比例
            return [
                Math.round((e.clientX - rect.left) * scaleX),      // 计算鼠标X坐标
                Math.round((e.clientY - rect.top) * scaleY)        // 计算鼠标Y坐标
            ];
        }

        // 添加绘制点到当前绘制路径
        function addPoint(e) {
            const pos = getMousePos(e);                                          // 获取鼠标位置
            if (!currentStroke) {                                               // 如果当前绘制路径为空
                // 创建当前绘制路径
                currentStroke = {
                    type: drawMode,
                    shape: 'line',
                    points: []
                };
                strokes.push(currentStroke);                                     // 添加当前绘制路径到绘制路径数组
            }
            currentStroke.points.push(pos);                                       // 添加鼠标位置到当前绘制路径
            redrawCanvas();                                                       // 重新绘制画布
        }

        // 重新绘制画布
        function redrawCanvas() {
            if (!ctx) return;                                        // 如果画布上下文为空，则返回
            ctx.clearRect(0, 0, canvas.width, canvas.height);         // 清除画布

            // 绘制所有绘制路径
            strokes.forEach(s => {
                ctx.beginPath();                                    // 开始绘制路径
                if (s.type === 'fg') ctx.strokeStyle = 'rgba(46, 213, 115, 0.6)';       // 设置前景颜色
                else if (s.type === 'bg') ctx.strokeStyle = 'rgba(255, 71, 87, 0.6)';    // 设置背景颜色
                else if (s.type === 'inpaint') {                                    // 如果绘制模式为框选去字
                    ctx.fillStyle = 'rgba(30, 144, 255, 0.4)';                       // 设置框选去字填充颜色
                    ctx.strokeStyle = 'rgba(30, 144, 255, 0.8)';                     // 设置框选去字颜色
                }

                 // 如果绘制形状为矩形
                if (s.shape === 'rect') {
                    const w = s.points[1][0] - s.points[0][0];                        // 计算矩形宽度
                    const h = s.points[1][1] - s.points[0][1];                        // 计算矩形高度
                    ctx.fillRect(s.points[0][0], s.points[0][1], w, h);                // 绘制矩形
                    ctx.strokeRect(s.points[0][0], s.points[0][1], w, h);             // 绘制矩形边框
                } else {
                    ctx.lineCap = 'round';                                         // 设置线帽为圆角
                    ctx.lineJoin = 'round';                                         // 设置线连接为圆角
                    ctx.lineWidth = 15;                                             // 设置线宽（画笔大小）为15
                    // 如果绘制点不为空
                    if (s.points.length > 0) {
                        ctx.moveTo(s.points[0][0], s.points[0][1]);                  // 移动到绘制点
                        // 如果绘制点为1，则绘制点
                        if (s.points.length === 1)
                            ctx.lineTo(s.points[0][0], s.points[0][1]);             // 绘制点
                        else
                            s.points.forEach(p => ctx.lineTo(p[0], p[1]));            // 绘制点
                        ctx.stroke();                                             // 绘制路径
                    }
                }
            });

            // 如果正在绘制且绘制模式为框选去字且框选起始点和框选当前点不为空
            if (isDrawing && drawMode === 'inpaint' && rectStart && rectCurrent) {
                const w = rectCurrent[0] - rectStart[0];                        // 计算框选宽度
                const h = rectCurrent[1] - rectStart[1];                        // 计算框选高度
                ctx.fillStyle = 'rgba(30, 144, 255, 0.4)';                      // 设置框选填充颜色
                ctx.strokeStyle = 'rgba(30, 144, 255, 0.8)';                    // 设置框选颜色
                ctx.lineWidth = 2;                                             // 设置线宽
                ctx.fillRect(rectStart[0], rectStart[1], w, h);                 // 绘制矩形
                ctx.strokeRect(rectStart[0], rectStart[1], w, h);              // 绘制矩形边框
            }
        }
    }
})();