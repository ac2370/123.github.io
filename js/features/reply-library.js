// ============================================================
// 贴纸自动压缩功能 - 完整版（颜色修复）
// ============================================================

// ============================================================
// 1. 图片压缩核心函数
// ============================================================

function compressStickerImage(file, options = {}) {
    const {
        maxWidth = 200,
        maxHeight = 200,
        quality = 0.7,
        format = 'webp'
    } = options;

    return new Promise((resolve, reject) => {
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

                    canvas.width = 0;
                    canvas.height = 0;

                    resolve(compressedData);
                } catch (err) {
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
                // 跳过
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
// 3. 渲染压缩设置面板（颜色修复）
// ============================================================

function renderCompressSettings(container) {
    if (!container) return;
    if (container.querySelector('.compress-settings-wrap')) return;

    const config = getCompressConfig();
    const wrap = document.createElement('div');
    wrap.className = 'compress-settings-wrap';
    
    // 使用内联样式 + CSS 变量，避免覆盖全局
    wrap.style.cssText = `
        padding: 16px 18px;
        border: 1.5px solid var(--border-color, #e0e0e0);
        border-radius: 14px;
        margin-top: 14px;
        background: var(--secondary-bg, #f5f5f5);
        color: var(--text-primary, #333);
    `;
    
    wrap.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;color:var(--text-primary, #333);">
            <span style="font-size:16px;">🖼️</span>
            <span style="font-size:14px;font-weight:600;">贴纸压缩设置</span>
            <span style="font-size:11px;color:var(--text-secondary, #888);margin-left:auto;">上传时自动压缩</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div>
                <label style="font-size:11px;color:var(--text-secondary, #888);display:block;margin-bottom:3px;">最大宽度 (px)</label>
                <input type="number" id="compress-max-width" value="${config.maxWidth}" min="32" max="800"
                       style="width:100%;padding:6px 10px;border:1.5px solid var(--border-color, #e0e0e0);border-radius:8px;background:var(--primary-bg, #fff);color:var(--text-primary, #333);font-size:13px;box-sizing:border-box;">
            </div>
            <div>
                <label style="font-size:11px;color:var(--text-secondary, #888);display:block;margin-bottom:3px;">最大高度 (px)</label>
                <input type="number" id="compress-max-height" value="${config.maxHeight}" min="32" max="800"
                       style="width:100%;padding:6px 10px;border:1.5px solid var(--border-color, #e0e0e0);border-radius:8px;background:var(--primary-bg, #fff);color:var(--text-primary, #333);font-size:13px;box-sizing:border-box;">
            </div>
            <div>
                <label style="font-size:11px;color:var(--text-secondary, #888);display:block;margin-bottom:3px;">图片质量: <span id="compress-quality-label" style="color:var(--text-primary, #333);">${config.quality}</span></label>
                <input type="range" id="compress-quality" min="0.1" max="1.0" step="0.05" value="${config.quality}"
                       style="width:100%;accent-color:var(--accent-color, #c9a87c);">
            </div>
            <div>
                <label style="font-size:11px;color:var(--text-secondary, #888);display:block;margin-bottom:3px;">输出格式</label>
                <select id="compress-format"
                        style="width:100%;padding:6px 10px;border:1.5px solid var(--border-color, #e0e0e0);border-radius:8px;background:var(--primary-bg, #fff);color:var(--text-primary, #333);font-size:13px;">
                    <option value="webp" ${config.format === 'webp' ? 'selected' : ''}>WebP (推荐)</option>
                    <option value="jpeg" ${config.format === 'jpeg' ? 'selected' : ''}>JPEG</option>
                    <option value="png" ${config.format === 'png' ? 'selected' : ''}>PNG</option>
                </select>
            </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;margin-top:12px;">
            <button id="save-compress-config" style="padding:7px 18px;border:none;border-radius:8px;background:var(--accent-color, #c9a87c);color:#fff;cursor:pointer;font-size:13px;font-weight:600;transition:opacity 0.15s;">
                保存设置
            </button>
            <span id="compress-save-status" style="font-size:12px;color:var(--text-secondary, #888);"></span>
            <button id="reset-compress-config" style="padding:7px 14px;border:1.5px solid var(--border-color, #e0e0e0);border-radius:8px;background:transparent;color:var(--text-secondary, #888);cursor:pointer;font-size:12px;transition:all 0.15s;">
                重置默认
            </button>
        </div>
        <div style="font-size:11px;color:var(--text-secondary, #888);margin-top:8px;opacity:0.6;">
            💡 建议 200x200 以下，WebP 格式可获得最佳压缩效果
        </div>
    `;

    container.appendChild(wrap);

    const qualitySlider = wrap.querySelector('#compress-quality');
    const qualityLabel = wrap.querySelector('#compress-quality-label');
    qualitySlider.addEventListener('input', () => {
        qualityLabel.textContent = parseFloat(qualitySlider.value).toFixed(2);
    });

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
        if (typeof showNotification === 'function') {
            showNotification('压缩设置已保存', 'success');
        }
    });

    wrap.querySelector('#reset-compress-config').addEventListener('click', () => {
        const defaultConfig = { maxWidth: 200, maxHeight: 200, quality: 0.7, format: 'webp' };
        saveCompressConfig(defaultConfig);
        wrap.querySelector('#compress-max-width').value = defaultConfig.maxWidth;
        wrap.querySelector('#compress-max-height').value = defaultConfig.maxHeight;
        qualitySlider.value = defaultConfig.quality;
        qualityLabel.textContent = defaultConfig.quality;
        wrap.querySelector('#compress-format').value = defaultConfig.format;
        const status = wrap.querySelector('#compress-save-status');
        status.textContent = '↻ 已重置';
        status.style.color = '#FFA500';
        setTimeout(() => { status.textContent = ''; }, 2000);
        if (typeof showNotification === 'function') {
            showNotification('已重置为默认设置', 'info');
        }
    });
}

// ============================================================
// 4. 贴纸上传处理
// ============================================================

let _stickerUploading = false;

async function handleStickerUpload(files) {
    if (!files || files.length === 0) return;
    if (_stickerUploading) {
        if (typeof showNotification === 'function') {
            showNotification('正在处理中，请稍候...', 'warning');
        }
        return;
    }

    _stickerUploading = true;
    const config = getCompressConfig();

    if (typeof showNotification === 'function') {
        showNotification('⏳ 正在压缩贴纸...', 'info');
    }

    try {
        const results = await compressStickerImages(files, (current, total) => {
            if (current % 3 === 0 || current === total) {
                if (typeof showNotification === 'function') {
                    showNotification(`⏳ 压缩进度: ${current}/${total}`, 'info');
                }
            }
        }, config);

        let addedCount = 0;
        const existingSet = new Set(window.stickerLibrary || []);

        results.forEach(({ data }) => {
            if (data && !existingSet.has(data)) {
                window.stickerLibrary.push(data);
                existingSet.add(data);
                addedCount++;
            }
        });

        if (addedCount > 0) {
            if (typeof throttledSaveData === 'function') throttledSaveData();
            if (typeof renderReplyLibrary === 'function') renderReplyLibrary();
            if (typeof showNotification === 'function') {
                showNotification(`✅ 成功添加 ${addedCount} 个压缩贴纸`, 'success');
            }
        } else {
            if (typeof showNotification === 'function') {
                showNotification('所有贴纸已存在，无新增', 'info');
            }
        }
    } catch (err) {
        console.error('贴纸上传处理失败:', err);
        if (typeof showNotification === 'function') {
            showNotification('贴纸处理失败，请重试', 'error');
        }
    } finally {
        _stickerUploading = false;
    }
}

// ============================================================
// 5. _renderStickerTab 函数（颜色修复版 - 不覆盖全局样式）
// ============================================================

// 保存原始函数引用
const _originalRenderStickerTab = window._renderStickerTab || function() {};

function _renderStickerTab(list, itemsToRender) {
    if (!list) return;

    // 确保使用全局的 stickerLibrary
    const stickerLibrary = window.stickerLibrary || [];
    const disabledSet = window._getDisabledStickerItemsSet ? window._getDisabledStickerItemsSet() : new Set();

    if (!itemsToRender || itemsToRender.length === 0) {
        list.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;color:var(--text-secondary, #888);opacity:0.7;grid-column:1/-1;">
                <div style="width:64px;height:64px;background:var(--secondary-bg, #f5f5f5);border-radius:18px;display:flex;align-items:center;justify-content:center;margin-bottom:16px;font-size:28px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
                    🖼️
                </div>
                <p style="font-size:14px;font-weight:500;text-align:center;line-height:1.7;margin:0;color:var(--text-primary, #333);">
                    暂无贴纸
                </p>
                <p style="font-size:12px;opacity:0.6;margin:4px 0 0 0;color:var(--text-secondary, #888);">
                    点击「新增」上传贴纸（自动压缩）
                </p>
            </div>
        `;
        return;
    }

    const fragment = document.createDocumentFragment();
    const isBatchMode = window._batchModeActive || false;
    const batchSelectedIndices = window._batchSelectedIndices || new Set();

    itemsToRender.forEach((item, index) => {
        const isDisabled = disabledSet.has(item);
        const isSelected = isBatchMode && batchSelectedIndices.has(index);

        const div = document.createElement('div');
        // 使用 className 而不是 style.cssText 覆盖，避免破坏全局样式
        div.className = `sticker-item${isDisabled ? ' sticker-disabled' : ''}${isSelected ? ' sticker-batch-selected' : ''}`;
        // 只设置必要的样式，使用 CSS 变量
        div.style.cssText = `
            position: relative;
            border-radius: 14px;
            overflow: hidden;
            cursor: ${isBatchMode ? 'pointer' : 'default'};
            border: 2.5px solid ${isSelected ? 'var(--accent-color, #c9a87c)' : isDisabled ? 'var(--border-color, #e0e0e0)' : 'transparent'};
            opacity: ${isDisabled ? 0.45 : 1};
            transition: all 0.2s ease;
            background: var(--secondary-bg, #f5f5f5);
            aspect-ratio: 1 / 1;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        `;

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
            background: var(--primary-bg, #fff);
        `;
        img.alt = `贴纸 ${index + 1}`;
        img.setAttribute('draggable', 'false');

        const checkMark = document.createElement('div');
        checkMark.style.cssText = `
            position: absolute;
            top: 6px;
            right: 6px;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: ${isSelected ? 'var(--accent-color, #c9a87c)' : 'rgba(0,0,0,0.5)'};
            color: #fff;
            display: ${isBatchMode ? 'flex' : 'none'};
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 700;
            transition: all 0.2s;
            border: 2px solid ${isSelected ? 'var(--accent-color, #c9a87c)' : 'rgba(255,255,255,0.2)'};
            backdrop-filter: blur(2px);
            z-index: 2;
        `;
        checkMark.textContent = isSelected ? '✓' : '';

        const deleteBtn = document.createElement('div');
        deleteBtn.className = 'sticker-delete-btn';
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
            z-index: 2;
        `;
        deleteBtn.textContent = '×';

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
            z-index: 2;
        `;
        sizeLabel.textContent = approxSize < 1 ? '<1KB' : `${approxSize}KB`;

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
                z-index: 2;
            `;
            idxLabel.textContent = `#${index + 1}`;
            div.appendChild(idxLabel);
        }

        div.appendChild(img);
        div.appendChild(checkMark);
        div.appendChild(deleteBtn);
        div.appendChild(sizeLabel);

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

        div.addEventListener('click', (e) => {
            if (!isBatchMode) return;
            if (e.target.closest('.sticker-delete-btn')) return;
            if (typeof window._batchSelectedIndices === 'undefined') return;

            if (window._batchSelectedIndices.has(index)) {
                window._batchSelectedIndices.delete(index);
            } else {
                window._batchSelectedIndices.add(index);
            }
            if (typeof renderReplyLibrary === 'function') renderReplyLibrary();
        });

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!confirm(`确定删除贴纸 #${index + 1} 吗？`)) return;

            if (isDisabled && typeof window._saveDisabledStickerItemsSet === 'function') {
                disabledSet.delete(item);
                window._saveDisabledStickerItemsSet(disabledSet);
            }
            window.stickerLibrary.splice(index, 1);
            if (typeof window._batchSelectedIndices !== 'undefined') {
                window._batchSelectedIndices.clear();
            }
            if (typeof throttledSaveData === 'function') throttledSaveData();
            if (typeof renderReplyLibrary === 'function') renderReplyLibrary();
            if (typeof showNotification === 'function') {
                showNotification('已删除贴纸', 'success');
            }
        });

        fragment.appendChild(div);
    });

    list.appendChild(fragment);
}

