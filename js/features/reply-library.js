// ============================================================
// 贴纸自动压缩功能 - 完整版
// 包含：图片压缩、批量上传、配置管理、内存优化
// ============================================================

// ============================================================
// 1. 图片压缩核心函数
// ============================================================

/**
 * 压缩单张图片
 * @param {File} file - 图片文件
 * @param {Object} options - 压缩选项
 * @param {number} options.maxWidth - 最大宽度 (默认 200)
 * @param {number} options.maxHeight - 最大高度 (默认 200)
 * @param {number} options.quality - 图片质量 0-1 (默认 0.7)
 * @param {string} options.format - 输出格式 'webp'|'jpeg'|'png' (默认 'webp')
 * @returns {Promise<string>} 压缩后的 base64
 */
function compressStickerImage(file, options = {}) {
    const {
        maxWidth = 200,
        maxHeight = 200,
        quality = 0.7,
        format = 'webp'
    } = options;

    return new Promise((resolve, reject) => {
        // 非图片文件直接返回
        if (!file.type || !file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                try {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // 保持宽高比缩放
                    if (width > maxWidth || height > maxHeight) {
                        const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
                        width = Math.max(1, Math.round(width * ratio));
                        height = Math.max(1, Math.round(height * ratio));
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, width, height);

                    const mimeType = format === 'webp' ? 'image/webp' :
                                    format === 'jpeg' ? 'image/jpeg' : 'image/png';
                    const compressedData = canvas.toDataURL(mimeType, quality);

                    // 内存清理
                    canvas.width = 0;
                    canvas.height = 0;

                    resolve(compressedData);
                } catch (err) {
                    // 压缩失败时回退原始数据
                    console.warn('压缩失败，使用原始图片:', err);
                    const fallbackReader = new FileReader();
                    fallbackReader.onload = () => resolve(fallbackReader.result);
                    fallbackReader.onerror = reject;
                    fallbackReader.readAsDataURL(file);
                }
            };
            img.onerror = function() {
                const fallbackReader = new FileReader();
                fallbackReader.onload = () => resolve(fallbackReader.result);
                fallbackReader.onerror = reject;
                fallbackReader.readAsDataURL(file);
            };
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * 批量压缩图片
 * @param {FileList|File[]} files - 文件列表
 * @param {Function} onProgress - 进度回调 (current, total)
 * @param {Object} options - 压缩选项
 * @returns {Promise<Array<{data: string, name: string, size: number}>>}
 */
async function compressStickerImages(files, onProgress = null, options = {}) {
    const results = [];
    const total = files.length;

    for (let i = 0; i < total; i++) {
        try {
            const file = files[i];
            const compressed = await compressStickerImage(file, options);
            results.push({
                data: compressed,
                name: file.name || `sticker_${i}`,
                size: compressed.length
            });
            if (onProgress) {
                onProgress(i + 1, total);
            }
        } catch (err) {
            console.error('压缩贴纸失败:', err);
            // 尝试读取原始文件
            try {
                const data = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(files[i]);
                });
                results.push({
                    data: data,
                    name: files[i].name || `sticker_${i}`,
                    size: data.length
                });
            } catch {
                // 完全失败则跳过
            }
        }
    }
    return results;
}

// ============================================================
// 2. 压缩配置管理
// ============================================================

const COMPRESS_CONFIG_KEY = 'stickerCompressConfig';

function getCompressConfig() {
    try {
        const raw = localStorage.getItem(COMPRESS_CONFIG_KEY);
        if (raw) {
            const config = JSON.parse(raw);
            return {
                maxWidth: config.maxWidth || 200,
                maxHeight: config.maxHeight || 200,
                quality: config.quality || 0.7,
                format: config.format || 'webp'
            };
        }
    } catch {}
    return { maxWidth: 200, maxHeight: 200, quality: 0.7, format: 'webp' };
}

function saveCompressConfig(config) {
    localStorage.setItem(COMPRESS_CONFIG_KEY, JSON.stringify(config));
}

// ============================================================
// 3. 渲染压缩设置面板
// ============================================================

function renderCompressSettings(container) {
    if (!container) return;
    const config = getCompressConfig();

    // 检查是否已存在，避免重复渲染
    if (container.querySelector('.compress-settings-wrap')) return;

    const wrap = document.createElement('div');
    wrap.className = 'compress-settings-wrap';
    wrap.style.cssText = `
        padding: 16px 18px;
        border: 1.5px solid var(--border-color);
        border-radius: 14px;
        margin-top: 14px;
        background: var(--secondary-bg);
    `;
    wrap.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
            <span style="font-size:16px;">🖼️</span>
            <span style="font-size:14px;font-weight:600;color:var(--text-primary);">贴纸压缩设置</span>
            <span style="font-size:11px;color:var(--text-secondary);margin-left:auto;">上传时自动压缩</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div>
                <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:3px;">最大宽度 (px)</label>
                <input type="number" id="compress-max-width" value="${config.maxWidth}" min="32" max="800"
                       style="width:100%;padding:6px 10px;border:1.5px solid var(--border-color);border-radius:8px;background:var(--primary-bg);color:var(--text-primary);font-size:13px;box-sizing:border-box;">
            </div>
            <div>
                <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:3px;">最大高度 (px)</label>
                <input type="number" id="compress-max-height" value="${config.maxHeight}" min="32" max="800"
                       style="width:100%;padding:6px 10px;border:1.5px solid var(--border-color);border-radius:8px;background:var(--primary-bg);color:var(--text-primary);font-size:13px;box-sizing:border-box;">
            </div>
            <div>
                <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:3px;">图片质量: <span id="compress-quality-label">${config.quality}</span></label>
                <input type="range" id="compress-quality" min="0.1" max="1.0" step="0.05" value="${config.quality}"
                       style="width:100%;">
            </div>
            <div>
                <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:3px;">输出格式</label>
                <select id="compress-format"
                        style="width:100%;padding:6px 10px;border:1.5px solid var(--border-color);border-radius:8px;background:var(--primary-bg);color:var(--text-primary);font-size:13px;">
                    <option value="webp" ${config.format === 'webp' ? 'selected' : ''}>WebP (推荐)</option>
                    <option value="jpeg" ${config.format === 'jpeg' ? 'selected' : ''}>JPEG</option>
                    <option value="png" ${config.format === 'png' ? 'selected' : ''}>PNG</option>
                </select>
            </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;margin-top:12px;">
            <button id="save-compress-config" style="padding:7px 18px;border:none;border-radius:8px;background:var(--accent-color);color:#fff;cursor:pointer;font-size:13px;font-weight:600;transition:opacity 0.15s;">
                保存设置
            </button>
            <span id="compress-save-status" style="font-size:12px;color:var(--text-secondary);"></span>
            <button id="reset-compress-config" style="padding:7px 14px;border:1.5px solid var(--border-color);border-radius:8px;background:transparent;color:var(--text-secondary);cursor:pointer;font-size:12px;transition:all 0.15s;">
                重置默认
            </button>
        </div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:8px;opacity:0.6;">
            💡 建议 200x200 以下，WebP 格式可获得最佳压缩效果
        </div>
    `;

    container.appendChild(wrap);

    // 质量滑块联动
    const qualitySlider = wrap.querySelector('#compress-quality');
    const qualityLabel = wrap.querySelector('#compress-quality-label');
    qualitySlider.addEventListener('input', () => {
        qualityLabel.textContent = parseFloat(qualitySlider.value).toFixed(2);
    });

    // 保存配置
    wrap.querySelector('#save-compress-config').addEventListener('click', () => {
        const newConfig = {
            maxWidth: Math.max(32, parseInt(wrap.querySelector('#compress-max-width').value) || 200),
            maxHeight: Math.max(32, parseInt(wrap.querySelector('#compress-max-height').value) || 200),
            quality: Math.min(1, Math.max(0.1, parseFloat(qualitySlider.value) || 0.7)),
            format: wrap.querySelector('#compress-format').value
        };
        saveCompressConfig(newConfig);
        const status = wrap.querySelector('#compress-save-status');
        status.textContent = '✅ 已保存';
        status.style.color = '#4CAF50';
        setTimeout(() => { status.textContent = ''; }, 2000);
        showNotification?.('压缩设置已保存', 'success');
    });

    // 重置默认
    wrap.querySelector('#reset-compress-config').addEventListener('click', () => {
        const defaultConfig = { maxWidth: 200, maxHeight: 200, quality: 0.7, format: 'webp' };
        saveCompressConfig(defaultConfig);
        // 更新UI
        wrap.querySelector('#compress-max-width').value = defaultConfig.maxWidth;
        wrap.querySelector('#compress-max-height').value = defaultConfig.maxHeight;
        qualitySlider.value = defaultConfig.quality;
        qualityLabel.textContent = defaultConfig.quality;
        wrap.querySelector('#compress-format').value = defaultConfig.format;
        const status = wrap.querySelector('#compress-save-status');
        status.textContent = '↻ 已重置';
        status.style.color = '#FFA500';
        setTimeout(() => { status.textContent = ''; }, 2000);
        showNotification?.('已重置为默认设置', 'info');
    });
}

// ============================================================
// 4. 贴纸上传处理（含压缩）
// ============================================================

let _stickerUploading = false;

/**
 * 处理贴纸上传 - 自动压缩并添加到库
 */
async function handleStickerUpload(files) {
    if (!files || files.length === 0) return;
    if (_stickerUploading) {
        showNotification?.('正在处理中，请稍候...', 'warning');
        return;
    }

    _stickerUploading = true;
    const config = getCompressConfig();

    // 显示加载状态
    showNotification?.('⏳ 正在压缩贴纸...', 'info');

    try {
        const results = await compressStickerImages(files, (current, total) => {
            if (current % 3 === 0 || current === total) {
                showNotification?.(`⏳ 压缩进度: ${current}/${total}`, 'info');
            }
        }, config);

        // 添加到贴纸库
        let addedCount = 0;
        const existingSet = new Set(stickerLibrary || []);

        results.forEach(({ data }) => {
            if (data && !existingSet.has(data)) {
                stickerLibrary.push(data);
                existingSet.add(data);
                addedCount++;
            }
        });

        if (addedCount > 0) {
            throttledSaveData?.();
            renderReplyLibrary?.();
            showNotification?.(`✅ 成功添加 ${addedCount} 个压缩贴纸`, 'success');
        } else {
            showNotification?.('所有贴纸已存在，无新增', 'info');
        }
    } catch (err) {
        console.error('贴纸上传处理失败:', err);
        showNotification?.('贴纸处理失败，请重试', 'error');
    } finally {
        _stickerUploading = false;
    }
}

// ============================================================
// 5. 增强的 _renderStickerTab 函数
// ============================================================

/**
 * 渲染贴纸列表 - 显示压缩信息和操作按钮
 */
function _renderStickerTab(list, itemsToRender) {
    if (!list) return;

    const disabledSet = _getDisabledStickerItemsSet ? _getDisabledStickerItemsSet() : new Set();

    if (!itemsToRender || itemsToRender.length === 0) {
        list.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;color:var(--text-secondary);opacity:0.7;grid-column:1/-1;">
                <div style="width:64px;height:64px;background:var(--secondary-bg);border-radius:18px;display:flex;align-items:center;justify-content:center;margin-bottom:16px;font-size:28px;box-shadow:var(--shadow);">
                    🖼️
                </div>
                <p style="font-size:14px;font-weight:500;text-align:center;line-height:1.7;margin:0;">
                    暂无贴纸
                </p>
                <p style="font-size:12px;opacity:0.6;margin:4px 0 0 0;">
                    点击「新增」上传贴纸（自动压缩）
                </p>
            </div>
        `;
        return;
    }

    const fragment = document.createDocumentFragment();
    const isBatchMode = _batchModeActive || false;

    itemsToRender.forEach((item, index) => {
        const isDisabled = disabledSet.has(item);
        const isSelected = isBatchMode && (_batchSelectedIndices || new Set()).has(index);

        const div = document.createElement('div');
        div.style.cssText = `
            position: relative;
            border-radius: 14px;
            overflow: hidden;
            cursor: ${isBatchMode ? 'pointer' : 'default'};
            border: 2.5px solid ${isSelected ? 'var(--accent-color)' : isDisabled ? 'var(--border-color)' : 'transparent'};
            opacity: ${isDisabled ? 0.45 : 1};
            transition: all 0.2s ease;
            background: var(--secondary-bg);
            aspect-ratio: 1 / 1;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        `;
        div.className = `sticker-item${isDisabled ? ' sticker-disabled' : ''}${isSelected ? ' sticker-batch-selected' : ''}`;

        // 图片
        const img = document.createElement('img');
        img.src = item;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: contain;
            border-radius: 12px;
            pointer-events: none;
            user-select: none;
            background: var(--primary-bg);
        `;
        img.alt = `贴纸 ${index + 1}`;

        // 批量选择勾选框
        const checkMark = document.createElement('div');
        checkMark.style.cssText = `
            position: absolute;
            top: 6px;
            right: 6px;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: ${isSelected ? 'var(--accent-color)' : 'rgba(0,0,0,0.5)'};
            color: #fff;
            display: ${isBatchMode ? 'flex' : 'none'};
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 700;
            transition: all 0.2s;
            border: 2px solid ${isSelected ? 'var(--accent-color)' : 'rgba(255,255,255,0.2)'};
            backdrop-filter: blur(2px);
        `;
        checkMark.textContent = isSelected ? '✓' : '';

        // 删除按钮
        const deleteBtn = document.createElement('div');
        deleteBtn.style.cssText = `
            position: absolute;
            bottom: 6px;
            right: 6px;
            width: 26px;
            height: 26px;
            border-radius: 50%;
            background: rgba(0,0,0,0.65);
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.2s ease;
            border: none;
            backdrop-filter: blur(4px);
            font-weight: 300;
            line-height: 1;
        `;
        deleteBtn.textContent = '×';

        // 大小标签
        const sizeLabel = document.createElement('div');
        const approxSize = Math.round(item.length * 0.75 / 1024);
        sizeLabel.style.cssText = `
            position: absolute;
            bottom: 6px;
            left: 6px;
            font-size: 9px;
            color: rgba(255,255,255,0.9);
            background: rgba(0,0,0,0.55);
            padding: 2px 8px;
            border-radius: 12px;
            backdrop-filter: blur(4px);
            opacity: 0;
            transition: opacity 0.2s;
            pointer-events: none;
            font-family: monospace;
            letter-spacing: 0.3px;
        `;
        sizeLabel.textContent = approxSize < 1 ? '<1KB' : `${approxSize}KB`;

        // 索引标签（批量模式下显示）
        if (isBatchMode) {
            const idxLabel = document.createElement('div');
            idxLabel.style.cssText = `
                position: absolute;
                top: 6px;
                left: 6px;
                font-size: 9px;
                color: rgba(255,255,255,0.6);
                background: rgba(0,0,0,0.4);
                padding: 1px 7px;
                border-radius: 10px;
                backdrop-filter: blur(2px);
                font-family: monospace;
            `;
            idxLabel.textContent = `#${index + 1}`;
            div.appendChild(idxLabel);
        }

        div.appendChild(img);
        div.appendChild(checkMark);
        div.appendChild(deleteBtn);
        div.appendChild(sizeLabel);

        // 悬停效果
        div.addEventListener('mouseenter', () => {
            deleteBtn.style.opacity = '1';
            sizeLabel.style.opacity = '1';
        });
        div.addEventListener('mouseleave', () => {
            if (!isBatchMode) {
                deleteBtn.style.opacity = '0';
                sizeLabel.style.opacity = '0';
            }
        });

        // 点击 - 批量选择
        div.addEventListener('click', (e) => {
            if (!isBatchMode) return;
            if (e.target.closest('.sticker-delete-btn')) return;
            if (typeof _batchSelectedIndices === 'undefined') return;

            if (_batchSelectedIndices.has(index)) {
                _batchSelectedIndices.delete(index);
            } else {
                _batchSelectedIndices.add(index);
            }
            renderReplyLibrary?.();
        });

        // 删除
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!confirm(`确定删除贴纸 #${index + 1} 吗？`)) return;

            if (isDisabled) {
                disabledSet.delete(item);
                if (typeof _saveDisabledStickerItemsSet === 'function') {
                    _saveDisabledStickerItemsSet(disabledSet);
                }
            }
            stickerLibrary.splice(index, 1);
            if (typeof _batchSelectedIndices !== 'undefined') {
                _batchSelectedIndices.clear();
            }
            throttledSaveData?.();
            renderReplyLibrary?.();
            showNotification?.('已删除贴纸', 'success');
        });

        fragment.appendChild(div);
    });

    list.appendChild(fragment);
}

