// moments.js - 朋友圈功能（完整修复版 + 头像自动压缩）
(function() {
    'use strict';

    var STORAGE_KEY = 'moments_data';
    var COVER_KEY = 'moments_cover_image';
    var MAX_POSTS = 100;
    var INTERACTION_QUEUE = [];

    // =============================================
    // 头像压缩工具函数
    // =============================================
    function _compressImage(dataUrl, maxWidth, maxHeight, quality) {
        return new Promise(function(resolve) {
            maxWidth = maxWidth || 200;
            maxHeight = maxHeight || 200;
            quality = quality || 0.6;
            
            var img = new Image();
            img.onload = function() {
                var canvas = document.createElement('canvas');
                var width = img.width;
                var height = img.height;
                
                if (width > maxWidth) {
                    height = height * (maxWidth / width);
                    width = maxWidth;
                }
                if (height > maxHeight) {
                    width = width * (maxHeight / height);
                    height = maxHeight;
                }
                
                canvas.width = Math.round(width);
                canvas.height = Math.round(height);
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = function() {
                resolve(dataUrl);
            };
            img.src = dataUrl;
        });
    }

    function _getReplyCards() {
        var cards = [];
        if (window.customReplies && Array.isArray(window.customReplies)) {
            cards = window.customReplies.map(function(c) {
                return typeof c === 'string' ? c : (c.text || c.label || '');
            });
        }
        try {
            var stored = localStorage.getItem('customReplies');
            if (stored) {
                var parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    cards = parsed.map(function(c) {
                        return typeof c === 'string' ? c : (c.text || c.label || '');
                    });
                }
            }
        } catch(e) {}
        if (cards.length === 0) {
            cards = ['早安', '晚安', '想你', '抱抱', '亲亲', '开心', '好梦', '今天超棒', '别担心', '有我在'];
        }
        var result = [];
        for (var i = 0; i < cards.length; i++) {
            var c = cards[i];
            if (c && c.trim()) {
                if (result.indexOf(c) === -1) result.push(c);
            }
        }
        return result;
    }

    function _generateRandomCombinedText() {
        var cards = _getReplyCards();
        if (cards.length < 2) {
            cards = ['早安', '晚安', '想你', '抱抱', '亲亲', '开心', '好梦', '今天超棒', '别担心', '有我在'];
        }
        var shuffled = cards.slice();
        for (var i = shuffled.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = shuffled[i];
            shuffled[i] = shuffled[j];
            shuffled[j] = temp;
        }
        var count = 3 + Math.floor(Math.random() * 3);
        var picked = shuffled.slice(0, Math.min(count, shuffled.length));
        var puncts = ['，', '。', '？', '！', '...', '～', '、', '；'];
        var result = '';
        for (var pi = 0; pi < picked.length; pi++) {
            var p = puncts[Math.floor(Math.random() * puncts.length)];
            result += picked[pi] + p;
        }
        return result;
    }

    function _getGroupMembers() {
        var defaultMembers = [];
        try {
            var stored = localStorage.getItem('moments_group_members');
            if (stored) {
                var parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch(e) {}
        try {
            var groupData = JSON.parse(localStorage.getItem('group_chat_data') || '{}');
            if (groupData.members && groupData.members.length > 0) {
                var members = groupData.members.map(function(m) {
                    return { name: m.name || m, avatar: m.avatar || '' };
                });
                if (members.length > 0) {
                    return members;
                }
            }
        } catch(e) {}
        try {
            var storedMembers = localStorage.getItem('groupMembers');
            if (storedMembers) {
                var parsed = JSON.parse(storedMembers);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed.map(function(m) {
                        return { name: typeof m === 'string' ? m : (m.name || m), avatar: m.avatar || '' };
                    });
                }
            }
        } catch(e) {}
        _saveGroupMembers(defaultMembers);
        return defaultMembers;
    }

    function _saveGroupMembers(members) {
        localStorage.setItem('moments_group_members', JSON.stringify(members));
    }

    function _getRandomGroupMember(excludeName) {
        var members = _getGroupMembers();
        var filtered = members.filter(function(m) { return m.name !== excludeName; });
        if (filtered.length === 0) return { name: '未命名', avatar: '' };
        return filtered[Math.floor(Math.random() * filtered.length)];
    }

    function _getPartnerName() {
        return (typeof settings !== 'undefined' && settings.partnerName) ? settings.partnerName : '梦角';
    }
    function _getMyName() {
        return (typeof settings !== 'undefined' && settings.myName) ? settings.myName : '我';
    }

    function _notify(msg, type, duration) {
        type = type || 'info';
        duration = duration || 2000;
        if (typeof showNotification === 'function') {
            showNotification(msg, type, duration);
        } else {
            alert(msg);
        }
    }

    function _esc(s) {
        return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function _randomPick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function _generateId() {
        return Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    }

    function _getCoverImage() {
        try { return localStorage.getItem(COVER_KEY) || ''; } catch { return ''; }
    }
    function _setCoverImage(data) { localStorage.setItem(COVER_KEY, data); }
    function _clearCoverImage() { localStorage.removeItem(COVER_KEY); }

    var MY_NAME_KEY = 'moments_my_name';
    var MY_AVATAR_KEY = 'moments_my_avatar';

    function _getMyNameSetting() {
        try { return localStorage.getItem(MY_NAME_KEY) || _getMyName(); } catch { return _getMyName(); }
    }
    function _setMyNameSetting(name) {
        localStorage.setItem(MY_NAME_KEY, name);
    }

    function _getMyAvatarSetting() {
        try { return localStorage.getItem(MY_AVATAR_KEY) || ''; } catch { return ''; }
    }
    function _setMyAvatarSetting(data) {
        localStorage.setItem(MY_AVATAR_KEY, data);
    }

    function _getMemberAvatar(name) {
        var members = _getGroupMembers();
        for (var i = 0; i < members.length; i++) {
            if (members[i].name === name) {
                return members[i].avatar || '';
            }
        }
        return '';
    }

    function _setMemberAvatar(name, avatar) {
        var members = _getGroupMembers();
        for (var i = 0; i < members.length; i++) {
            if (members[i].name === name) {
                members[i].avatar = avatar;
                break;
            }
        }
        _saveGroupMembers(members);
    }

    function _updateMemberName(oldName, newName) {
        var members = _getGroupMembers();
        for (var i = 0; i < members.length; i++) {
            if (members[i].name === oldName) {
                members[i].name = newName;
                break;
            }
        }
        _saveGroupMembers(members);
        var data = _getData();
        var updated = false;
        for (var pi = 0; pi < data.posts.length; pi++) {
            if (data.posts[pi].memberName === oldName && data.posts[pi].author === 'partner') {
                data.posts[pi].memberName = newName;
                updated = true;
            }
        }
        if (updated) _setData(data);
    }

    function _addGroupMember(name, avatar) {
        var members = _getGroupMembers();
        members.push({ name: name.trim(), avatar: avatar || '' });
        _saveGroupMembers(members);
        try {
            var groupData = JSON.parse(localStorage.getItem('group_chat_data') || '{}');
            if (!groupData.members) groupData.members = [];
            groupData.members = members;
            localStorage.setItem('group_chat_data', JSON.stringify(groupData));
        } catch(e) {}
    }

    function _removeGroupMember(name) {
        var members = _getGroupMembers();
        members = members.filter(function(m) { return m.name !== name; });
        _saveGroupMembers(members);
        try {
            var groupData = JSON.parse(localStorage.getItem('group_chat_data') || '{}');
            groupData.members = members;
            localStorage.setItem('group_chat_data', JSON.stringify(groupData));
        } catch(e) {}
        var data = _getData();
        data.posts = data.posts.filter(function(p) {
            return !(p.author === 'partner' && p.memberName === name);
        });
        _setData(data);
    }

    function _getData() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { posts: [], lastGenerateDate: '' }; } catch { return { posts: [], lastGenerateDate: '' }; }
    }
    function _setData(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

    function _getPosts() {
        var data = _getData();
        return data.posts.sort(function(a, b) {
            return new Date(b.timestamp) - new Date(a.timestamp);
        });
    }

    function _addPost(author, text, timestamp, memberName, memberAvatar) {
        var data = _getData();
        var post = {
            id: _generateId(),
            author: author,
            text: text.trim(),
            timestamp: timestamp || new Date().toISOString(),
            likes: 0,
            likedByMe: false,
            likedByMembers: {},
            comments: [],
            memberName: memberName || '',
            memberAvatar: memberAvatar || '',
            _partnerRepliedLike: false,
            _partnerRepliedComment: {}
        };
        data.posts.unshift(post);
        if (data.posts.length > MAX_POSTS) data.posts = data.posts.slice(0, MAX_POSTS);
        _setData(data);
        return post;
    }

    function _deletePost(postId) {
        var data = _getData();
        data.posts = data.posts.filter(function(p) { return p.id !== postId; });
        _setData(data);
    }

    function _toggleLike(postId) {
        var data = _getData();
        var post = data.posts.find(function(p) { return p.id === postId; });
        if (!post) return;
        if (post.likedByMe) {
            post.likes -= 1;
            post.likedByMe = false;
        } else {
            post.likes += 1;
            post.likedByMe = true;
            _schedulePartnerInteraction(postId, 'like');
        }
        _setData(data);
    }

    function _schedulePartnerInteraction(postId, type, commentId) {
        var delay = 0;
        if (type === 'like') {
            delay = 60000 + Math.random() * 120000;
        } else if (type === 'comment') {
            delay = 180000 + Math.random() * 120000;
        } else if (type === 'reply') {
            delay = 120000 + Math.random() * 120000;
        }
        var task = {
            postId: postId,
            type: type,
            commentId: commentId || null,
            scheduledAt: Date.now() + delay,
            executed: false
        };
        INTERACTION_QUEUE.push(task);
        setTimeout(function() {
            _executeInteraction(task);
        }, delay);
    }

    function _executeInteraction(task) {
        if (task.executed) return;
        task.executed = true;
        var data = _getData();
        var post = data.posts.find(function(p) { return p.id === task.postId; });
        if (!post) return;

        if (task.type === 'like') {
            var members = _getGroupMembers();
            var availableMembers = members.filter(function(m) {
                return !post.likedByMembers[m.name];
            });
            if (availableMembers.length === 0) return;
            var member = _randomPick(availableMembers);
            post.likes += 1;
            post.likedByMembers[member.name] = true;
            _setData(data);
            _notify('💕 ' + member.name + ' 赞了你的动态', 'info', 3000);
            _refreshUI();
        } else if (task.type === 'comment') {
            var members2 = _getGroupMembers();
            var availableMembers2 = members2.filter(function(m) {
                return m.name !== _getMyNameSetting();
            });
            if (availableMembers2.length === 0) return;
            var member2 = _randomPick(availableMembers2);
            var text = _generateRandomCombinedText();
            var comment = {
                id: _generateId(),
                author: 'partner',
                authorName: member2.name,
                text: text,
                timestamp: new Date().toISOString(),
                reply: null,
                replied: false
            };
            post.comments.push(comment);
            _setData(data);
            _notify('💬 ' + member2.name + ' 评论了你的动态', 'info', 3000);
            _refreshUI();
        } else if (task.type === 'reply' && task.commentId) {
            var commentObj = null;
            for (var ci = 0; ci < post.comments.length; ci++) {
                if (post.comments[ci].id === task.commentId) {
                    commentObj = post.comments[ci];
                    break;
                }
            }
            if (!commentObj || commentObj.replied) return;
            var members3 = _getGroupMembers();
            var availableMembers3 = members3.filter(function(m) {
                return m.name !== commentObj.authorName && m.name !== _getMyNameSetting();
            });
            if (availableMembers3.length === 0) return;
            var member3 = _randomPick(availableMembers3);
            var replyText = _generateRandomCombinedText();
            commentObj.reply = {
                text: replyText,
                timestamp: new Date().toISOString(),
                authorName: member3.name
            };
            commentObj.replied = true;
            _setData(data);
            _notify('💬 ' + member3.name + ' 回复了评论', 'info', 3000);
            _refreshUI();
        }
    }

    function _refreshUI() {
        var container = document.getElementById('moments-content');
        var activeTab = document.querySelector('.moments-tab.active');
        if (container && activeTab) renderTab(activeTab.dataset.tab, container);
    }

    function _forceGeneratePartnerPosts() {
        var data = _getData();
        var today = new Date().toDateString();
        var members = _getGroupMembers();
        
        if (members.length === 0) {
            if (data.lastGenerateDate !== today) {
                data.lastGenerateDate = today;
                _setData(data);
            }
            return;
        }

        var existingPartnerPosts = data.posts.filter(function(p) { return p.author === 'partner'; });
        var todayPosts = existingPartnerPosts.filter(function(p) {
            return new Date(p.timestamp).toDateString() === today;
        });

        if (data.lastGenerateDate === today && todayPosts.length >= 2) {
            return;
        }

        var activeMembers = members.filter(function(m) { return m.name && m.name.trim(); });
        if (activeMembers.length === 0) return;

        var count = 2 + Math.floor(Math.random() * 3);
        var now = new Date();
        var todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        
        var timeSlots = [];
        for (var i = 0; i < count; i++) {
            var slot = 8 + Math.random() * 12;
            timeSlots.push(slot);
        }
        timeSlots.sort(function(a, b) { return a - b; });

        data.posts = data.posts.filter(function(p) {
            if (p.author === 'partner') {
                return new Date(p.timestamp).toDateString() !== today;
            }
            return true;
        });

        for (var idx = 0; idx < timeSlots.length; idx++) {
            var member = activeMembers[Math.floor(Math.random() * activeMembers.length)];
            var text = _generateRandomCombinedText();
            var hours = Math.floor(timeSlots[idx]);
            var minutes = Math.floor((timeSlots[idx] - hours) * 60);
            var ts = new Date(todayStart);
            ts.setHours(hours, minutes, Math.floor(Math.random() * 60), 0);
            _addPost('partner', text, ts.toISOString(), member.name, member.avatar);
        }

        data.lastGenerateDate = today;
        _setData(data);
    }

    window.triggerPartnerInteraction = function(postId, type) {
        _schedulePartnerInteraction(postId, type);
    };

    window.forcePartnerPublish = function() {
        _forceGeneratePartnerPosts();
        _refreshUI();
        _notify('已生成今日动态', 'success');
    };

    function formatTime(iso) {
        var date = new Date(iso);
        var now = new Date();
        var diff = (now - date) / 1000;
        if (diff < 60) return '刚刚';
        if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
        if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
        if (diff < 172800) return '昨天 ' + date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        return date.toLocaleDateString([], {month:'short', day:'numeric'}) + ' ' + date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    }

    // =============================================
    // 封面设置弹窗（使用 CSS 变量）
    // =============================================
    function showCoverSettings() {
        var old = document.getElementById('cover-settings-modal');
        if (old) old.parentNode && old.parentNode.removeChild(old);

        var wrap = document.createElement('div');
        wrap.id = 'cover-settings-modal';
        wrap.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:10050;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';

        var inner = document.createElement('div');
        inner.style.cssText = 'background:var(--primary-bg, #fff);border-radius:20px;padding:24px;width:340px;max-width:90%;border:1px solid var(--border-color, #ddd);max-height:90%;overflow-y:auto;';
        inner.innerHTML = '<div style="display:flex;justify-content:space-between;margin-bottom:14px;">' +
            '<span style="font-size:18px;font-weight:700;color:var(--text-primary, #222);">🖼️ 更换封面</span>' +
            '<button id="cover-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-secondary, #999);">✕</button>' +
            '</div>' +
            '<div style="margin-bottom:12px;">' +
            '<div style="font-size:13px;color:var(--text-secondary, #666);margin-bottom:8px;">选择一张图片作为朋友圈封面</div>' +
            '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
            '<button id="cover-upload-btn" style="flex:1;padding:10px;border:1.5px dashed var(--border-color, #ccc);border-radius:12px;background:transparent;color:var(--text-secondary, #666);cursor:pointer;font-size:13px;font-family:var(--font-family, sans-serif);-webkit-tap-highlight-color:transparent;">📤 上传图片</button>' +
            '<button id="cover-url-btn" style="flex:1;padding:10px;border:1.5px dashed var(--border-color, #ccc);border-radius:12px;background:transparent;color:var(--text-secondary, #666);cursor:pointer;font-size:13px;font-family:var(--font-family, sans-serif);-webkit-tap-highlight-color:transparent;">🔗 图片URL</button>' +
            '<button id="cover-reset-btn" style="flex:1;padding:10px;border:1px solid var(--border-color, #ccc);border-radius:12px;background:var(--secondary-bg, #f5f5f5);color:#ff6b6b;cursor:pointer;font-size:13px;font-family:var(--font-family, sans-serif);-webkit-tap-highlight-color:transparent;">🗑️ 恢复默认</button>' +
            '</div>' +
            '<input type="file" id="cover-file-input" accept="image/*" style="display:none;">' +
            '</div>' +
            '<div id="cover-preview-wrap" style="display:' + (_getCoverImage() ? 'block' : 'none') + ';margin-bottom:12px;border-radius:12px;overflow:hidden;border:1px solid var(--border-color, #ddd);">' +
            '<img id="cover-preview-img" src="' + _getCoverImage() + '" style="width:100%;max-height:150px;object-fit:cover;display:block;">' +
            '<div style="padding:6px 10px;font-size:11px;color:var(--text-secondary, #666);text-align:center;background:rgba(var(--primary-bg-rgb, 0,0,0),0.05);">当前封面预览</div>' +
            '</div>' +
            '<div style="display:flex;gap:10px;">' +
            '<button id="cover-cancel" style="flex:1;padding:10px;border:1px solid var(--border-color, #ccc);border-radius:12px;background:var(--secondary-bg, #f5f5f5);color:var(--text-secondary, #666);cursor:pointer;font-family:var(--font-family, sans-serif);-webkit-tap-highlight-color:transparent;">关闭</button>' +
            '<button id="cover-apply" style="flex:2;padding:10px;border:none;border-radius:12px;background:var(--accent-color, #000);color:#fff;font-weight:700;cursor:pointer;font-family:var(--font-family, sans-serif);-webkit-tap-highlight-color:transparent;">应用到封面</button>' +
            '</div>';
        wrap.appendChild(inner);
        document.body.appendChild(wrap);

        var close = function() { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); };
        document.getElementById('cover-close').onclick = close;
        document.getElementById('cover-cancel').onclick = close;
        wrap.onclick = function(e) { if (e.target === wrap) close(); };

        document.getElementById('cover-upload-btn').onclick = function() {
            document.getElementById('cover-file-input').click();
        };
        document.getElementById('cover-file-input').onchange = function(e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(ev) {
                var data = ev.target.result;
                var preview = document.getElementById('cover-preview-img');
                var wrap2 = document.getElementById('cover-preview-wrap');
                if (preview) preview.src = data;
                if (wrap2) wrap2.style.display = 'block';
                window._tempCoverData = data;
                _notify('图片已加载，点击"应用到封面"生效', 'success', 2000);
            };
            reader.readAsDataURL(file);
        };

        document.getElementById('cover-url-btn').onclick = function() {
            var url = prompt('请输入图片URL地址（支持 https://...）');
            if (url && url.trim()) {
                var preview = document.getElementById('cover-preview-img');
                var wrap2 = document.getElementById('cover-preview-wrap');
                if (preview) preview.src = url.trim();
                if (wrap2) wrap2.style.display = 'block';
                window._tempCoverData = url.trim();
                _notify('图片已加载，点击"应用到封面"生效', 'success', 2000);
            }
        };

        document.getElementById('cover-reset-btn').onclick = function() {
            if (confirm('确定恢复默认封面吗？')) {
                _clearCoverImage();
                var preview = document.getElementById('cover-preview-img');
                var wrap2 = document.getElementById('cover-preview-wrap');
                if (preview) preview.src = '';
                if (wrap2) wrap2.style.display = 'none';
                window._tempCoverData = null;
                _notify('已恢复默认封面', 'info');
            }
        };

        document.getElementById('cover-apply').onclick = function() {
            var data = window._tempCoverData;
            if (data) {
                _setCoverImage(data);
            } else {
                var preview = document.getElementById('cover-preview-img');
                if (preview && preview.src && preview.src !== '') {
                    _setCoverImage(preview.src);
                } else {
                    _notify('请先上传或输入图片', 'warning');
                    return;
                }
            }
            var coverEl = document.getElementById('moments-cover');
            if (coverEl) {
                var bg = _getCoverImage();
                if (bg) {
                    coverEl.style.backgroundImage = 'url(' + bg + ')';
                    coverEl.style.backgroundSize = 'cover';
                    coverEl.style.backgroundPosition = 'center';
                } else {
                    coverEl.style.backgroundImage = 'linear-gradient(135deg, #2d1b3d 0%, #1a1a2e 50%, #16213e 100%)';
                }
            }
            close();
            _notify('封面已更新 ✨', 'success');
        };

        var existingCover = _getCoverImage();
        if (existingCover) {
            var preview = document.getElementById('cover-preview-img');
            var wrap2 = document.getElementById('cover-preview-wrap');
            if (preview) preview.src = existingCover;
            if (wrap2) wrap2.style.display = 'block';
            window._tempCoverData = existingCover;
        }
    }

    // =============================================
    // 头像与昵称管理面板
    // =============================================
    function showAvatarSettings() {
        var old = document.getElementById('avatar-settings-modal');
        if (old) old.parentNode && old.parentNode.removeChild(old);

        var wrap = document.createElement('div');
        wrap.id = 'avatar-settings-modal';
        wrap.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:10055;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';

        var inner = document.createElement('div');
        inner.style.cssText = 'background:var(--primary-bg, #fff);border-radius:20px;padding:20px;width:340px;max-width:90%;max-height:85%;overflow-y:auto;border:1px solid var(--border-color, #ddd);';

        var myName = _getMyNameSetting();
        var myAvatar = _getMyAvatarSetting();
        var members = _getGroupMembers();

        var memberListHtml = '';
        if (members.length === 0) {
            memberListHtml = '<div style="text-align:center;padding:20px;color:var(--text-secondary, #999);font-size:13px;">还没有群成员，点击下方添加 ✨</div>';
        } else {
            for (var mi = 0; mi < members.length; mi++) {
                var m = members[mi];
                if (!m.name || !m.name.trim()) continue;
                var displayAvatar = m.avatar || '';
                memberListHtml += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-color, #eee);">' +
                    '<div style="width:36px;height:36px;border-radius:50%;overflow:hidden;border:1px solid var(--border-color, #ddd);flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--secondary-bg, #f5f5f5);">' +
                    (displayAvatar ? '<img src="' + _esc(displayAvatar) + '" style="width:100%;height:100%;object-fit:cover;">' : '<span style="font-size:16px;">🌸</span>') +
                    '</div>' +
                    '<span style="font-weight:500;font-size:13px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-primary, #222);">' + _esc(m.name) + '</span>' +
                    '<button onclick="editMember(\'' + _esc(m.name) + '\')" style="padding:4px 10px;border:1px solid var(--border-color, #ddd);border-radius:8px;background:var(--secondary-bg, #f5f5f5);color:var(--text-secondary, #666);font-size:11px;cursor:pointer;-webkit-tap-highlight-color:transparent;">编辑</button>' +
                    '<button onclick="removeMember(\'' + _esc(m.name) + '\')" style="padding:4px 8px;border:none;background:none;color:#ff6b6b;font-size:13px;cursor:pointer;-webkit-tap-highlight-color:transparent;">✕</button>' +
                    '</div>';
            }
        }

        inner.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
                '<span style="font-size:18px;font-weight:700;color:var(--text-primary, #222);">👤 头像与昵称</span>' +
                '<button id="avatar-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-secondary, #999);-webkit-tap-highlight-color:transparent;">✕</button>' +
            '</div>' +
            '<div style="margin-bottom:16px;background:rgba(var(--accent-color-rgb, 0,0,0),0.04);border-radius:12px;padding:14px 16px;border:1px solid rgba(var(--accent-color-rgb, 0,0,0),0.08);">' +
                '<div style="font-size:13px;font-weight:600;margin-bottom:10px;color:var(--accent-color, #000);">👤 我</div>' +
                '<div style="display:flex;align-items:center;gap:12px;">' +
                    '<div style="width:44px;height:44px;border-radius:50%;overflow:hidden;border:2px solid var(--border-color, #ddd);flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--secondary-bg, #f5f5f5);">' +
                        (myAvatar ? '<img src="' + _esc(myAvatar) + '" style="width:100%;height:100%;object-fit:cover;">' : '<span style="font-size:20px;">👤</span>') +
                    '</div>' +
                    '<div style="flex:1;min-width:0;">' +
                        '<div style="font-size:15px;font-weight:600;color:var(--text-primary, #222);">' + _esc(myName) + '</div>' +
                    '</div>' +
                    '<button onclick="editMyInfo()" style="padding:6px 14px;border:1px solid var(--border-color, #ddd);border-radius:10px;background:var(--secondary-bg, #f5f5f5);color:var(--text-secondary, #666);font-size:12px;cursor:pointer;-webkit-tap-highlight-color:transparent;">编辑</button>' +
                '</div>' +
            '</div>' +
            '<div style="margin-bottom:12px;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
                    '<span style="font-size:13px;font-weight:600;color:var(--text-primary, #222);">👥 群成员</span>' +
                    '<button onclick="addMember()" style="padding:5px 14px;border:none;border-radius:10px;background:var(--accent-color, #000);color:#fff;font-size:12px;font-weight:600;cursor:pointer;-webkit-tap-highlight-color:transparent;">+ 添加</button>' +
                '</div>' +
                memberListHtml +
            '</div>' +
            '<div style="display:flex;gap:10px;margin-top:4px;">' +
                '<button id="avatar-close-btn" style="flex:1;padding:10px;border:1px solid var(--border-color, #ddd);border-radius:12px;background:var(--secondary-bg, #f5f5f5);color:var(--text-secondary, #666);font-size:13px;cursor:pointer;-webkit-tap-highlight-color:transparent;">关闭</button>' +
            '</div>';

        wrap.appendChild(inner);
        document.body.appendChild(wrap);

        document.getElementById('avatar-close').onclick = function() { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); };
        document.getElementById('avatar-close-btn').onclick = function() { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); };
        wrap.onclick = function(e) { if (e.target === wrap) { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); } };
    }

    // =============================================
    // 编辑我的信息（带头像压缩功能）
    // =============================================
    function editMyInfo() {
        var old = document.getElementById('edit-my-modal');
        if (old) old.parentNode && old.parentNode.removeChild(old);

        var myName = _getMyNameSetting();
        var myAvatar = _getMyAvatarSetting();

        var wrap = document.createElement('div');
        wrap.id = 'edit-my-modal';
        wrap.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:10056;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';

        var inner = document.createElement('div');
        inner.style.cssText = 'background:var(--primary-bg, #fff);border-radius:20px;padding:24px;width:340px;max-width:90%;border:1px solid var(--border-color, #ddd);max-height:90%;overflow-y:auto;';
        inner.innerHTML =
            '<div style="display:flex;justify-content:space-between;margin-bottom:16px;">' +
                '<span style="font-size:18px;font-weight:700;color:var(--text-primary, #222);">✏️ 编辑我的信息</span>' +
                '<button id="edit-my-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-secondary, #999);-webkit-tap-highlight-color:transparent;">✕</button>' +
            '</div>' +
            '<div style="display:flex;flex-direction:column;align-items:center;gap:12px;margin-bottom:16px;">' +
                '<div style="width:64px;height:64px;border-radius:50%;overflow:hidden;border:2px solid var(--border-color, #ddd);display:flex;align-items:center;justify-content:center;background:var(--secondary-bg, #f5f5f5);position:relative;cursor:pointer;" onclick="document.getElementById(\'edit-my-avatar-input\').click()">' +
                    (myAvatar ? '<img id="edit-my-avatar-preview" src="' + _esc(myAvatar) + '" style="width:100%;height:100%;object-fit:cover;">' : '<span id="edit-my-avatar-preview" style="font-size:28px;">👤</span>') +
                    '<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.5);color:#fff;font-size:9px;text-align:center;padding:2px 0;">点击更换</div>' +
                '</div>' +
                '<input type="file" id="edit-my-avatar-input" accept="image/*" style="display:none;">' +
                '<div style="width:100%;">' +
                    '<label style="font-size:12px;color:var(--text-secondary, #999);display:block;margin-bottom:4px;">昵称</label>' +
                    '<input id="edit-my-name-input" type="text" value="' + _esc(myName) + '" maxlength="12" style="width:100%;padding:10px;border:1px solid var(--border-color, #ddd);border-radius:10px;background:var(--secondary-bg, #f5f5f5);color:var(--text-primary, #222);font-size:14px;box-sizing:border-box;font-family:var(--font-family, sans-serif);">' +
                '</div>' +
                '<div style="width:100%;display:flex;gap:8px;">' +
                    '<button onclick="document.getElementById(\'edit-my-avatar-url-input\').style.display=\'block\'" style="flex:1;padding:6px;border:1px dashed var(--border-color, #ddd);border-radius:8px;background:transparent;color:var(--text-secondary, #999);font-size:11px;cursor:pointer;-webkit-tap-highlight-color:transparent;">🔗 图片URL</button>' +
                    '<input id="edit-my-avatar-url-input" type="text" placeholder="输入图片URL" style="display:none;flex:1;padding:6px 10px;border:1px solid var(--border-color, #ddd);border-radius:8px;background:var(--secondary-bg, #f5f5f5);color:var(--text-primary, #222);font-size:11px;box-sizing:border-box;font-family:var(--font-family, sans-serif);">' +
                '</div>' +
            '</div>' +
            '<div style="display:flex;gap:10px;">' +
                '<button id="edit-my-cancel" style="flex:1;padding:10px;border:1px solid var(--border-color, #ddd);border-radius:12px;background:var(--secondary-bg, #f5f5f5);color:var(--text-secondary, #666);font-size:13px;cursor:pointer;-webkit-tap-highlight-color:transparent;">取消</button>' +
                '<button id="edit-my-save" style="flex:2;padding:10px;border:none;border-radius:12px;background:var(--accent-color, #000);color:#fff;font-weight:700;font-size:13px;cursor:pointer;-webkit-tap-highlight-color:transparent;">保存</button>' +
            '</div>';

        wrap.appendChild(inner);
        document.body.appendChild(wrap);

        var tempAvatar = myAvatar;

        document.getElementById('edit-my-close').onclick = function() { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); };
        document.getElementById('edit-my-cancel').onclick = function() { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); };
        wrap.onclick = function(e) { if (e.target === wrap) { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); } };

        // =============================================
        // 头像上传 - 带压缩功能
        // =============================================
        document.getElementById('edit-my-avatar-input').onchange = function(e) {
            var file = e.target.files[0];
            if (!file) return;

            // 如果文件小于 30KB 就不压缩
            if (file.size < 30 * 1024) {
                var reader = new FileReader();
                reader.onload = function(ev) {
                    tempAvatar = ev.target.result;
                    var preview = document.getElementById('edit-my-avatar-preview');
                    if (preview) {
                        if (preview.tagName === 'IMG') preview.src = ev.target.result;
                        else preview.innerHTML = '<img src="' + ev.target.result + '" style="width:100%;height:100%;object-fit:cover;">';
                    }
                    _notify('✅ 头像已保存 (' + (ev.target.result.length/1024).toFixed(0) + ' KB)', 'info', 1500);
                };
                reader.readAsDataURL(file);
                return;
            }

            var reader = new FileReader();
            reader.onload = function(ev) {
                var img = new Image();
                img.onload = function() {
                    var canvas = document.createElement('canvas');
                    var maxSize = 200;
                    var w = img.width, h = img.height;
                    if (w > maxSize || h > maxSize) {
                        var ratio = Math.min(maxSize / w, maxSize / h);
                        w = Math.round(w * ratio);
                        h = Math.round(h * ratio);
                    }
                    canvas.width = w;
                    canvas.height = h;
                    var ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    var compressed = canvas.toDataURL('image/jpeg', 0.5);
                    tempAvatar = compressed;
                    var preview = document.getElementById('edit-my-avatar-preview');
                    if (preview) {
                        if (preview.tagName === 'IMG') preview.src = compressed;
                        else preview.innerHTML = '<img src="' + compressed + '" style="width:100%;height:100%;object-fit:cover;">';
                    }
                    var originalSize = (ev.target.result.length / 1024).toFixed(0);
                    var compressedSize = (compressed.length / 1024).toFixed(0);
                    _notify('✅ 已压缩 ' + originalSize + 'KB → ' + compressedSize + 'KB', 'success', 2000);
                };
                img.onerror = function() {
                    tempAvatar = ev.target.result;
                    var preview = document.getElementById('edit-my-avatar-preview');
                    if (preview) {
                        if (preview.tagName === 'IMG') preview.src = ev.target.result;
                        else preview.innerHTML = '<img src="' + ev.target.result + '" style="width:100%;height:100%;object-fit:cover;">';
                    }
                    _notify('⚠️ 压缩失败，使用原图', 'warning', 1500);
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        };

        // URL 方式也支持压缩（但需要先加载图片）
        document.getElementById('edit-my-avatar-url-input').addEventListener('change', function() {
            var url = this.value.trim();
            if (!url) return;
            
            var img = new Image();
            img.onload = function() {
                var canvas = document.createElement('canvas');
                var maxSize = 200;
                var w = img.width, h = img.height;
                if (w > maxSize || h > maxSize) {
                    var ratio = Math.min(maxSize / w, maxSize / h);
                    w = Math.round(w * ratio);
                    h = Math.round(h * ratio);
                }
                canvas.width = w;
                canvas.height = h;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                var compressed = canvas.toDataURL('image/jpeg', 0.5);
                tempAvatar = compressed;
                var preview = document.getElementById('edit-my-avatar-preview');
                if (preview) {
                    if (preview.tagName === 'IMG') preview.src = compressed;
                    else preview.innerHTML = '<img src="' + compressed + '" style="width:100%;height:100%;object-fit:cover;">';
                }
                _notify('✅ 图片已加载并压缩', 'success', 1500);
            };
            img.onerror = function() {
                tempAvatar = url;
                var preview = document.getElementById('edit-my-avatar-preview');
                if (preview) {
                    if (preview.tagName === 'IMG') preview.src = url;
                    else preview.innerHTML = '<img src="' + url + '" style="width:100%;height:100%;object-fit:cover;">';
                }
                _notify('⚠️ 无法加载图片，请检查URL', 'warning', 1500);
            };
            img.src = url;
        });

        document.getElementById('edit-my-save').onclick = function() {
            var name = document.getElementById('edit-my-name-input').value.trim();
            if (!name) { _notify('请输入昵称', 'warning'); return; }
            _setMyNameSetting(name);
            if (tempAvatar) {
                // 确保头像被压缩
                _setMyAvatarSetting(tempAvatar);
                var size = (tempAvatar.length / 1024).toFixed(0);
                _notify('💾 头像已保存 (' + size + ' KB)', 'success', 1500);
            }
            if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
            var avatarModal = document.getElementById('avatar-settings-modal');
            if (avatarModal) avatarModal.parentNode && avatarModal.parentNode.removeChild(avatarModal);
            showAvatarSettings();
            var container = document.getElementById('moments-content');
            var activeTab = document.querySelector('.moments-tab.active');
            if (container && activeTab) renderTab(activeTab.dataset.tab, container);
            _notify('信息已更新 ✨', 'success');
        };
    }

    // =============================================
    // 编辑成员（带头像压缩）
    // =============================================
    function editMember(name) {
        var old = document.getElementById('edit-member-modal');
        if (old) old.parentNode && old.parentNode.removeChild(old);

        var members = _getGroupMembers();
        var member = null;
        for (var i = 0; i < members.length; i++) {
            if (members[i].name === name) { member = members[i]; break; }
        }
        if (!member) { _notify('成员不存在', 'error'); return; }

        var wrap = document.createElement('div');
        wrap.id = 'edit-member-modal';
        wrap.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:10057;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';

        var inner = document.createElement('div');
        inner.style.cssText = 'background:var(--primary-bg, #fff);border-radius:20px;padding:24px;width:340px;max-width:90%;border:1px solid var(--border-color, #ddd);max-height:90%;overflow-y:auto;';
        inner.innerHTML =
            '<div style="display:flex;justify-content:space-between;margin-bottom:16px;">' +
                '<span style="font-size:18px;font-weight:700;color:var(--text-primary, #222);">✏️ 编辑成员</span>' +
                '<button id="edit-member-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-secondary, #999);-webkit-tap-highlight-color:transparent;">✕</button>' +
            '</div>' +
            '<div style="display:flex;flex-direction:column;align-items:center;gap:12px;margin-bottom:16px;">' +
                '<div style="width:64px;height:64px;border-radius:50%;overflow:hidden;border:2px solid var(--border-color, #ddd);display:flex;align-items:center;justify-content:center;background:var(--secondary-bg, #f5f5f5);position:relative;cursor:pointer;" onclick="document.getElementById(\'edit-member-avatar-input\').click()">' +
                    (member.avatar ? '<img id="edit-member-avatar-preview" src="' + _esc(member.avatar) + '" style="width:100%;height:100%;object-fit:cover;">' : '<span id="edit-member-avatar-preview" style="font-size:28px;">🌸</span>') +
                    '<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.5);color:#fff;font-size:9px;text-align:center;padding:2px 0;">点击更换</div>' +
                '</div>' +
                '<input type="file" id="edit-member-avatar-input" accept="image/*" style="display:none;">' +
                '<div style="width:100%;">' +
                    '<label style="font-size:12px;color:var(--text-secondary, #999);display:block;margin-bottom:4px;">昵称</label>' +
                    '<input id="edit-member-name-input" type="text" value="' + _esc(member.name) + '" maxlength="12" style="width:100%;padding:10px;border:1px solid var(--border-color, #ddd);border-radius:10px;background:var(--secondary-bg, #f5f5f5);color:var(--text-primary, #222);font-size:14px;box-sizing:border-box;font-family:var(--font-family, sans-serif);">' +
                '</div>' +
                '<div style="width:100%;display:flex;gap:8px;">' +
                    '<button onclick="document.getElementById(\'edit-member-avatar-url-input\').style.display=\'block\'" style="flex:1;padding:6px;border:1px dashed var(--border-color, #ddd);border-radius:8px;background:transparent;color:var(--text-secondary, #999);font-size:11px;cursor:pointer;-webkit-tap-highlight-color:transparent;">🔗 图片URL</button>' +
                    '<input id="edit-member-avatar-url-input" type="text" placeholder="输入图片URL" style="display:none;flex:1;padding:6px 10px;border:1px solid var(--border-color, #ddd);border-radius:8px;background:var(--secondary-bg, #f5f5f5);color:var(--text-primary, #222);font-size:11px;box-sizing:border-box;font-family:var(--font-family, sans-serif);">' +
                '</div>' +
            '</div>' +
            '<div style="display:flex;gap:10px;">' +
                '<button id="edit-member-cancel" style="flex:1;padding:10px;border:1px solid var(--border-color, #ddd);border-radius:12px;background:var(--secondary-bg, #f5f5f5);color:var(--text-secondary, #666);font-size:13px;cursor:pointer;-webkit-tap-highlight-color:transparent;">取消</button>' +
                '<button id="edit-member-save" style="flex:2;padding:10px;border:none;border-radius:12px;background:var(--accent-color, #000);color:#fff;font-weight:700;font-size:13px;cursor:pointer;-webkit-tap-highlight-color:transparent;">保存</button>' +
            '</div>';

        wrap.appendChild(inner);
        document.body.appendChild(wrap);

        var tempAvatar = member.avatar || '';

        document.getElementById('edit-member-close').onclick = function() { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); };
        document.getElementById('edit-member-cancel').onclick = function() { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); };
        wrap.onclick = function(e) { if (e.target === wrap) { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); } };

        // 成员头像上传压缩
        document.getElementById('edit-member-avatar-input').onchange = function(e) {
            var file = e.target.files[0];
            if (!file) return;

            if (file.size < 30 * 1024) {
                var reader = new FileReader();
                reader.onload = function(ev) {
                    tempAvatar = ev.target.result;
                    var preview = document.getElementById('edit-member-avatar-preview');
                    if (preview) {
                        if (preview.tagName === 'IMG') preview.src = ev.target.result;
                        else preview.innerHTML = '<img src="' + ev.target.result + '" style="width:100%;height:100%;object-fit:cover;">';
                    }
                };
                reader.readAsDataURL(file);
                return;
            }

            var reader = new FileReader();
            reader.onload = function(ev) {
                var img = new Image();
                img.onload = function() {
                    var canvas = document.createElement('canvas');
                    var maxSize = 200;
                    var w = img.width, h = img.height;
                    if (w > maxSize || h > maxSize) {
                        var ratio = Math.min(maxSize / w, maxSize / h);
                        w = Math.round(w * ratio);
                        h = Math.round(h * ratio);
                    }
                    canvas.width = w;
                    canvas.height = h;
                    var ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    var compressed = canvas.toDataURL('image/jpeg', 0.5);
                    tempAvatar = compressed;
                    var preview = document.getElementById('edit-member-avatar-preview');
                    if (preview) {
                        if (preview.tagName === 'IMG') preview.src = compressed;
                        else preview.innerHTML = '<img src="' + compressed + '" style="width:100%;height:100%;object-fit:cover;">';
                    }
                    _notify('✅ 头像已压缩', 'success', 1500);
                };
                img.onerror = function() {
                    tempAvatar = ev.target.result;
                    var preview = document.getElementById('edit-member-avatar-preview');
                    if (preview) {
                        if (preview.tagName === 'IMG') preview.src = ev.target.result;
                        else preview.innerHTML = '<img src="' + ev.target.result + '" style="width:100%;height:100%;object-fit:cover;">';
                    }
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        };

        document.getElementById('edit-member-avatar-url-input').addEventListener('change', function() {
            var url = this.value.trim();
            if (url) {
                tempAvatar = url;
                var preview = document.getElementById('edit-member-avatar-preview');
                if (preview) {
                    if (preview.tagName === 'IMG') preview.src = url;
                    else preview.innerHTML = '<img src="' + url + '" style="width:100%;height:100%;object-fit:cover;">';
                }
            }
        });

        document.getElementById('edit-member-save').onclick = function() {
            var newName = document.getElementById('edit-member-name-input').value.trim();
            if (!newName) { _notify('请输入昵称', 'warning'); return; }
            var oldName = member.name;
            if (oldName !== newName) {
                _updateMemberName(oldName, newName);
            }
            if (tempAvatar) _setMemberAvatar(newName, tempAvatar);
            if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
            var avatarModal = document.getElementById('avatar-settings-modal');
            if (avatarModal) avatarModal.parentNode && avatarModal.parentNode.removeChild(avatarModal);
            showAvatarSettings();
            var container = document.getElementById('moments-content');
            var activeTab = document.querySelector('.moments-tab.active');
            if (container && activeTab) renderTab(activeTab.dataset.tab, container);
            _notify('成员已更新 ✨', 'success');
        };
    }

    // =============================================
    // 添加成员（带头像压缩）
    // =============================================
    function addMember() {
        var old = document.getElementById('add-member-modal');
        if (old) old.parentNode && old.parentNode.removeChild(old);

        var wrap = document.createElement('div');
        wrap.id = 'add-member-modal';
        wrap.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:10058;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';

        var inner = document.createElement('div');
        inner.style.cssText = 'background:var(--primary-bg, #fff);border-radius:20px;padding:24px;width:340px;max-width:90%;border:1px solid var(--border-color, #ddd);max-height:90%;overflow-y:auto;';
        inner.innerHTML =
            '<div style="display:flex;justify-content:space-between;margin-bottom:16px;">' +
                '<span style="font-size:18px;font-weight:700;color:var(--text-primary, #222);">➕ 添加成员</span>' +
                '<button id="add-member-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-secondary, #999);-webkit-tap-highlight-color:transparent;">✕</button>' +
            '</div>' +
            '<div style="display:flex;flex-direction:column;align-items:center;gap:12px;margin-bottom:16px;">' +
                '<div style="width:64px;height:64px;border-radius:50%;overflow:hidden;border:2px dashed var(--border-color, #ddd);display:flex;align-items:center;justify-content:center;background:var(--secondary-bg, #f5f5f5);cursor:pointer;position:relative;" onclick="document.getElementById(\'add-member-avatar-input\').click()">' +
                    '<span id="add-member-avatar-preview" style="font-size:28px;color:var(--text-secondary, #999);">+</span>' +
                    '<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.5);color:#fff;font-size:9px;text-align:center;padding:2px 0;">点击上传头像</div>' +
                '</div>' +
                '<input type="file" id="add-member-avatar-input" accept="image/*" style="display:none;">' +
                '<div style="width:100%;">' +
                    '<label style="font-size:12px;color:var(--text-secondary, #999);display:block;margin-bottom:4px;">成员名字</label>' +
                    '<input id="add-member-name-input" type="text" placeholder="输入名字" maxlength="12" style="width:100%;padding:10px;border:1px solid var(--border-color, #ddd);border-radius:10px;background:var(--secondary-bg, #f5f5f5);color:var(--text-primary, #222);font-size:14px;box-sizing:border-box;font-family:var(--font-family, sans-serif);">' +
                '</div>' +
                '<div style="width:100%;display:flex;gap:8px;">' +
                    '<button onclick="document.getElementById(\'add-member-avatar-url-input\').style.display=\'block\'" style="flex:1;padding:6px;border:1px dashed var(--border-color, #ddd);border-radius:8px;background:transparent;color:var(--text-secondary, #999);font-size:11px;cursor:pointer;-webkit-tap-highlight-color:transparent;">🔗 图片URL</button>' +
                    '<input id="add-member-avatar-url-input" type="text" placeholder="输入图片URL" style="display:none;flex:1;padding:6px 10px;border:1px solid var(--border-color, #ddd);border-radius:8px;background:var(--secondary-bg, #f5f5f5);color:var(--text-primary, #222);font-size:11px;box-sizing:border-box;font-family:var(--font-family, sans-serif);">' +
                '</div>' +
            '</div>' +
            '<div style="display:flex;gap:10px;">' +
                '<button id="add-member-cancel" style="flex:1;padding:10px;border:1px solid var(--border-color, #ddd);border-radius:12px;background:var(--secondary-bg, #f5f5f5);color:var(--text-secondary, #666);font-size:13px;cursor:pointer;-webkit-tap-highlight-color:transparent;">取消</button>' +
                '<button id="add-member-save" style="flex:2;padding:10px;border:none;border-radius:12px;background:var(--accent-color, #000);color:#fff;font-weight:700;font-size:13px;cursor:pointer;-webkit-tap-highlight-color:transparent;">保存</button>' +
            '</div>';

        wrap.appendChild(inner);
        document.body.appendChild(wrap);

        var tempAvatar = '';

        document.getElementById('add-member-close').onclick = function() { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); };
        document.getElementById('add-member-cancel').onclick = function() { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); };
        wrap.onclick = function(e) { if (e.target === wrap) { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); } };

        document.getElementById('add-member-avatar-input').onchange = function(e) {
            var file = e.target.files[0];
            if (!file) return;

            if (file.size < 30 * 1024) {
                var reader = new FileReader();
                reader.onload = function(ev) {
                    tempAvatar = ev.target.result;
                    var preview = document.getElementById('add-member-avatar-preview');
                    if (preview) preview.innerHTML = '<img src="' + ev.target.result + '" style="width:100%;height:100%;object-fit:cover;">';
                };
                reader.readAsDataURL(file);
                return;
            }

            var reader = new FileReader();
            reader.onload = function(ev) {
                var img = new Image();
                img.onload = function() {
                    var canvas = document.createElement('canvas');
                    var maxSize = 200;
                    var w = img.width, h = img.height;
                    if (w > maxSize || h > maxSize) {
                        var ratio = Math.min(maxSize / w, maxSize / h);
                        w = Math.round(w * ratio);
                        h = Math.round(h * ratio);
                    }
                    canvas.width = w;
                    canvas.height = h;
                    var ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    var compressed = canvas.toDataURL('image/jpeg', 0.5);
                    tempAvatar = compressed;
                    var preview = document.getElementById('add-member-avatar-preview');
                    if (preview) preview.innerHTML = '<img src="' + compressed + '" style="width:100%;height:100%;object-fit:cover;">';
                    _notify('✅ 头像已压缩', 'success', 1500);
                };
                img.onerror = function() {
                    tempAvatar = ev.target.result;
                    var preview = document.getElementById('add-member-avatar-preview');
                    if (preview) preview.innerHTML = '<img src="' + ev.target.result + '" style="width:100%;height:100%;object-fit:cover;">';
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        };

        document.getElementById('add-member-avatar-url-input').addEventListener('change', function() {
            var url = this.value.trim();
            if (url) {
                tempAvatar = url;
                var preview = document.getElementById('add-member-avatar-preview');
                if (preview) preview.innerHTML = '<img src="' + url + '" style="width:100%;height:100%;object-fit:cover;">';
            }
        });

        document.getElementById('add-member-save').onclick = function() {
            var name = document.getElementById('add-member-name-input').value.trim();
            if (!name) { _notify('请输入成员名字', 'warning'); return; }
            var members = _getGroupMembers();
            for (var i = 0; i < members.length; i++) {
                if (members[i].name === name) {
                    _notify('成员已存在', 'warning');
                    return;
                }
            }
            _addGroupMember(name, tempAvatar);
            if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
            var avatarModal = document.getElementById('avatar-settings-modal');
            if (avatarModal) avatarModal.parentNode && avatarModal.parentNode.removeChild(avatarModal);
            showAvatarSettings();
            var container = document.getElementById('moments-content');
            var activeTab = document.querySelector('.moments-tab.active');
            if (container && activeTab) renderTab(activeTab.dataset.tab, container);
            _notify('成员已添加 ✨', 'success');
        };
    }

    function removeMember(name) {
        if (!confirm('确定要删除成员 "' + name + '" 吗？\n该成员的所有动态也将被删除。')) return;
        _removeGroupMember(name);
        var avatarModal = document.getElementById('avatar-settings-modal');
        if (avatarModal) avatarModal.parentNode && avatarModal.parentNode.removeChild(avatarModal);
        showAvatarSettings();
        var container = document.getElementById('moments-content');
        var activeTab = document.querySelector('.moments-tab.active');
        if (container && activeTab) renderTab(activeTab.dataset.tab, container);
        _notify('成员已删除', 'info');
    }

    function showReplyModal(postId, commentId) {
        var old = document.getElementById('reply-modal');
        if (old) old.parentNode && old.parentNode.removeChild(old);

        var wrap = document.createElement('div');
        wrap.id = 'reply-modal';
        wrap.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:10035;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';
        var inner = document.createElement('div');
        inner.style.cssText = 'background:var(--primary-bg, #fff);border-radius:20px;padding:24px;width:340px;max-width:90%;border:1px solid var(--border-color, #ddd);max-height:90%;overflow-y:auto;';
        inner.innerHTML = '<div style="display:flex;justify-content:space-between;margin-bottom:14px;">' +
            '<span style="font-size:18px;font-weight:700;color:var(--text-primary, #222);">💬 回复</span>' +
            '<button id="reply-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-secondary, #999);-webkit-tap-highlight-color:transparent;">✕</button>' +
            '</div>' +
            '<textarea id="reply-text" rows="3" placeholder="写下你的回复..." style="width:100%;padding:10px;border:1px solid var(--border-color, #ddd);border-radius:12px;background:var(--secondary-bg, #f5f5f5);color:var(--text-primary, #222);font-size:14px;resize:vertical;box-sizing:border-box;font-family:var(--font-family, sans-serif);-webkit-appearance:none;"></textarea>' +
            '<div style="display:flex;gap:10px;margin-top:12px;">' +
            '<button id="reply-cancel" style="flex:1;padding:10px;border:1px solid var(--border-color, #ddd);border-radius:12px;background:var(--secondary-bg, #f5f5f5);color:var(--text-secondary, #666);cursor:pointer;font-family:var(--font-family, sans-serif);-webkit-tap-highlight-color:transparent;">取消</button>' +
            '<button id="reply-submit" style="flex:2;padding:10px;border:none;border-radius:12px;background:var(--accent-color, #000);color:#fff;font-weight:700;cursor:pointer;font-family:var(--font-family, sans-serif);-webkit-tap-highlight-color:transparent;">发送</button>' +
            '</div>';
        wrap.appendChild(inner);
        document.body.appendChild(wrap);

        var close = function() { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); };
        document.getElementById('reply-close').onclick = close;
        document.getElementById('reply-cancel').onclick = close;
        wrap.onclick = function(e) { if (e.target === wrap) close(); };

        document.getElementById('reply-submit').onclick = function() {
            var text = document.getElementById('reply-text').value.trim();
            if (!text) { _notify('请输入回复内容', 'warning'); return; }
            
            var data = _getData();
            var post = data.posts.find(function(p) { return p.id === postId; });
            if (!post) { _notify('帖子不存在', 'error'); return; }
            
            var comment = post.comments.find(function(c) { return c.id === commentId; });
            if (!comment) { _notify('评论不存在', 'error'); return; }
            
            if (comment.author === 'partner' && !comment.replied) {
                comment.reply = {
                    text: text,
                    timestamp: new Date().toISOString(),
                    authorName: _getMyNameSetting()
                };
                comment.replied = true;
                _setData(data);
                close();
                _refreshUI();
                _notify('回复已发送', 'success');
                _schedulePartnerInteraction(postId, 'reply', commentId);
                return;
            }
            
            comment.reply = {
                text: text,
                timestamp: new Date().toISOString(),
                authorName: _getMyNameSetting()
            };
            comment.replied = true;
            _setData(data);
            close();
            _refreshUI();
            _notify('回复已发送', 'success');
        };
    }

    function renderTab(tab, container) {
        var posts = _getPosts();
        var filtered = [];
        for (var i = 0; i < posts.length; i++) {
            if (posts[i].author === tab) filtered.push(posts[i]);
        }
        if (filtered.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text-secondary, #999);">' +
                '<div style="font-size:48px;margin-bottom:16px;">📭</div>' +
                '<div style="font-size:15px;font-weight:500;">还没有动态</div>' +
                '<div style="font-size:13px;opacity:0.6;margin-top:4px;">' + (tab === 'me' ? '点击右下角 + 发布你的第一条吧' : '成员们还没有发过动态哦') + '</div>' +
                '</div>';
            return;
        }

        var html = '';
        for (var pi = 0; pi < filtered.length; pi++) {
            var post = filtered[pi];
            var isMe = post.author === 'me';
            var name, avatarHtml;

            if (isMe) {
                name = _getMyNameSetting();
                var myAvatar = _getMyAvatarSetting();
                if (myAvatar) {
                    avatarHtml = '<img src="' + _esc(myAvatar) + '" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:1px solid var(--border-color, #eee);">';
                } else {
                    avatarHtml = '👤';
                }
            } else {
                name = post.memberName || _getPartnerName();
                var memberAvatar = _getMemberAvatar(name);
                var finalAvatar = memberAvatar || post.memberAvatar || '';
                if (finalAvatar) {
                    avatarHtml = '<img src="' + _esc(finalAvatar) + '" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:1px solid var(--border-color, #eee);">';
                } else {
                    avatarHtml = '🌸';
                }
            }
            var time = formatTime(post.timestamp);
            var commentCount = post.comments.length;

            html += '<div class="moments-post" data-id="' + post.id + '" style="background:rgba(255,255,255,0.85);border-radius:16px;padding:16px 16px 12px;margin-bottom:14px;border:1px solid rgba(0,0,0,0.06);box-shadow:0 1px 4px rgba(0,0,0,0.04);">' +
                '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">' +
                    '<span style="font-size:20px;display:flex;align-items:center;justify-content:center;width:36px;height:36px;flex-shrink:0;">' + avatarHtml + '</span>' +
                    '<span style="font-weight:600;color:var(--text-primary, #222);font-size:15px;">' + _esc(name) + '</span>' +
                    '<span style="font-size:12px;color:var(--text-secondary, #999);margin-left:auto;">' + time + '</span>' +
                '</div>' +
                '<div style="font-size:16px;color:var(--text-primary, #222);margin:4px 0 12px;word-wrap:break-word;line-height:1.7;padding-left:2px;">' + _esc(post.text) + '</div>' +
                '<div style="display:flex;gap:20px;align-items:center;border-top:1px solid rgba(0,0,0,0.06);padding-top:10px;">' +
                    '<button class="moments-like-btn" data-id="' + post.id + '" style="background:none;border:none;color:' + (post.likedByMe ? 'var(--accent-color, #000)' : 'var(--text-secondary, #999)') + ';font-size:14px;cursor:pointer;padding:4px 8px;border-radius:12px;display:flex;align-items:center;gap:4px;' + (post.likedByMe ? 'background:rgba(var(--accent-color-rgb, 0,0,0),0.08);' : '') + '-webkit-tap-highlight-color:transparent;">' +
                        (post.likedByMe ? '❤️' : '🤍') + ' <span>' + post.likes + '</span>' +
                    '</button>' +
                    '<button class="moments-comment-btn" data-id="' + post.id + '" style="background:none;border:none;color:var(--text-secondary, #999);font-size:14px;cursor:pointer;padding:4px 8px;border-radius:12px;display:flex;align-items:center;gap:4px;-webkit-tap-highlight-color:transparent;">' +
                        '💬 <span>' + commentCount + '</span>' +
                    '</button>' +
                    (isMe ? '<button class="moments-delete-btn" data-id="' + post.id + '" style="background:none;border:none;color:#ff6b6b;font-size:13px;cursor:pointer;padding:4px 8px;border-radius:12px;margin-left:auto;-webkit-tap-highlight-color:transparent;">🗑️</button>' : '') +
                '</div>' +
                (post.comments.length > 0 ? '<div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(0,0,0,0.06);">' : '');

            for (var ci = 0; ci < post.comments.length; ci++) {
                var c = post.comments[ci];
                var cName = c.author === 'me' ? _getMyNameSetting() : (c.authorName || _getPartnerName());
                var cAvatar = c.author === 'me' ? '👤' : '🌸';
                var cTime = formatTime(c.timestamp);

                html += '<div style="margin-bottom:8px;padding:4px 0;">' +
                    '<div style="display:flex;align-items:flex-start;gap:4px;flex-wrap:wrap;">' +
                        '<span style="font-weight:600;font-size:13px;color:var(--text-primary, #222);">' + cAvatar + ' ' + _esc(cName) + '</span> ' +
                        '<span style="color:var(--text-primary, #222);font-size:13px;">' + _esc(c.text) + '</span> ' +
                        '<span style="font-size:10px;color:var(--text-secondary, #999);">' + cTime + '</span>' +
                        '<button class="moments-reply-to-comment" data-postid="' + post.id + '" data-commentid="' + c.id + '" style="background:none;border:none;color:var(--accent-color, #000);font-size:11px;cursor:pointer;padding:0 4px;opacity:0.6;-webkit-tap-highlight-color:transparent;">回复</button>' +
                    '</div>';

                if (c.reply) {
                    var replyName = c.reply.authorName || _getPartnerName();
                    html += '<div style="margin-left:20px;margin-top:2px;padding:6px 12px;background:rgba(var(--accent-color-rgb, 0,0,0),0.05);border-radius:8px;border-left:2px solid rgba(var(--accent-color-rgb, 0,0,0),0.2);font-size:13px;color:var(--text-secondary, #999);">' +
                        '<span style="font-weight:500;color:var(--text-primary, #222);">🌸 ' + _esc(replyName) + '</span> ' +
                        '<span style="color:var(--text-primary, #222);">' + _esc(c.reply.text) + '</span> ' +
                        '<span style="font-size:10px;color:var(--text-secondary, #999);">' + formatTime(c.reply.timestamp) + '</span>' +
                        '</div>';
                }
                html += '</div>';
            }

            if (post.comments.length > 0) {
                html += '</div>';
            }
            html += '</div>';
        }

        container.innerHTML = html;

        container.querySelectorAll('.moments-like-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var id = this.dataset.id;
                _toggleLike(id);
                var activeTab = document.querySelector('.moments-tab.active');
                if (activeTab) renderTab(activeTab.dataset.tab, container);
            });
        });

        container.querySelectorAll('.moments-comment-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var postId = this.dataset.id;
                showCommentModal(postId);
            });
        });

        container.querySelectorAll('.moments-reply-to-comment').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var postId = this.dataset.postid;
                var commentId = this.dataset.commentid;
                showReplyModal(postId, commentId);
            });
        });

        container.querySelectorAll('.moments-delete-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var id = this.dataset.id;
                if (confirm('确定要删除这条动态吗？')) {
                    _deletePost(id);
                    var activeTab = document.querySelector('.moments-tab.active');
                    if (activeTab) renderTab(activeTab.dataset.tab, container);
                    _notify('已删除', 'info');
                }
            });
        });
    }

    function showPublishModal() {
        var old = document.getElementById('publish-modal');
        if (old) old.parentNode && old.parentNode.removeChild(old);

        var wrap = document.createElement('div');
        wrap.id = 'publish-modal';
        wrap.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:10020;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';
        var inner = document.createElement('div');
        inner.style.cssText = 'background:var(--primary-bg, #fff);border-radius:20px;padding:24px;width:340px;max-width:90%;border:1px solid var(--border-color, #ddd);max-height:90%;overflow-y:auto;';
        inner.innerHTML = '<div style="display:flex;justify-content:space-between;margin-bottom:14px;">' +
            '<span style="font-size:18px;font-weight:700;color:var(--text-primary, #222);">📝 发布新动态</span>' +
            '<button id="publish-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-secondary, #999);-webkit-tap-highlight-color:transparent;">✕</button>' +
            '</div>' +
            '<textarea id="publish-text" rows="4" placeholder="此刻的想法..." style="width:100%;padding:10px;border:1px solid var(--border-color, #ddd);border-radius:12px;background:var(--secondary-bg, #f5f5f5);color:var(--text-primary, #222);font-size:14px;resize:vertical;box-sizing:border-box;font-family:var(--font-family, sans-serif);-webkit-appearance:none;"></textarea>' +
            '<div style="display:flex;gap:10px;margin-top:12px;">' +
            '<button id="publish-cancel" style="flex:1;padding:10px;border:1px solid var(--border-color, #ddd);border-radius:12px;background:var(--secondary-bg, #f5f5f5);color:var(--text-secondary, #666);cursor:pointer;font-family:var(--font-family, sans-serif);-webkit-tap-highlight-color:transparent;">取消</button>' +
            '<button id="publish-submit" style="flex:2;padding:10px;border:none;border-radius:12px;background:var(--accent-color, #000);color:#fff;font-weight:700;cursor:pointer;font-family:var(--font-family, sans-serif);-webkit-tap-highlight-color:transparent;">发布</button>' +
            '</div>';
        wrap.appendChild(inner);
        document.body.appendChild(wrap);

        var close = function() { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); };
        document.getElementById('publish-close').onclick = close;
        document.getElementById('publish-cancel').onclick = close;
        wrap.onclick = function(e) { if (e.target === wrap) close(); };

        document.getElementById('publish-submit').onclick = function() {
            var text = document.getElementById('publish-text').value.trim();
            if (!text) { _notify('请输入内容', 'warning'); return; }
            var post = _addPost('me', text);
            close();
            var container = document.getElementById('moments-content');
            var activeTab = document.querySelector('.moments-tab.active');
            if (container && activeTab) renderTab(activeTab.dataset.tab, container);
            _notify('发布成功 ✨', 'success');
            
            var postId = post.id;
            setTimeout(function() {
                _schedulePartnerInteraction(postId, 'like');
            }, 60000 + Math.random() * 120000);
            setTimeout(function() {
                _schedulePartnerInteraction(postId, 'comment');
            }, 180000 + Math.random() * 120000);
            setTimeout(function() {
                _schedulePartnerInteraction(postId, 'comment');
            }, 240000 + Math.random() * 180000);
        };
    }

    function showCommentModal(postId) {
        var old = document.getElementById('comment-modal');
        if (old) old.parentNode && old.parentNode.removeChild(old);

        var wrap = document.createElement('div');
        wrap.id = 'comment-modal';
        wrap.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:10030;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';
        var inner = document.createElement('div');
        inner.style.cssText = 'background:var(--primary-bg, #fff);border-radius:20px;padding:24px;width:340px;max-width:90%;border:1px solid var(--border-color, #ddd);max-height:90%;overflow-y:auto;';
        inner.innerHTML = '<div style="display:flex;justify-content:space-between;margin-bottom:14px;">' +
            '<span style="font-size:18px;font-weight:700;color:var(--text-primary, #222);">💬 评论</span>' +
            '<button id="comment-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-secondary, #999);-webkit-tap-highlight-color:transparent;">✕</button>' +
            '</div>' +
            '<textarea id="comment-text" rows="3" placeholder="写下你的评论..." style="width:100%;padding:10px;border:1px solid var(--border-color, #ddd);border-radius:12px;background:var(--secondary-bg, #f5f5f5);color:var(--text-primary, #222);font-size:14px;resize:vertical;box-sizing:border-box;font-family:var(--font-family, sans-serif);-webkit-appearance:none;"></textarea>' +
            '<div style="display:flex;gap:10px;margin-top:12px;">' +
            '<button id="comment-cancel" style="flex:1;padding:10px;border:1px solid var(--border-color, #ddd);border-radius:12px;background:var(--secondary-bg, #f5f5f5);color:var(--text-secondary, #666);cursor:pointer;font-family:var(--font-family, sans-serif);-webkit-tap-highlight-color:transparent;">取消</button>' +
            '<button id="comment-submit" style="flex:2;padding:10px;border:none;border-radius:12px;background:var(--accent-color, #000);color:#fff;font-weight:700;cursor:pointer;font-family:var(--font-family, sans-serif);-webkit-tap-highlight-color:transparent;">发送</button>' +
            '</div>';
        wrap.appendChild(inner);
        document.body.appendChild(wrap);

        var close = function() { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); };
        document.getElementById('comment-close').onclick = close;
        document.getElementById('comment-cancel').onclick = close;
        wrap.onclick = function(e) { if (e.target === wrap) close(); };

        document.getElementById('comment-submit').onclick = function() {
            var text = document.getElementById('comment-text').value.trim();
            if (!text) { _notify('请输入评论', 'warning'); return; }

            var data = _getData();
            var post = data.posts.find(function(p) { return p.id === postId; });
            if (!post) { _notify('帖子不存在', 'error'); return; }

            var comment = {
                id: _generateId(),
                author: 'me',
                authorName: _getMyNameSetting(),
                text: text,
                timestamp: new Date().toISOString(),
                reply: null,
                replied: false
            };
            post.comments.push(comment);
            _setData(data);

            close();
            var container = document.getElementById('moments-content');
            var activeTab = document.querySelector('.moments-tab.active');
            if (container && activeTab) renderTab(activeTab.dataset.tab, container);
            _notify('评论已发送', 'success');

            if (post.author === 'partner') {
                var commentId = comment.id;
                setTimeout(function() {
                    _schedulePartnerInteraction(postId, 'reply', commentId);
                }, 120000 + Math.random() * 120000);
            }
        };
    }

    // =============================================
    // 朋友圈主界面
    // =============================================
    window.openMoments = function() {
        try {
            var existingModal = document.getElementById('moments-modal');
            if (existingModal && existingModal.parentNode) {
                existingModal.parentNode.removeChild(existingModal);
            }

            _forceGeneratePartnerPosts();

            var wrap = document.createElement('div');
            wrap.id = 'moments-modal';
            wrap.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:10010;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);';

            var inner = document.createElement('div');
            inner.style.cssText = 'background:var(--primary-bg, #fff);border-radius:20px;padding:0;width:420px;max-width:94%;max-height:85%;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.3);border:1px solid var(--border-color, rgba(0,0,0,0.1));';

            var coverUrl = _getCoverImage();
            var defaultCover = 'linear-gradient(135deg, #2d1b3d 0%, #1a1a2e 50%, #16213e 100%)';
            var coverStyle = coverUrl ? 'url(' + coverUrl + ')' : defaultCover;

            var coverSection = document.createElement('div');
            coverSection.id = 'moments-cover';
            coverSection.style.cssText = 'position:relative;width:100%;height:160px;background:' + coverStyle + ';background-size:cover;background-position:center;flex-shrink:0;cursor:pointer;-webkit-tap-highlight-color:transparent;';

            var coverText = document.createElement('div');
            coverText.style.cssText = 'position:absolute;bottom:16px;left:18px;right:18px;color:rgba(255,255,255,0.95);text-shadow:0 2px 16px rgba(0,0,0,0.4);';
            coverText.innerHTML =
                '<div style="font-size:17px;font-weight:300;letter-spacing:2px;font-style:italic;line-height:1.5;">誓言是一场有时差的雨。</div>' +
                '<div style="font-size:11px;opacity:0.6;margin-top:2px;letter-spacing:1.5px;font-weight:300;">— Vow is a rain with time difference.</div>';
            coverSection.appendChild(coverText);

            var coverBtnHint = document.createElement('div');
            coverBtnHint.style.cssText = 'position:absolute;top:12px;right:14px;background:rgba(0,0,0,0.45);padding:4px 12px;border-radius:14px;font-size:11px;color:rgba(255,255,255,0.85);pointer-events:none;';
            coverBtnHint.textContent = '📷 更换封面';
            coverSection.appendChild(coverBtnHint);

            coverSection.addEventListener('click', function(e) {
                e.stopPropagation();
                showCoverSettings();
            });

            inner.appendChild(coverSection);

            var header = document.createElement('div');
            header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:14px 18px 10px;border-bottom:1px solid var(--border-color, #eee);flex-shrink:0;background:var(--primary-bg, #fff);';

            var leftSection = document.createElement('div');
            leftSection.style.cssText = 'display:flex;align-items:center;gap:8px;';
            var backBtn = document.createElement('button');
            backBtn.style.cssText = 'background:none;border:none;font-size:24px;font-weight:bold;color:var(--text-secondary, #666);cursor:pointer;padding:4px;border-radius:8px;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;';
            backBtn.textContent = '‹';
            backBtn.onclick = function() { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); };
            leftSection.appendChild(backBtn);

            var titleSpan = document.createElement('span');
            titleSpan.style.cssText = 'font-size:17px;font-weight:700;color:var(--text-primary, #222);';
            titleSpan.textContent = '📱 朋友圈';
            leftSection.appendChild(titleSpan);
            header.appendChild(leftSection);

            var rightSection = document.createElement('div');
            rightSection.style.cssText = 'display:flex;gap:6px;align-items:center;';

            var avatarBtn = document.createElement('button');
            avatarBtn.style.cssText = 'background:none;border:none;font-size:16px;color:var(--text-secondary, #666);cursor:pointer;padding:4px 6px;border-radius:8px;-webkit-tap-highlight-color:transparent;';
            avatarBtn.innerHTML = '👤';
            avatarBtn.title = '头像与昵称';
            avatarBtn.onclick = function(e) {
                e.stopPropagation();
                showAvatarSettings();
            };
            rightSection.appendChild(avatarBtn);

            var bgBtn = document.createElement('button');
            bgBtn.style.cssText = 'background:none;border:none;font-size:14px;color:var(--text-secondary, #666);cursor:pointer;padding:4px 6px;border-radius:8px;-webkit-tap-highlight-color:transparent;';
            bgBtn.innerHTML = '🖼️';
            bgBtn.title = '更换封面';
            bgBtn.onclick = function(e) {
                e.stopPropagation();
                showCoverSettings();
            };
            rightSection.appendChild(bgBtn);
            header.appendChild(rightSection);
            inner.appendChild(header);

            var tabBar = document.createElement('div');
            tabBar.style.cssText = 'display:flex;border-bottom:1px solid var(--border-color, #eee);flex-shrink:0;background:var(--primary-bg, #fff);padding:0 16px;';
            tabBar.innerHTML = '<button class="moments-tab active" data-tab="me" style="flex:1;padding:12px 4px 10px;border:none;background:transparent;font-weight:600;color:var(--text-primary, #222);cursor:pointer;font-size:14px;position:relative;border-bottom:2px solid var(--accent-color, #000);-webkit-tap-highlight-color:transparent;font-family:var(--font-family, sans-serif);">我的</button>' +
                '<button class="moments-tab" data-tab="partner" style="flex:1;padding:12px 4px 10px;border:none;background:transparent;font-weight:400;color:var(--text-secondary, #999);cursor:pointer;font-size:14px;position:relative;border-bottom:2px solid transparent;-webkit-tap-highlight-color:transparent;font-family:var(--font-family, sans-serif);">群成员</button>';
            inner.appendChild(tabBar);

            var contentContainer = document.createElement('div');
            contentContainer.id = 'moments-content';
            contentContainer.style.cssText = 'flex:1;overflow-y:auto;padding:12px 16px 16px;background:var(--secondary-bg, #f5f5f5);-webkit-overflow-scrolling:touch;';

            renderTab('me', contentContainer);
            inner.appendChild(contentContainer);

            var footer = document.createElement('div');
            footer.style.cssText = 'display:flex;justify-content:flex-end;padding:10px 16px 14px;border-top:1px solid var(--border-color, #eee);flex-shrink:0;background:var(--primary-bg, #fff);';
            var addBtn = document.createElement('button');
            addBtn.id = 'moments-add-btn';
            addBtn.style.cssText = 'width:38px;height:38px;border-radius:50%;background:var(--accent-color, #000);color:#fff;border:none;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,0.2);-webkit-tap-highlight-color:transparent;';
            addBtn.textContent = '+';
            addBtn.title = '发布新动态';
            addBtn.onclick = function() { showPublishModal(); };
            footer.appendChild(addBtn);
            inner.appendChild(footer);

            wrap.appendChild(inner);
            document.body.appendChild(wrap);

            wrap.addEventListener('click', function(e) {
                if (e.target === wrap && wrap.parentNode) {
                    wrap.parentNode.removeChild(wrap);
                }
            });

            tabBar.querySelectorAll('.moments-tab').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    tabBar.querySelectorAll('.moments-tab').forEach(function(b) {
                        b.classList.remove('active');
                        b.style.color = 'var(--text-secondary, #999)';
                        b.style.borderBottom = '2px solid transparent';
                        b.style.fontWeight = '400';
                    });
                    this.classList.add('active');
                    this.style.color = 'var(--text-primary, #222)';
                    this.style.borderBottom = '2px solid var(--accent-color, #000)';
                    this.style.fontWeight = '600';
                    var tab = this.dataset.tab;
                    renderTab(tab, contentContainer);
                    var addBtnEl = document.getElementById('moments-add-btn');
                    if (addBtnEl) addBtnEl.style.display = tab === 'me' ? 'flex' : 'none';
                });
            });

            var initialAddBtn = document.getElementById('moments-add-btn');
            if (initialAddBtn) initialAddBtn.style.display = 'flex';

        } catch(e) {
            alert('朋友圈加载失败: ' + e.message);
            console.error('[朋友圈] 错误:', e);
        }
    };

    window.openMoments = window.openMoments;
    window.showAvatarSettings = showAvatarSettings;
    window.editMyInfo = editMyInfo;
    window.editMember = editMember;
    window.addMember = addMember;
    window.removeMember = removeMember;
    window.partnerPublishPost = function(text, memberName) {
        if (!text || !text.trim()) return;
        var members = _getGroupMembers();
        var member = null;
        if (memberName) {
            for (var i = 0; i < members.length; i++) {
                if (members[i].name === memberName) {
                    member = members[i];
                    break;
                }
            }
        }
        if (!member && members.length > 0) {
            member = members[Math.floor(Math.random() * members.length)];
        }
        if (!member) {
            _notify('没有可用的群成员', 'warning');
            return;
        }
        var post = _addPost('partner', text, new Date().toISOString(), member.name, member.avatar);
        var container = document.getElementById('moments-content');
        var activeTab = document.querySelector('.moments-tab.active');
        if (container && activeTab) renderTab(activeTab.dataset.tab, container);
        _notify('📱 ' + member.name + ' 发布了新动态', 'success', 2000);
        return post;
    };
    window.forcePartnerPublish = _forceGeneratePartnerPosts;

    console.log('[朋友圈] 模块已加载（完整修复版 + 头像压缩）');
})();
