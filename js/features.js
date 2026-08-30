// =============================================
// features.js - 完整功能模块（红包 + 表情包 + 群聊成员管理）
// =============================================

(function() {
    'use strict';

    // =============================================
    // 红包数据管理
    // =============================================
    var REDPACKET_KEY = 'redpacket_data';

    function _getRedpacketData() {
        try {
            return JSON.parse(localStorage.getItem(REDPACKET_KEY)) || { members: {}, myAmount: 0 };
        } catch {
            return { members: {}, myAmount: 0 };
        }
    }

    function _setRedpacketData(data) {
        localStorage.setItem(REDPACKET_KEY, JSON.stringify(data));
    }

    function _getGroupMemberList() {
        var members = [];
        try {
            var groupData = JSON.parse(localStorage.getItem('group_chat_data') || '{}');
            if (groupData.members && groupData.members.length > 0) {
                members = groupData.members.map(function(m) { return m.name || m; }).filter(function(n) { return n && n.trim(); });
            }
        } catch(e) {}
        if (members.length === 0) {
            try {
                var storedMembers = localStorage.getItem('groupMembers');
                if (storedMembers) {
                    var parsed = JSON.parse(storedMembers);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        members = parsed.map(function(m) { return typeof m === 'string' ? m : (m.name || m); }).filter(function(n) { return n && n.trim(); });
                    }
                }
            } catch(e) {}
        }
        if (members.length === 0) {
            members = ['沈星回', '陆沉'];
        }
        return members;
    }

    function _getMyNameForRedpacket() {
        try {
            if (typeof settings !== 'undefined' && settings.myName) return settings.myName;
        } catch(e) {}
        var stored = localStorage.getItem('moments_my_name');
        if (stored) return stored;
        return '阿晏';
    }

    // =============================================
    // 获取表情包列表
    // =============================================
    function _getStickerList() {
        var stickers = [];
        try {
            var stored = localStorage.getItem('myStickers');
            if (stored) {
                var parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) stickers = parsed;
            }
        } catch(e) {}
        
        // 从 localforage 补充
        if (window.localforage) {
            localforage.getItem('myStickers').then(function(data) {
                if (data && Array.isArray(data) && data.length > 0) {
                    var existing = stickers;
                    data.forEach(function(item) {
                        if (existing.indexOf(item) === -1) {
                            existing.push(item);
                        }
                    });
                    localStorage.setItem('myStickers', JSON.stringify(existing));
                }
            }).catch(function() {});
        }
        return stickers;
    }

    function _saveStickerList(stickers) {
        localStorage.setItem('myStickers', JSON.stringify(stickers));
        if (window.localforage) {
            localforage.setItem('myStickers', stickers).catch(function() {});
        }
    }

    // =============================================
    // 发送表情包
    // =============================================
    window.sendSticker = function(src) {
        if (typeof addMessage === 'function') {
            addMessage({
                id: Date.now(),
                sender: 'user',
                text: '',
                timestamp: new Date(),
                image: src,
                status: 'sent',
                type: 'normal'
            });
            if (typeof playSound === 'function') playSound('send');
            
            var picker = document.getElementById('user-sticker-picker');
            if (picker) picker.style.display = 'none';
            
            var delayRange = (typeof settings !== 'undefined' && settings.replyDelayMax) ? settings.replyDelayMax - settings.replyDelayMin : 4000;
            var delayMin = (typeof settings !== 'undefined' && settings.replyDelayMin) ? settings.replyDelayMin : 3000;
            var randomDelay = delayMin + Math.random() * delayRange;
            setTimeout(function() {
                if (typeof simulateReply === 'function') simulateReply();
            }, randomDelay);
        }
    };

    // =============================================
    // 发送红包
    // =============================================
    window.sendRedpacket = function(senderName) {
        var redData = _getRedpacketData();
        var members = _getGroupMemberList();
        
        var targets = members.filter(function(m) { return m !== senderName; });
        if (targets.length === 0) {
            if (typeof showNotification === 'function') showNotification('没有可发送的成员', 'warning');
            return;
        }
        var target = targets[Math.floor(Math.random() * targets.length)];
        
        var targetAmount = redData.members[target] !== undefined ? redData.members[target] : 0;
        if (targetAmount <= 0) {
            if (typeof showNotification === 'function') showNotification(target + ' 的红包已空', 'info');
            return;
        }
        
        if (Math.random() > 0.5) {
            if (typeof showNotification === 'function') showNotification('对方没有收到红包 😅', 'info', 1500);
            return;
        }
        
        var amount = Math.random() * targetAmount;
        amount = Math.round(amount * 10) / 10;
        if (amount < 0.1) amount = 0.1;
        if (amount > targetAmount) amount = targetAmount;
        
        redData.members[target] = Math.round((targetAmount - amount) * 10) / 10;
        _setRedpacketData(redData);
        
        if (typeof addMessage === 'function') {
            addMessage({
                id: Date.now(),
                sender: 'system',
                text: '🧧 ' + target + ' 收到了 ¥' + amount.toFixed(1) + ' 红包（剩余 ¥' + redData.members[target].toFixed(1) + '）',
                timestamp: new Date(),
                type: 'system',
                status: 'sent'
            });
            if (typeof playSound === 'function') playSound('send');
        }
        
        if (window._refreshRedpacketPanel) window._refreshRedpacketPanel();
        if (typeof showNotification === 'function') showNotification('🧧 ' + target + ' 收到 ¥' + amount.toFixed(1) + ' 红包', 'success', 2000);
    };

    // =============================================
    // 初始化红包+表情包弹窗
    // =============================================
    function _initRedpacketComboPanel() {
        var picker = document.getElementById('user-sticker-picker');
        if (!picker) return;
        
        // 如果已初始化则跳过
        if (picker.dataset.initialized === 'true') return;
        picker.dataset.initialized = 'true';
        
        picker.innerHTML = '';
        picker.style.cssText = 'position:absolute;bottom:calc(100% + 10px);left:0;width:340px;max-width:85vw;max-height:420px;background:var(--primary-bg);border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.25);border:1px solid var(--border-color);display:none;z-index:100;overflow:hidden;flex-direction:column;';
        
        var tabBar = document.createElement('div');
        tabBar.style.cssText = 'display:flex;border-bottom:1px solid var(--border-color);flex-shrink:0;background:var(--secondary-bg);';
        tabBar.innerHTML = `
            <button class="combo-tab-btn active" data-tab="redpacket" style="flex:1;padding:12px 6px;border:none;background:var(--accent-color);color:#fff;cursor:pointer;font-size:13px;font-weight:600;font-family:var(--font-family);border-radius:12px 0 0 0;display:flex;align-items:center;justify-content:center;gap:6px;transition:all 0.25s ease;">
                <i class="fas fa-coins"></i> 红包
            </button>
            <button class="combo-tab-btn" data-tab="sticker" style="flex:1;padding:12px 6px;border:none;background:var(--secondary-bg);color:var(--text-secondary);cursor:pointer;font-size:13px;font-weight:400;font-family:var(--font-family);border-radius:0 12px 0 0;display:flex;align-items:center;justify-content:center;gap:6px;transition:all 0.25s ease;">
                <i class="fas fa-smile"></i> 表情包
            </button>
        `;
        picker.appendChild(tabBar);
        
        var contentArea = document.createElement('div');
        contentArea.id = 'combo-content-area';
        contentArea.style.cssText = 'flex:1;overflow-y:auto;padding:12px;max-height:340px;background:var(--primary-bg);';
        picker.appendChild(contentArea);
        
        function renderRedpacketPanel() {
            var area = document.getElementById('combo-content-area');
            if (!area) return;
            
            var redData = _getRedpacketData();
            var members = _getGroupMemberList();
            var myName = _getMyNameForRedpacket();
            
            var html = '';
            
            html += '<div style="font-size:11px;font-weight:700;color:var(--text-secondary);letter-spacing:0.5px;padding:4px 2px 8px;border-bottom:1px solid var(--border-color);display:flex;align-items:center;gap:6px;">';
            html += '<i class="fas fa-users" style="font-size:12px;"></i> 群聊成员';
            html += '<span style="font-size:10px;opacity:0.5;font-weight:400;margin-left:auto;">点击"设置"调整红包额度</span>';
            html += '</div>';
            
            members.forEach(function(name) {
                var amount = redData.members[name] !== undefined ? redData.members[name] : 0;
                html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 4px;border-bottom:1px solid rgba(var(--border-color-rgb),0.08);">';
                html += '<span style="font-size:13px;color:var(--text-primary);">' + name + '</span>';
                html += '<div style="display:flex;align-items:center;gap:8px;">';
                html += '<span style="font-size:12px;color:var(--accent-color);font-weight:600;">¥' + amount.toFixed(1) + '</span>';
                html += '<button class="redpacket-edit-btn" data-name="' + name.replace(/"/g, '&quot;') + '" style="background:rgba(var(--accent-color-rgb),0.08);border:1px solid rgba(var(--accent-color-rgb),0.15);border-radius:6px;padding:2px 10px;font-size:11px;cursor:pointer;color:var(--accent-color);font-family:var(--font-family);transition:all 0.2s;" onmouseover="this.style.background=\'rgba(var(--accent-color-rgb),0.18)\'" onmouseout="this.style.background=\'rgba(var(--accent-color-rgb),0.08)\'">设置</button>';
                html += '<button class="redpacket-send-btn" data-name="' + name.replace(/"/g, '&quot;') + '" style="background:var(--accent-color);border:none;border-radius:6px;padding:2px 10px;font-size:11px;cursor:pointer;color:#fff;font-family:var(--font-family);transition:all 0.2s;" onmouseover="this.style.opacity=\'0.85\'" onmouseout="this.style.opacity=\'1\'">发送</button>';
                html += '</div></div>';
            });
            
            html += '<div style="font-size:11px;font-weight:700;color:var(--text-secondary);letter-spacing:0.5px;padding:10px 2px 8px;border-bottom:1px solid var(--border-color);margin-top:6px;display:flex;align-items:center;gap:6px;">';
            html += '<i class="fas fa-user" style="font-size:12px;"></i> 我方';
            html += '</div>';
            
            var myAmount = redData.myAmount || 0;
            html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 4px;">';
            html += '<span style="font-size:13px;color:var(--text-primary);">' + myName + '</span>';
            html += '<div style="display:flex;align-items:center;gap:8px;">';
            html += '<span style="font-size:12px;color:var(--accent-color);font-weight:600;">¥' + myAmount.toFixed(1) + '</span>';
            html += '<button id="redpacket-my-edit-btn" style="background:rgba(var(--accent-color-rgb),0.08);border:1px solid rgba(var(--accent-color-rgb),0.15);border-radius:6px;padding:2px 10px;font-size:11px;cursor:pointer;color:var(--accent-color);font-family:var(--font-family);transition:all 0.2s;" onmouseover="this.style.background=\'rgba(var(--accent-color-rgb),0.18)\'" onmouseout="this.style.background=\'rgba(var(--accent-color-rgb),0.08)\'">设置</button>';
            html += '</div></div>';
            
            html += '<div style="font-size:10px;color:var(--text-secondary);opacity:0.5;padding:10px 2px 0;text-align:center;border-top:1px dashed var(--border-color);margin-top:8px;line-height:1.6;">';
            html += '💡 点击"发送"有 50% 概率从对方红包中随机扣除金额';
            html += '</div>';
            
            area.innerHTML = html;
            
            area.querySelectorAll('.redpacket-edit-btn').forEach(function(btn) {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var name = this.dataset.name;
                    var redData2 = _getRedpacketData();
                    var current = redData2.members[name] !== undefined ? redData2.members[name] : 0;
                    var newAmount = prompt('设置 ' + name + ' 的红包总额：', current);
                    if (newAmount !== null) {
                        var val = parseFloat(newAmount);
                        if (!isNaN(val) && val >= 0) {
                            redData2.members[name] = Math.round(val * 10) / 10;
                            _setRedpacketData(redData2);
                            renderRedpacketPanel();
                            if (typeof showNotification === 'function') showNotification(name + ' 红包已设置为 ¥' + redData2.members[name].toFixed(1), 'success', 1500);
                        } else {
                            if (typeof showNotification === 'function') showNotification('请输入有效数字', 'warning');
                        }
                    }
                });
            });
            
            area.querySelectorAll('.redpacket-send-btn').forEach(function(btn) {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var name = this.dataset.name;
                    if (typeof window.sendRedpacket === 'function') {
                        window.sendRedpacket(name);
                    }
                });
            });
            
            var myEditBtn = document.getElementById('redpacket-my-edit-btn');
            if (myEditBtn) {
                myEditBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var redData2 = _getRedpacketData();
                    var current = redData2.myAmount || 0;
                    var newAmount = prompt('设置我的红包总额：', current);
                    if (newAmount !== null) {
                        var val = parseFloat(newAmount);
                        if (!isNaN(val) && val >= 0) {
                            redData2.myAmount = Math.round(val * 10) / 10;
                            _setRedpacketData(redData2);
                            renderRedpacketPanel();
                            if (typeof showNotification === 'function') showNotification('我的红包已设置为 ¥' + redData2.myAmount.toFixed(1), 'success', 1500);
                        } else {
                            if (typeof showNotification === 'function') showNotification('请输入有效数字', 'warning');
                        }
                    }
                });
            }
        }
        
        function renderStickerPanel() {
            var area = document.getElementById('combo-content-area');
            if (!area) return;
            
            var stickers = _getStickerList();
            
            if (!stickers || stickers.length === 0) {
                area.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--text-secondary);font-size:13px;">' +
                    '<div style="font-size:48px;margin-bottom:10px;">📭</div>' +
                    '还没有我的专属表情哦<br>' +
                    '<span style="font-size:11px;opacity:0.6;">点击下方"添加表情"按钮上传图片~</span>' +
                    '</div>';
                return;
            }
            
            var html = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px;">';
            stickers.forEach(function(src, idx) {
                html += '<div style="aspect-ratio:1;border-radius:10px;overflow:hidden;border:2px solid var(--border-color);cursor:pointer;transition:all 0.2s;position:relative;" onclick="sendSticker(\'' + src.replace(/'/g, "\\'") + '\')" onmouseover="this.style.borderColor=\'var(--accent-color)\';this.style.transform=\'scale(1.04)\'" onmouseout="this.style.borderColor=\'var(--border-color)\';this.style.transform=\'scale(1)\'">';
                html += '<img src="' + src + '" style="width:100%;height:100%;object-fit:cover;" loading="lazy">';
                html += '<button onclick="event.stopPropagation();deleteSticker(' + idx + ')" style="position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,0.6);color:#fff;border:none;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0">✕</button>';
                html += '</div>';
            });
            html += '</div>';
            area.innerHTML = html;
        }
        
        function deleteSticker(idx) {
            var stickers = _getStickerList();
            if (idx >= 0 && idx < stickers.length) {
                stickers.splice(idx, 1);
                _saveStickerList(stickers);
                renderStickerPanel();
                if (typeof showNotification === 'function') showNotification('已删除', 'info');
            }
        }
        window.deleteSticker = deleteSticker;
        
        tabBar.querySelectorAll('.combo-tab-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                tabBar.querySelectorAll('.combo-tab-btn').forEach(function(b) {
                    b.classList.remove('active');
                    b.style.background = 'var(--secondary-bg)';
                    b.style.color = 'var(--text-secondary)';
                    b.style.borderRadius = '12px 0 0 0';
                });
                this.classList.add('active');
                this.style.background = 'var(--accent-color)';
                this.style.color = '#fff';
                this.style.borderRadius = '12px 0 0 0';
                
                var tab = this.dataset.tab;
                if (tab === 'redpacket') {
                    renderRedpacketPanel();
                } else {
                    renderStickerPanel();
                }
            });
        });
        
        renderRedpacketPanel();
        window._refreshRedpacketPanel = renderRedpacketPanel;
        window._refreshStickerPanel = renderStickerPanel;
        
        // 添加表情包上传按钮到弹窗底部
        var uploadBtn = document.createElement('div');
        uploadBtn.style.cssText = 'padding:8px 12px 12px;border-top:1px solid var(--border-color);flex-shrink:0;background:var(--primary-bg);display:flex;gap:8px;';
        uploadBtn.innerHTML = `
            <button id="sticker-add-btn" onclick="document.getElementById('my-sticker-quick-upload').click()" style="flex:1;padding:8px;background:var(--accent-color);border:none;cursor:pointer;color:#fff;font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:5px;border-radius:10px;transition:all 0.2s;font-family:var(--font-family);" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
                <i class="fas fa-plus"></i> 添加表情
            </button>
            <button onclick="window.openMyStickerSettings && window.openMyStickerSettings()" style="flex:1;padding:8px;border:1px solid var(--border-color);cursor:pointer;color:var(--text-secondary);font-size:12px;display:flex;align-items:center;justify-content:center;gap:5px;border-radius:10px;background:var(--secondary-bg);font-family:var(--font-family);transition:all 0.2s;" onmouseover="this.style.background='rgba(var(--accent-color-rgb),0.1)'" onmouseout="this.style.background='var(--secondary-bg)'">
                <i class="fas fa-cog"></i> 管理
            </button>
        `;
        picker.appendChild(uploadBtn);
        
        // 文件上传监听
        var fileInput = document.getElementById('my-sticker-quick-upload');
        if (fileInput) {
            fileInput.onchange = function(e) {
                var files = e.target.files;
                if (!files || files.length === 0) return;
                
                var stickers = _getStickerList();
                var loaded = 0;
                
                for (var i = 0; i < files.length; i++) {
                    (function(file) {
                        var reader = new FileReader();
                        reader.onload = function(ev) {
                            var data = ev.target.result;
                            if (stickers.indexOf(data) === -1) {
                                stickers.push(data);
                            }
                            loaded++;
                            if (loaded === files.length) {
                                _saveStickerList(stickers);
                                if (window._refreshStickerPanel) window._refreshStickerPanel();
                                if (typeof showNotification === 'function') showNotification('已添加 ' + loaded + ' 个表情 ✨', 'success', 1500);
                            }
                        };
                        reader.readAsDataURL(file);
                    })(files[i]);
                }
                this.value = '';
            };
        }
    }

    // =============================================
    // 打开表情管理设置
    // =============================================
    window.openMyStickerSettings = function() {
        var old = document.getElementById('sticker-settings-modal');
        if (old) old.remove();
        
        var stickers = _getStickerList();
        
        var wrap = document.createElement('div');
        wrap.id = 'sticker-settings-modal';
        wrap.style.cssText = 'position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);';
        
        var inner = document.createElement('div');
        inner.style.cssText = 'background:var(--primary-bg);border-radius:20px;padding:24px;width:min(400px, 92vw);max-height:80vh;overflow-y:auto;border:1px solid var(--border-color);';
        inner.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <span style="font-size:18px;font-weight:700;color:var(--text-primary);">📸 表情管理</span>
                <button id="sticker-settings-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-secondary);">✕</button>
            </div>
            <div style="margin-bottom:12px;">
                <button onclick="document.getElementById('sticker-batch-upload').click()" style="width:100%;padding:12px;border:1.5px dashed var(--border-color);border-radius:12px;background:transparent;color:var(--text-secondary);cursor:pointer;font-size:13px;font-family:var(--font-family);transition:all 0.2s;" onmouseover="this.style.borderColor='var(--accent-color)';this.style.color='var(--accent-color)'" onmouseout="this.style.borderColor='var(--border-color)';this.style.color='var(--text-secondary)'">
                    <i class="fas fa-upload"></i> 批量上传图片
                </button>
                <input type="file" id="sticker-batch-upload" accept="image/*" multiple style="display:none;">
            </div>
            <div id="sticker-list-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;max-height:300px;overflow-y:auto;padding:4px 0;">
            </div>
            <div style="display:flex;gap:10px;margin-top:16px;">
                <button id="sticker-settings-close-btn" style="flex:1;padding:10px;border:1px solid var(--border-color);border-radius:12px;background:var(--secondary-bg);color:var(--text-secondary);font-size:13px;cursor:pointer;font-family:var(--font-family);">关闭</button>
                <button id="sticker-clear-all" style="flex:1;padding:10px;border:1px solid #ff6b6b;border-radius:12px;background:transparent;color:#ff6b6b;font-size:13px;cursor:pointer;font-family:var(--font-family);">清空全部</button>
            </div>
        `;
        wrap.appendChild(inner);
        document.body.appendChild(wrap);
        
        function renderStickerGrid() {
            var grid = document.getElementById('sticker-list-grid');
            var stickers2 = _getStickerList();
            if (!stickers2 || stickers2.length === 0) {
                grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px 0;color:var(--text-secondary);font-size:13px;">还没有表情，点击上传添加 ✨</div>';
                return;
            }
            grid.innerHTML = '';
            stickers2.forEach(function(src, idx) {
                var div = document.createElement('div');
                div.style.cssText = 'aspect-ratio:1;border-radius:10px;overflow:hidden;border:2px solid var(--border-color);position:relative;transition:all 0.2s;';
                div.innerHTML = `
                    <img src="${src}" style="width:100%;height:100%;object-fit:cover;">
                    <button onclick="deleteStickerFromSettings(${idx})" style="position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,0.6);color:#fff;border:none;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0">✕</button>
                `;
                grid.appendChild(div);
            });
        }
        renderStickerGrid();
        
        window.deleteStickerFromSettings = function(idx) {
            var stickers2 = _getStickerList();
            if (idx >= 0 && idx < stickers2.length) {
                stickers2.splice(idx, 1);
                _saveStickerList(stickers2);
                renderStickerGrid();
                if (window._refreshStickerPanel) window._refreshStickerPanel();
                if (typeof showNotification === 'function') showNotification('已删除', 'info');
            }
        };
        
        document.getElementById('sticker-settings-close').onclick = function() { wrap.remove(); };
        document.getElementById('sticker-settings-close-btn').onclick = function() { wrap.remove(); };
        wrap.onclick = function(e) { if (e.target === wrap) wrap.remove(); };
        
        document.getElementById('sticker-batch-upload').onchange = function(e) {
            var files = e.target.files;
            if (!files || files.length === 0) return;
            var stickers2 = _getStickerList();
            var loaded = 0;
            for (var i = 0; i < files.length; i++) {
                (function(file) {
                    var reader = new FileReader();
                    reader.onload = function(ev) {
                        var data = ev.target.result;
                        if (stickers2.indexOf(data) === -1) {
                            stickers2.push(data);
                        }
                        loaded++;
                        if (loaded === files.length) {
                            _saveStickerList(stickers2);
                            renderStickerGrid();
                            if (window._refreshStickerPanel) window._refreshStickerPanel();
                            if (typeof showNotification === 'function') showNotification('已添加 ' + loaded + ' 个表情 ✨', 'success', 1500);
                        }
                    };
                    reader.readAsDataURL(file);
                })(files[i]);
            }
            this.value = '';
        };
        
        document.getElementById('sticker-clear-all').onclick = function() {
            if (confirm('确定要清空所有表情吗？')) {
                _saveStickerList([]);
                renderStickerGrid();
                if (window._refreshStickerPanel) window._refreshStickerPanel();
                if (typeof showNotification === 'function') showNotification('已清空', 'info');
            }
        };
    };

    // =============================================
    // 初始化 - 等待DOM加载完成后初始化弹窗
    // =============================================
    function _initFeature() {
        var checkInterval = setInterval(function() {
            var picker = document.getElementById('user-sticker-picker');
            if (picker) {
                clearInterval(checkInterval);
                _initRedpacketComboPanel();
                console.log('[红包+表情包功能] 已初始化');
            }
        }, 200);
        
        setTimeout(function() {
            clearInterval(checkInterval);
        }, 10000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _initFeature);
    } else {
        _initFeature();
    }

    // =============================================
    // 暴露全局方法
    // =============================================
    window._getRedpacketData = _getRedpacketData;
    window._setRedpacketData = _setRedpacketData;
    window._getGroupMemberList = _getGroupMemberList;
    window._getStickerList = _getStickerList;
    window._saveStickerList = _saveStickerList;

    console.log('[红包+表情包] 功能模块已加载');
})();