// ============================================================
// 6. 初始化贴纸上传监听
// ============================================================

function initStickerUploadListener() {
    const stickerInput = document.getElementById('sticker-file-input');
    if (!stickerInput) {
        // 如果没有找到，创建一个隐藏的input
        const input = document.createElement('input');
        input.type = 'file';
        input.id = 'sticker-file-input';
        input.accept = 'image/*';
        input.multiple = true;
        input.style.display = 'none';
        document.body.appendChild(input);
        return initStickerUploadListener();
    }

    // 移除已有监听器
    const newInput = stickerInput.cloneNode(true);
    stickerInput.parentNode.replaceChild(newInput, stickerInput);

    newInput.addEventListener('change', function(e) {
        const files = e.target.files;
        this.value = ''; // 重置
        if (files && files.length > 0) {
            handleStickerUpload(files);
        }
    });

    // 如果"新增"按钮存在，绑定点击触发上传
    const addBtn = document.getElementById('add-custom-reply');
    if (addBtn) {
        // 保存原始点击事件
        const originalClick = addBtn.onclick;
        addBtn.addEventListener('click', function(e) {
            // 检查当前是否为贴纸tab
            if (currentSubTab === 'stickers') {
                e.preventDefault();
                e.stopPropagation();
                document.getElementById('sticker-file-input')?.click();
                return false;
            }
            // 否则执行原有逻辑
            if (typeof originalClick === 'function') {
                originalClick.call(this, e);
            }
        });
    }
}