// ============================================================
// 6. 初始化贴纸上传监听
// ============================================================

function initStickerUploadListener() {
    let stickerInput = document.getElementById('sticker-file-input');
    if (!stickerInput) {
        const input = document.createElement('input');
        input.type = 'file';
        input.id = 'sticker-file-input';
        input.accept = 'image/*';
        input.multiple = true;
        input.style.display = 'none';
        document.body.appendChild(input);
        stickerInput = input;
    }

    const newInput = stickerInput.cloneNode(true);
    stickerInput.parentNode.replaceChild(newInput, stickerInput);

    newInput.addEventListener('change', function(e) {
        const files = e.target.files;
        this.value = '';
        if (files && files.length > 0) {
            handleStickerUpload(files);
        }
    });

    // 绑定"新增"按钮
    const addBtn = document.getElementById('add-custom-reply');
    if (addBtn) {
        // 移除所有已有监听器
        const newAddBtn = addBtn.cloneNode(true);
        addBtn.parentNode.replaceChild(newAddBtn, addBtn);

        newAddBtn.addEventListener('click', function(e) {
            // 检查当前是否为贴纸tab
            if (typeof window.currentSubTab !== 'undefined' && window.currentSubTab === 'stickers') {
                e.preventDefault();
                e.stopPropagation();
                document.getElementById('sticker-file-input')?.click();
                return false;
            }
        });

        // 如果原来是"新增字卡"功能，保留原有逻辑
        // 这里不再覆盖原有逻辑，只是添加了贴纸上传的拦截
    }
}

// ============================================================
// 7. 导出到全局
// ============================================================

window.compressStickerImage = compressStickerImage;
window.compressStickerImages = compressStickerImages;
window.getCompressConfig = getCompressConfig;
window.saveCompressConfig = saveCompressConfig;
window.renderCompressSettings = renderCompressSettings;
window.handleStickerUpload = handleStickerUpload;
window.initStickerUploadListener = initStickerUploadListener;
window._renderStickerTab = _renderStickerTab;

console.log('✅ 贴纸自动压缩功能已加载 (颜色修复版)');

// ============================================================
// 8. 自动初始化
// ============================================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            initStickerUploadListener();
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