// ============================================================
// 7. 内存优化：定期清理未使用的图片数据
// ============================================================

function optimizeStickerMemory() {
    // 清理重复的贴纸数据
    if (stickerLibrary && stickerLibrary.length > 0) {
        const unique = [];
        const seen = new Set();
        for (const item of stickerLibrary) {
            // 使用短哈希去重（取前100字符作为标识）
            const key = item.substring(0, 100);
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(item);
            }
        }
        if (unique.length < stickerLibrary.length) {
            const removed = stickerLibrary.length - unique.length;
            stickerLibrary = unique;
            throttledSaveData?.();
            console.log(`🧹 内存优化: 清理了 ${removed} 个重复贴纸`);
        }
    }

    // 清理过大的贴纸（超过500KB的重新压缩）
    // 这个功能可选，为了不影响性能，暂时不自动执行
}

// ============================================================
// 8. 导出到全局
// ============================================================

// 将核心函数暴露到全局
window.compressStickerImage = compressStickerImage;
window.compressStickerImages = compressStickerImages;
window.getCompressConfig = getCompressConfig;
window.saveCompressConfig = saveCompressConfig;
window.renderCompressSettings = renderCompressSettings;
window.handleStickerUpload = handleStickerUpload;
window.initStickerUploadListener = initStickerUploadListener;
window.optimizeStickerMemory = optimizeStickerMemory;
window._renderStickerTab = _renderStickerTab;

console.log('✅ 贴纸自动压缩功能已加载 (完整版)');
console.log('📦 当前压缩配置:', getCompressConfig());

// ============================================================
// 9. 页面加载时自动初始化
// ============================================================

// 等待DOM加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            initStickerUploadListener();
            // 如果有设置面板容器，渲染压缩设置
            const settingsContainer = document.querySelector('.settings-panel, #settings-container, .settings-content');
            if (settingsContainer) {
                renderCompressSettings(settingsContainer);
            }
        }, 500);
    });
} else {
    setTimeout(() => {
        initStickerUploadListener();
        const settingsContainer = document.querySelector('.settings-panel, #settings-container, .settings-content');
        if (settingsContainer) {
            renderCompressSettings(settingsContainer);
        }
    }, 500);
}
