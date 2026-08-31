// moments.js - 朋友圈功能（与reply-library.js联动版）
(function() {
    'use strict';

    var STORAGE_KEY = 'moments_data';
    var COVER_KEY = 'moments_cover_image';
    var MAX_POSTS = 50;
    var PAGE_SIZE = 10;

    // =============================================
    // 🔥 从 reply-library.js 获取主字卡
    // =============================================
    function _getMainReplies() {
        var cards = [];
        
        // 1. 🔥 优先从 window.replyLibrary 读取（reply-library.js 暴露的）
        if (window.replyLibrary && Array.isArray(window.replyLibrary) && window.replyLibrary.length > 0) {
            cards = window.replyLibrary.map(function(item) {
                // 支持字符串或对象格式
                if (typeof item === 'string') return item;
                if (item && item.text) return item.text;
                if (item && item.label) return item.label;
                return '';
            }).filter(function(c) { return c && c.trim(); });
        }
        
        // 2. 从 localStorage 读取 replyLibrary
        if (cards.length === 0) {
            try {
                var stored = localStorage.getItem('replyLibrary');
                if (stored) {
                    var parsed = JSON.parse(stored);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        cards = parsed.map(function(item) {
                            if (typeof item === 'string') return item;
                            if (item && item.text) return item.text;
                            if (item && item.label) return item.label;
                            return '';
                        }).filter(function(c) { return c && c.trim(); });
                    }
                }
            } catch(e) {}
        }
        
        // 3. 从 window.customReplies 读取（兼容旧版）
        if (cards.length === 0 && window.customReplies && Array.isArray(window.customReplies) && window.customReplies.length > 0) {
            cards = window.customReplies.map(function(c) {
                return typeof c === 'string' ? c : (c.text || c.label || '');
            }).filter(function(c) { return c && c.trim(); });
        }
        
        // 4. 从 localStorage.customReplies 读取
        if (cards.length === 0) {
            try {
                var stored2 = localStorage.getItem('customReplies');
                if (stored2) {
                    var parsed2 = JSON.parse(stored2);
                    if (Array.isArray(parsed2) && parsed2.length > 0) {
                        cards = parsed2.map(function(c) {
                            return typeof c === 'string' ? c : (c.text || c.label || '');
                        }).filter(function(c) { return c && c.trim(); });
                    }
                }
            } catch(e) {}
        }
        
        // 5. 从 settings.replies 读取
        if (cards.length === 0 && typeof settings !== 'undefined' && settings.replies && Array.isArray(settings.replies)) {
            cards = settings.replies.filter(function(c) { return c && c.trim(); });
        }
        
        // 6. 尝试从页面元素读取
        if (cards.length === 0) {
            try {
                var replyCardsEl = document.querySelector('#reply-cards-container .reply-card, .reply-cards .card, .reply-item');
                if (replyCardsEl) {
                    var els = document.querySelectorAll('.reply-card, .card-item, .reply-item, .card-text');
                    els.forEach(function(el) {
                        var text = el.textContent.trim();
                        if (text && text.length > 0 && text.length < 50) {
                            cards.push(text);
                        }
                    });
                }
            } catch(e) {}
        }
        
        // 7. 最终兜底 - 使用一些常见的回复语
        if (cards.length === 0) {
            cards = ['想你', '抱抱', '亲亲', '开心', '好梦', '今天超棒', '别担心', '有我在', '早安', '晚安', '加油', '真棒'];
        }
        
        // 去重
        var result = [];
        for (var k = 0; k < cards.length; k++) {
            var c = cards[k];
            if (c && c.trim() && result.indexOf(c.trim()) === -1) {
                result.push(c.trim());
            }
        }
        
        return result;
    }

    // 🔥 监听 reply-library.js 的更新事件
    function _watchReplyLibraryUpdates() {
        // 如果 reply-library.js 有更新事件，监听它
        if (window.addEventListener) {
            window.addEventListener('replyLibraryUpdated', function() {
                console.log('[朋友圈] 检测到回复库更新，刷新数据');
                // 刷新当前显示的动态
                var container = document.getElementById('moments-content');
                var activeTab = document.querySelector('.moments-tab.active');
                if (container && activeTab) {
                    renderTab(activeTab.dataset.tab, container);
                }
            });
        }
        
        // 每隔30秒检查一次回复库是否变化（兜底）
        var lastReplies = JSON.stringify(_getMainReplies());
        setInterval(function() {
            var currentReplies = JSON.stringify(_getMainReplies());
            if (currentReplies !== lastReplies) {
                lastReplies = currentReplies;
                console.log('[朋友圈] 回复库已更新（定时检测）');
                var container = document.getElementById('moments-content');
                var activeTab = document.querySelector('.moments-tab.active');
                if (container && activeTab) {
                    renderTab(activeTab.dataset.tab, container);
                }
            }
        }, 30000);
    }

    // 🔥 生成随机回复文本（从主字卡中抽取）
    function _generateReplyText() {
        var cards = _getMainReplies();
        if (cards.length === 0) {
            return '嗯嗯';
        }
        // 随机取1-3条组合
        var count = 1 + Math.floor(Math.random() * Math.min(3, cards.length));
        var shuffled = cards.slice();
        for (var i = shuffled.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = shuffled[i];
            shuffled[i] = shuffled[j];
            shuffled[j] = temp;
        }
        var picked = shuffled.slice(0, count);
        var puncts = ['，', '。', '？', '！', '...', '～', '😊', '❤️', '✨', '💕'];
        var result = '';
        for (var pi = 0; pi < picked.length; pi++) {
            // 随机选择标点或表情
            var p = puncts[Math.floor(Math.random() * puncts.length)];
            // 如果p是表情，不加标点直接拼接
            if (p.match(/[😊❤️✨💕]/)) {
                result += picked[pi] + p;
            } else {
                result += picked[pi] + p;
            }
        }
        return result;
    }

    // 🔥 生成动态文本（从主字卡中抽取）
    function _generatePartnerPostText() {
        var cards = _getMainReplies();
        if (cards.length < 2) {
            cards = ['想你', '抱抱', '亲亲', '开心', '好梦', '今天超棒', '别担心', '有我在'];
        }
        var shuffled = cards.slice();
        for (var i = shuffled.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = shuffled[i];
            shuffled[i] = shuffled[j];
            shuffled[j] = temp;
        }
        var count = 1 + Math.floor(Math.random() * Math.min(2, shuffled.length));
        var picked = shuffled.slice(0, count);
        var puncts = ['，', '。', '？', '！', '...', '～', '😊', '❤️'];
        var result = '';
        for (var pi = 0; pi < picked.length; pi++) {
            var p = puncts[Math.floor(Math.random() * puncts.length)];
            result += picked[pi] + p;
        }
        return result;
    }

    // =============================================
    // 存储空间检测与压缩
    // =============================================
    function _checkStorageSpace() {
        try {
            var testKey = '_storage_test_';
            var testData = 'x'.repeat(1024 * 100);
            localStorage.setItem(testKey, testData);
            localStorage.removeItem(testKey);
            return true;
        } catch (e) {
            return false;
        }
    }

    function _compressImage(dataUrl, maxWidth, maxHeight, quality) {
        return new Promise(function(resolve) {
            maxWidth = maxWidth || 80;
            maxHeight = maxHeight || 80;
            quality = quality || 0.5;

            if (dataUrl && dataUrl.startsWith('http')) {
                resolve(dataUrl);
                return;
            }
            if (!dataUrl || !dataUrl.startsWith('data:image')) {
                resolve(dataUrl || '');
                return;
            }

            var img = new Image();
            img.onload = function() {
                var canvas = document.createElement('canvas');
                var ctx = canvas.getContext('2d');
                var width = img.width;
                var height = img.height;

                if (width > maxWidth || height > maxHeight) {
                    var ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                var compressed = canvas.toDataURL('image/jpeg', quality);
                if (compressed.length > dataUrl.length && dataUrl.length < 20000) {
                    compressed = canvas.toDataURL('image/png');
                }
                if (compressed.length > 50000) {
                    compressed = canvas.toDataURL('image/jpeg', 0.3);
                }
                resolve(compressed);
            };
            img.onerror = function() {
                resolve(dataUrl);
            };
            img.src = dataUrl;
        });
    }

    function _emergencyCleanup(data) {
        console.warn('[朋友圈] 存储空间不足，执行紧急清理...');
        var oldPosts = data.posts.filter(function(p) { 
            return p.author === 'partner' && p.comments.length === 0 && p.likes === 0;
        });
        if (oldPosts.length > 5) {
            var keepIds = {};
            var count = 0;
            for (var i = 0; i < data.posts.length && count < 10; i++) {
                if (data.posts[i].author === 'partner') {
                    keepIds[data.posts[i].id] = true;
                    count++;
                }
            }
            data.posts = data.posts.filter(function(p) {
                return p.author === 'me' || keepIds[p.id];
            });
        }
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            _notify('已自动清理存储空间', 'info', 3000);
        } catch (e2) {
            data.posts = data.posts.slice(0, 10);
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                _notify('已紧急清理，仅保留最近10条动态', 'warning', 3000);
            } catch (e3) {
                _notify('存储空间已满，请清除浏览器缓存', 'error', 5000);
            }
        }
    }

    // =============================================
    // 工具函数
    // =============================================
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
                    _saveGroupMembers(members);
                    return members;
                }
            }
        } catch(e) {}
        try {
            var storedMembers = localStorage.getItem('groupMembers');
            if (storedMembers) {
                var parsed = JSON.parse(storedMembers);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    var members = parsed.map(function(m) {
                        return { name: typeof m === 'string' ? m : (m.name || m), avatar: m.avatar || '' };
                    });
                    _saveGroupMembers(members);
                    return members;
                }
            }
        } catch(e) {}
        _saveGroupMembers(defaultMembers);
        return defaultMembers;
    }

    function _saveGroupMembers(members) {
        localStorage.setItem('moments_group_members', JSON.stringify(members));
    }

    function _getRandomGroupMember() {
        var members = _getGroupMembers();
        if (members.length === 0) {
            return { name: '未命名', avatar: '' };
        }
        return members[Math.floor(Math.random() * members.length)];
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
        } else if (typeof window.showNotification === 'function') {
            window.showNotification(msg, type, duration);
        } else {
            alert(msg);
        }
    }

    function _esc(s) {
        return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function _generateId() {
        return Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    }

    function _getCoverImage() {
        try { return localStorage.getItem(COVER_KEY) || ''; } catch { return ''; }
    }
    function _setCoverImage(data) { 
        if (data && data.startsWith('data:image') && data.length > 100000) {
            _compressImage(data, 400, 200, 0.5).then(function(compressed) {
                localStorage.setItem(COVER_KEY, compressed);
            });
        }
        localStorage.setItem(COVER_KEY, data); 
    }
    function _clearCoverImage() { localStorage.removeItem(COVER_KEY); }

    // =============================================
    // 头像与昵称管理
    // =============================================
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
        if (data && data.startsWith('data:image') && data.length > 30000) {
            _compressImage(data, 80, 80, 0.5).then(function(compressed) {
                localStorage.setItem(MY_AVATAR_KEY, compressed);
            });
        }
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

    // =============================================
    // 数据管理
    // =============================================
    function _getData() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { posts: [], lastGenerateDate: '' }; } catch { return { posts: [], lastGenerateDate: '' }; }
    }
    
    function _setData(data) {
        if (data.posts && data.posts.length > MAX_POSTS) {
            data.posts = data.posts.slice(0, MAX_POSTS);
        }
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                _emergencyCleanup(data);
            } else {
                throw e;
            }
        }
    }

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
            text: text.trim().substring(0, 500),
            timestamp: timestamp || new Date().toISOString(),
            likes: 0,
            likedByMe: false,
            comments: [],
            memberName: memberName || '',
            memberAvatar: memberAvatar || '',
            _compressed: true
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
            if (post.author === 'partner') {
                var delay = 3000 + Math.random() * 120000;
                setTimeout(function() {
                    var freshPosts = _getPosts();
                    var freshPost = freshPosts.find(function(p) { return p.id === postId; });
                    if (freshPost && freshPost.likedByMe) {
                        if (!freshPost._partnerRepliedLike) {
                            freshPost.likes += 1;
                            freshPost._partnerRepliedLike = true;
                            _setData(_getData());
                            var container = document.getElementById('moments-content');
                            var activeTab = document.querySelector('.moments-tab.active');
                            if (container && activeTab) renderTab(activeTab.dataset.tab, container);
                            _notify('💕 ' + (freshPost.memberName || _getPartnerName()) + ' 赞了你', 'info', 2000);
                        }
                    }
                }, delay);
            }
        }
        _setData(data);
    }

    function _addComment(postId, author, text) {
        var data = _getData();
        var post = data.posts.find(function(p) { return p.id === postId; });
        if (!post) return null;
        var comment = {
            id: _generateId(),
            author: author,
            text: text.trim().substring(0, 200),
            timestamp: new Date().toISOString(),
            reply: null,
            replied: false
        };
        post.comments.push(comment);
        _setData(data);
        return comment;
    }

    function _addReplyToComment(postId, commentId, replyText) {
        var data = _getData();
        var post = data.posts.find(function(p) { return p.id === postId; });
        if (!post) return;
        var comment = post.comments.find(function(c) { return c.id === commentId; });
        if (!comment) return;
        comment.reply = {
            text: replyText.trim().substring(0, 200),
            timestamp: new Date().toISOString()
        };
        comment.replied = true;
        _setData(data);
    }

    // 🔥 外部发布接口
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
        if (data.lastGenerateDate === today && existingPartnerPosts.length > 0) {
            return;
        }

        data.posts = data.posts.filter(function(p) { return p.author !== 'partner'; });
        
        var activeMembers = members.filter(function(m) { return m.name && m.name.trim(); });
        if (activeMembers.length === 0) return;

        var count = Math.min(1 + Math.floor(Math.random() * 1), activeMembers.length);
        var now = new Date();
        for (var idx = 0; idx < count; idx++) {
            var member = activeMembers[Math.floor(Math.random() * activeMembers.length)];
            var text = _generatePartnerPostText();
            var hours = Math.random() * 24;
            var minutes = Math.random() * 60;
            var ts = new Date(now);
            ts.setHours(Math.floor(hours), Math.floor(minutes), Math.floor(Math.random() * 60), 0);
            _addPost('partner', text, ts.toISOString(), member.name, member.avatar);
        }
        data.lastGenerateDate = today;
        _setData(data);
    }

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
    // 分页状态
    // =============================================
    var _currentPage = 1;
    var _currentTab = 'me';
    var _allFilteredPosts = [];

    function _loadMorePosts(container) {
        var end = _currentPage * PAGE_SIZE;
        var pagePosts = _allFilteredPosts.slice(0, end);
        
        if (pagePosts.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text-secondary);">' +
                '<div style="font-size:48px;margin-bottom:16px;">📭</div>' +
                '<div style="font-size:15px;font-weight:500;">还没有动态</div>' +
                '<div style="font-size:13px;opacity:0.6;margin-top:4px;">' + (_currentTab === 'me' ? '点击右下角 + 发布你的第一条吧' : '成员们还没有发过动态哦') + '</div>' +
                '</div>';
            return;
        }

        var html = '';
        for (var pi = 0; pi < pagePosts.length; pi++) {
            html += _renderPostHtml(pagePosts[pi]);
        }

        if (pagePosts.length < _allFilteredPosts.length) {
            html += '<div style="text-align:center;padding:12px 0 4px;">' +
                '<button id="moments-load-more" style="padding:8px 24px;border:1px solid var(--border-color);border-radius:20px;background:var(--secondary-bg);color:var(--text-secondary);font-size:13px;cursor:pointer;font-family:var(--font-family);">加载更多 <span style="font-size:11px;">(' + (_allFilteredPosts.length - pagePosts.length) + '条)</span></button>' +
                '</div>';
        }

        container.innerHTML = html;
        _bindPostEvents(container);

        var loadMoreBtn = document.getElementById('moments-load-more');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', function() {
                _currentPage++;
                _loadMorePosts(container);
            });
        }
    }

    function _renderPostHtml(post) {
        var isMe = post.author === 'me';
        var name, avatarHtml;

        if (isMe) {
            name = _getMyNameSetting();
            var myAvatar = _getMyAvatarSetting();
            if (myAvatar) {
                avatarHtml = '<img src="' + _esc(myAvatar) + '" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:1px solid rgba(var(--border-color-rgb),0.1);">';
            } else {
                avatarHtml = '👤';
            }
        } else {
            name = post.memberName || _getPartnerName();
            var memberAvatar = _getMemberAvatar(name);
            var finalAvatar = memberAvatar || post.memberAvatar || '';
            if (finalAvatar) {
                avatarHtml = '<img src="' + _esc(finalAvatar) + '" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:1px solid rgba(var(--border-color-rgb),0.1);">';
            } else {
                avatarHtml = '🌸';
            }
        }
        var time = formatTime(post.timestamp);
        var commentCount = post.comments.length;

        var html = '<div class="moments-post" data-id="' + post.id + '" style="background:rgba(var(--secondary-bg-rgb,255,255,255),0.85);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border-radius:16px;padding:16px 16px 12px;margin-bottom:14px;border:1px solid rgba(var(--border-color-rgb,0,0,0),0.06);box-shadow:0 1px 4px rgba(0,0,0,0.04);">' +
            '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">' +
                '<span style="font-size:20px;display:flex;align-items:center;justify-content:center;width:36px;height:36px;flex-shrink:0;">' + avatarHtml + '</span>' +
                '<span style="font-weight:600;color:var(--text-primary);font-size:15px;">' + _esc(name) + '</span>' +
                '<span style="font-size:12px;color:var(--text-secondary);margin-left:auto;">' + time + '</span>' +
            '</div>' +
            '<div style="font-size:16px;color:var(--text-primary);margin:4px 0 12px;word-wrap:break-word;line-height:1.7;padding-left:2px;">' + _esc(post.text) + '</div>' +
            '<div style="display:flex;gap:20px;align-items:center;border-top:1px solid rgba(var(--border-color-rgb,0,0,0),0.06);padding-top:10px;">' +
                '<button class="moments-like-btn" data-id="' + post.id + '" style="background:none;border:none;color:' + (post.likedByMe ? 'var(--accent-color)' : 'var(--text-secondary)') + ';font-size:14px;cursor:pointer;padding:4px 8px;border-radius:12px;display:flex;align-items:center;gap:4px;' + (post.likedByMe ? 'background:rgba(var(--accent-color-rgb),0.08);' : '') + '">' +
                    (post.likedByMe ? '❤️' : '🤍') + ' <span>' + post.likes + '</span>' +
                '</button>' +
                '<button class="moments-comment-btn" data-id="' + post.id + '" style="background:none;border:none;color:var(--text-secondary);font-size:14px;cursor:pointer;padding:4px 8px;border-radius:12px;display:flex;align-items:center;gap:4px;">' +
                    '💬 <span>' + commentCount + '</span>' +
                '</button>' +
                (isMe ? '<button class="moments-delete-btn" data-id="' + post.id + '" style="background:none;border:none;color:#ff6b6b;font-size:13px;cursor:pointer;padding:4px 8px;border-radius:12px;margin-left:auto;">🗑️</button>' : '') +
            '</div>';

        if (post.comments.length > 0) {
            html += '<div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(var(--border-color-rgb,0,0,0),0.06);">';
            for (var ci = 0; ci < post.comments.length; ci++) {
                var c = post.comments[ci];
                var cName = c.author === 'me' ? _getMyNameSetting() : _getPartnerName();
                var cAvatar = c.author === 'me' ? '👤' : '🌸';
                var cTime = formatTime(c.timestamp);

                html += '<div style="margin-bottom:8px;padding:4px 0;">' +
                    '<div style="display:flex;align-items:flex-start;gap:4px;flex-wrap:wrap;">' +
                        '<span style="font-weight:600;font-size:13px;">' + cAvatar + ' ' + _esc(cName) + '</span> ' +
                        '<span style="color:var(--text-primary);font-size:13px;">' + _esc(c.text) + '</span> ' +
                        '<span style="font-size:10px;color:var(--text-secondary);">' + cTime + '</span>' +
                        '<button class="moments-reply-to-comment" data-postid="' + post.id + '" data-commentid="' + c.id + '" style="background:none;border:none;color:var(--accent-color);font-size:11px;cursor:pointer;padding:0 4px;opacity:0.6;">回复</button>' +
                    '</div>';

                if (c.reply) {
                    html += '<div style="margin-left:20px;margin-top:2px;padding:6px 12px;background:rgba(var(--accent-color-rgb),0.05);border-radius:8px;border-left:2px solid rgba(var(--accent-color-rgb),0.2);font-size:13px;color:var(--text-secondary);">' +
                        '<span style="font-weight:500;color:var(--text-primary);">🌸 ' + _getPartnerName() + '</span> ' +
                        '<span style="color:var(--text-primary);">' + _esc(c.reply.text) + '</span> ' +
                        '<span style="font-size:10px;color:var(--text-secondary);">' + formatTime(c.reply.timestamp) + '</span>' +
                        '</div>';
                }
                html += '</div>';
            }
            html += '</div>';
        }
        html += '</div>';
        return html;
    }

    function _bindPostEvents(container) {
        var likeBtns = container.querySelectorAll('.moments-like-btn');
        for (var lb = 0; lb < likeBtns.length; lb++) {
            (function(btn) {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var id = this.dataset.id;
                    _toggleLike(id);
                    var activeTab = document.querySelector('.moments-tab.active');
                    if (activeTab) renderTab(activeTab.dataset.tab, container);
                });
            })(likeBtns[lb]);
        }

        var commentBtns = container.querySelectorAll('.moments-comment-btn');
        for (var cb = 0; cb < commentBtns.length; cb++) {
            (function(btn) {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var postId = this.dataset.id;
                    showCommentModal(postId);
                });
            })(commentBtns[cb]);
        }

        var replyBtns = container.querySelectorAll('.moments-reply-to-comment');
        for (var rb = 0; rb < replyBtns.length; rb++) {
            (function(btn) {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var postId = this.dataset.postid;
                    var commentId = this.dataset.commentid;
                    showReplyModal(postId, commentId);
                });
            })(replyBtns[rb]);
        }

        var deleteBtns = container.querySelectorAll('.moments-delete-btn');
        for (var db = 0; db < deleteBtns.length; db++) {
            (function(btn) {
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
            })(deleteBtns[db]);
        }
    }

    function renderTab(tab, container) {
        _currentTab = tab;
        _currentPage = 1;
        
        var posts = _getPosts();
        var filtered = [];
        for (var i = 0; i < posts.length; i++) {
            if (posts[i].author === tab) filtered.push(posts[i]);
        }
        _allFilteredPosts = filtered;
        _loadMorePosts(container);
    }

    // =============================================
    // 🔥 所有弹窗函数（暴露到全局）
    // =============================================
    
    // 封面设置
    window.showCoverSettings = function() {
        var old = document.getElementById('cover-settings-modal');
        if (old) old.remove();

        var wrap = document.createElement('div');
        wrap.id = 'cover-settings-modal';
        wrap.style.cssText = 'position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';

        var inner = document.createElement('div');
        inner.style.cssText = 'background:var(--primary-bg);border-radius:20px;padding:24px;width:min(380px, 90vw);border:1px solid var(--border-color);';
        inner.innerHTML = '<div style="display:flex;justify-content:space-between;margin-bottom:14px;">' +
            '<span style="font-size:18px;font-weight:700;">🖼️ 更换封面</span>' +
            '<button id="cover-close" style="background:none;border:none;font-size:20px;cursor:pointer;">✕</button>' +
            '</div>' +
            '<div style="margin-bottom:12px;">' +
            '<div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;">选择一张图片作为朋友圈封面</div>' +
            '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
            '<button id="cover-upload-btn" style="flex:1;padding:10px;border:1.5px dashed var(--border-color);border-radius:12px;background:transparent;color:var(--text-secondary);cursor:pointer;font-size:13px;font-family:var(--font-family);">📤 上传图片</button>' +
            '<button id="cover-url-btn" style="flex:1;padding:10px;border:1.5px dashed var(--border-color);border-radius:12px;background:transparent;color:var(--text-secondary);cursor:pointer;font-size:13px;font-family:var(--font-family);">🔗 图片URL</button>' +
            '<button id="cover-reset-btn" style="flex:1;padding:10px;border:1px solid var(--border-color);border-radius:12px;background:var(--secondary-bg);color:#ff6b6b;cursor:pointer;font-size:13px;font-family:var(--font-family);">🗑️ 恢复默认</button>' +
            '</div>' +
            '<input type="file" id="cover-file-input" accept="image/*" style="display:none;">' +
            '</div>' +
            '<div id="cover-preview-wrap" style="display:' + (_getCoverImage() ? 'block' : 'none') + ';margin-bottom:12px;border-radius:12px;overflow:hidden;border:1px solid var(--border-color);">' +
            '<img id="cover-preview-img" src="' + _getCoverImage() + '" style="width:100%;max-height:150px;object-fit:cover;display:block;">' +
            '<div style="padding:6px 10px;font-size:11px;color:var(--text-secondary);text-align:center;background:rgba(var(--primary-bg-rgb),0.6);">当前封面预览</div>' +
            '</div>' +
            '<div style="display:flex;gap:10px;">' +
            '<button id="cover-cancel" style="flex:1;padding:10px;border:1px solid var(--border-color);border-radius:12px;background:var(--secondary-bg);color:var(--text-secondary);cursor:pointer;">关闭</button>' +
            '<button id="cover-apply" style="flex:2;padding:10px;border:none;border-radius:12px;background:var(--accent-color);color:#fff;font-weight:700;cursor:pointer;">应用到封面</button>' +
            '</div>';
        wrap.appendChild(inner);
        document.body.appendChild(wrap);

        var close = function() { wrap.remove(); };
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
    };

    // 头像设置
    window.showAvatarSettings = function() {
        var old = document.getElementById('avatar-settings-modal');
        if (old) old.remove();

        var wrap = document.createElement('div');
        wrap.id = 'avatar-settings-modal';
        wrap.style.cssText = 'position:fixed;inset:0;z-index:10055;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';

        var inner = document.createElement('div');
        inner.style.cssText = 'background:var(--primary-bg);border-radius:20px;padding:20px;width:min(400px, 92vw);max-height:85vh;overflow-y:auto;border:1px solid var(--border-color);';

        var myName = _getMyNameSetting();
        var myAvatar = _getMyAvatarSetting();
        var members = _getGroupMembers();

        var memberListHtml = '';
        if (members.length === 0) {
            memberListHtml = '<div style="text-align:center;padding:20px;color:var(--text-secondary);font-size:13px;">还没有群成员，点击下方添加 ✨</div>';
        } else {
            for (var mi = 0; mi < members.length; mi++) {
                var m = members[mi];
                if (!m.name || !m.name.trim()) continue;
                var displayAvatar = m.avatar || '';
                memberListHtml += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(var(--border-color-rgb),0.06);">' +
                    '<div style="width:36px;height:36px;border-radius:50%;overflow:hidden;border:1px solid var(--border-color);flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--secondary-bg);">' +
                    (displayAvatar ? '<img src="' + _esc(displayAvatar) + '" style="width:100%;height:100%;object-fit:cover;">' : '<span style="font-size:16px;">🌸</span>') +
                    '</div>' +
                    '<span style="font-weight:500;font-size:13px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + _esc(m.name) + '</span>' +
                    '<button onclick="window.editMember(\'' + _esc(m.name) + '\')" style="padding:4px 10px;border:1px solid var(--border-color);border-radius:8px;background:var(--secondary-bg);color:var(--text-secondary);font-size:11px;cursor:pointer;">编辑</button>' +
                    '<button onclick="window.removeMember(\'' + _esc(m.name) + '\')" style="padding:4px 8px;border:none;background:none;color:#ff6b6b;font-size:13px;cursor:pointer;">✕</button>' +
                    '</div>';
            }
        }

        inner.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
                '<span style="font-size:18px;font-weight:700;">👤 头像与昵称</span>' +
                '<button id="avatar-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-secondary);">✕</button>' +
            '</div>' +
            '<div style="margin-bottom:16px;background:rgba(var(--accent-color-rgb),0.04);border-radius:12px;padding:14px 16px;border:1px solid rgba(var(--accent-color-rgb),0.08);">' +
                '<div style="font-size:13px;font-weight:600;margin-bottom:10px;color:var(--accent-color);">👤 我</div>' +
                '<div style="display:flex;align-items:center;gap:12px;">' +
                    '<div style="width:44px;height:44px;border-radius:50%;overflow:hidden;border:2px solid var(--border-color);flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--secondary-bg);">' +
                        (myAvatar ? '<img src="' + _esc(myAvatar) + '" style="width:100%;height:100%;object-fit:cover;">' : '<span style="font-size:20px;">👤</span>') +
                    '</div>' +
                    '<div style="flex:1;min-width:0;">' +
                        '<div style="font-size:15px;font-weight:600;color:var(--text-primary);">' + _esc(myName) + '</div>' +
                    '</div>' +
                    '<button onclick="window.editMyInfo()" style="padding:6px 14px;border:1px solid var(--border-color);border-radius:10px;background:var(--secondary-bg);color:var(--text-secondary);font-size:12px;cursor:pointer;">编辑</button>' +
                '</div>' +
            '</div>' +
            '<div style="margin-bottom:12px;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
                    '<span style="font-size:13px;font-weight:600;color:var(--text-primary);">👥 群成员</span>' +
                    '<button onclick="window.addMember()" style="padding:5px 14px;border:none;border-radius:10px;background:var(--accent-color);color:#fff;font-size:12px;font-weight:600;cursor:pointer;">+ 添加</button>' +
                '</div>' +
                memberListHtml +
            '</div>' +
            '<div style="display:flex;gap:10px;margin-top:4px;">' +
                '<button id="avatar-close-btn" style="flex:1;padding:10px;border:1px solid var(--border-color);border-radius:12px;background:var(--secondary-bg);color:var(--text-secondary);font-size:13px;cursor:pointer;">关闭</button>' +
            '</div>';

        wrap.appendChild(inner);
        document.body.appendChild(wrap);

        document.getElementById('avatar-close').onclick = function() { wrap.remove(); };
        document.getElementById('avatar-close-btn').onclick = function() { wrap.remove(); };
        wrap.onclick = function(e) { if (e.target === wrap) wrap.remove(); };
    };

    // 编辑我的信息
    window.editMyInfo = function() {
        var old = document.getElementById('edit-my-modal');
        if (old) old.remove();

        var myName = _getMyNameSetting();
        var myAvatar = _getMyAvatarSetting();

        var wrap = document.createElement('div');
        wrap.id = 'edit-my-modal';
        wrap.style.cssText = 'position:fixed;inset:0;z-index:10056;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';

        var inner = document.createElement('div');
        inner.style.cssText = 'background:var(--primary-bg);border-radius:20px;padding:24px;width:min(380px, 90vw);border:1px solid var(--border-color);';
        inner.innerHTML =
            '<div style="display:flex;justify-content:space-between;margin-bottom:16px;">' +
                '<span style="font-size:18px;font-weight:700;">✏️ 编辑我的信息</span>' +
                '<button id="edit-my-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-secondary);">✕</button>' +
            '</div>' +
            '<div style="display:flex;flex-direction:column;align-items:center;gap:12px;margin-bottom:16px;">' +
                '<div style="width:64px;height:64px;border-radius:50%;overflow:hidden;border:2px solid var(--border-color);display:flex;align-items:center;justify-content:center;background:var(--secondary-bg);position:relative;cursor:pointer;" onclick="document.getElementById(\'edit-my-avatar-input\').click()">' +
                    (myAvatar ? '<img id="edit-my-avatar-preview" src="' + _esc(myAvatar) + '" style="width:100%;height:100%;object-fit:cover;">' : '<span id="edit-my-avatar-preview" style="font-size:28px;">👤</span>') +
                    '<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.5);color:#fff;font-size:9px;text-align:center;padding:2px 0;">点击更换</div>' +
                '</div>' +
                '<input type="file" id="edit-my-avatar-input" accept="image/*" style="display:none;">' +
                '<div style="width:100%;">' +
                    '<label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">昵称</label>' +
                    '<input id="edit-my-name-input" type="text" value="' + _esc(myName) + '" maxlength="12" style="width:100%;padding:10px;border:1px solid var(--border-color);border-radius:10px;background:var(--secondary-bg);color:var(--text-primary);font-size:14px;box-sizing:border-box;">' +
                '</div>' +
                '<div style="width:100%;display:flex;gap:8px;">' +
                    '<button onclick="document.getElementById(\'edit-my-avatar-url-input\').style.display=\'block\'" style="flex:1;padding:6px;border:1px dashed var(--border-color);border-radius:8px;background:transparent;color:var(--text-secondary);font-size:11px;cursor:pointer;">🔗 图片URL</button>' +
                    '<input id="edit-my-avatar-url-input" type="text" placeholder="输入图片URL" style="display:none;flex:1;padding:6px 10px;border:1px solid var(--border-color);border-radius:8px;background:var(--secondary-bg);color:var(--text-primary);font-size:11px;box-sizing:border-box;">' +
                '</div>' +
            '</div>' +
            '<div style="display:flex;gap:10px;">' +
                '<button id="edit-my-cancel" style="flex:1;padding:10px;border:1px solid var(--border-color);border-radius:12px;background:var(--secondary-bg);color:var(--text-secondary);font-size:13px;cursor:pointer;">取消</button>' +
                '<button id="edit-my-save" style="flex:2;padding:10px;border:none;border-radius:12px;background:var(--accent-color);color:#fff;font-weight:700;font-size:13px;cursor:pointer;">保存</button>' +
            '</div>';

        wrap.appendChild(inner);
        document.body.appendChild(wrap);

        var tempAvatar = myAvatar;

        document.getElementById('edit-my-close').onclick = function() { wrap.remove(); };
        document.getElementById('edit-my-cancel').onclick = function() { wrap.remove(); };
        wrap.onclick = function(e) { if (e.target === wrap) wrap.remove(); };

        document.getElementById('edit-my-avatar-input').onchange = function(e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(ev) {
                var data = ev.target.result;
                tempAvatar = data;
                var preview = document.getElementById('edit-my-avatar-preview');
                if (preview) {
                    if (preview.tagName === 'IMG') preview.src = data;
                    else preview.innerHTML = '<img src="' + data + '" style="width:100%;height:100%;object-fit:cover;">';
                }
            };
            reader.readAsDataURL(file);
        };

        document.getElementById('edit-my-avatar-url-input').addEventListener('change', function() {
            var url = this.value.trim();
            if (url) {
                tempAvatar = url;
                var preview = document.getElementById('edit-my-avatar-preview');
                if (preview) {
                    if (preview.tagName === 'IMG') preview.src = url;
                    else preview.innerHTML = '<img src="' + url + '" style="width:100%;height:100%;object-fit:cover;">';
                }
            }
        });

        document.getElementById('edit-my-save').onclick = function() {
            var name = document.getElementById('edit-my-name-input').value.trim();
            if (!name) { _notify('请输入昵称', 'warning'); return; }
            _setMyNameSetting(name);
            if (tempAvatar) _setMyAvatarSetting(tempAvatar);
            wrap.remove();
            var avatarModal = document.getElementById('avatar-settings-modal');
            if (avatarModal) avatarModal.remove();
            window.showAvatarSettings();
            var container = document.getElementById('moments-content');
            var activeTab = document.querySelector('.moments-tab.active');
            if (container && activeTab) renderTab(activeTab.dataset.tab, container);
            _notify('信息已更新 ✨', 'success');
        };
    };

    // 编辑成员
    window.editMember = function(name) {
        var old = document.getElementById('edit-member-modal');
        if (old) old.remove();

        var members = _getGroupMembers();
        var member = null;
        for (var i = 0; i < members.length; i++) {
            if (members[i].name === name) { member = members[i]; break; }
        }
        if (!member) { _notify('成员不存在', 'error'); return; }

        var wrap = document.createElement('div');
        wrap.id = 'edit-member-modal';
        wrap.style.cssText = 'position:fixed;inset:0;z-index:10057;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';

        var inner = document.createElement('div');
        inner.style.cssText = 'background:var(--primary-bg);border-radius:20px;padding:24px;width:min(380px, 90vw);border:1px solid var(--border-color);';
        inner.innerHTML =
            '<div style="display:flex;justify-content:space-between;margin-bottom:16px;">' +
                '<span style="font-size:18px;font-weight:700;">✏️ 编辑成员</span>' +
                '<button id="edit-member-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-secondary);">✕</button>' +
            '</div>' +
            '<div style="display:flex;flex-direction:column;align-items:center;gap:12px;margin-bottom:16px;">' +
                '<div style="width:64px;height:64px;border-radius:50%;overflow:hidden;border:2px solid var(--border-color);display:flex;align-items:center;justify-content:center;background:var(--secondary-bg);position:relative;cursor:pointer;" onclick="document.getElementById(\'edit-member-avatar-input\').click()">' +
                    (member.avatar ? '<img id="edit-member-avatar-preview" src="' + _esc(member.avatar) + '" style="width:100%;height:100%;object-fit:cover;">' : '<span id="edit-member-avatar-preview" style="font-size:28px;">🌸</span>') +
                    '<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.5);color:#fff;font-size:9px;text-align:center;padding:2px 0;">点击更换</div>' +
                '</div>' +
                '<input type="file" id="edit-member-avatar-input" accept="image/*" style="display:none;">' +
                '<div style="width:100%;">' +
                    '<label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">昵称</label>' +
                    '<input id="edit-member-name-input" type="text" value="' + _esc(member.name) + '" maxlength="12" style="width:100%;padding:10px;border:1px solid var(--border-color);border-radius:10px;background:var(--secondary-bg);color:var(--text-primary);font-size:14px;box-sizing:border-box;">' +
                '</div>' +
                '<div style="width:100%;display:flex;gap:8px;">' +
                    '<button onclick="document.getElementById(\'edit-member-avatar-url-input\').style.display=\'block\'" style="flex:1;padding:6px;border:1px dashed var(--border-color);border-radius:8px;background:transparent;color:var(--text-secondary);font-size:11px;cursor:pointer;">🔗 图片URL</button>' +
                    '<input id="edit-member-avatar-url-input" type="text" placeholder="输入图片URL" style="display:none;flex:1;padding:6px 10px;border:1px solid var(--border-color);border-radius:8px;background:var(--secondary-bg);color:var(--text-primary);font-size:11px;box-sizing:border-box;">' +
                '</div>' +
            '</div>' +
            '<div style="display:flex;gap:10px;">' +
                '<button id="edit-member-cancel" style="flex:1;padding:10px;border:1px solid var(--border-color);border-radius:12px;background:var(--secondary-bg);color:var(--text-secondary);font-size:13px;cursor:pointer;">取消</button>' +
                '<button id="edit-member-save" style="flex:2;padding:10px;border:none;border-radius:12px;background:var(--accent-color);color:#fff;font-weight:700;font-size:13px;cursor:pointer;">保存</button>' +
            '</div>';

        wrap.appendChild(inner);
        document.body.appendChild(wrap);

        var tempAvatar = member.avatar || '';

        document.getElementById('edit-member-close').onclick = function() { wrap.remove(); };
        document.getElementById('edit-member-cancel').onclick = function() { wrap.remove(); };
        wrap.onclick = function(e) { if (e.target === wrap) wrap.remove(); };

        document.getElementById('edit-member-avatar-input').onchange = function(e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(ev) {
                var data = ev.target.result;
                tempAvatar = data;
                var preview = document.getElementById('edit-member-avatar-preview');
                if (preview) {
                    if (preview.tagName === 'IMG') preview.src = data;
                    else preview.innerHTML = '<img src="' + data + '" style="width:100%;height:100%;object-fit:cover;">';
                }
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
            wrap.remove();
            var avatarModal = document.getElementById('avatar-settings-modal');
            if (avatarModal) avatarModal.remove();
            window.showAvatarSettings();
            var container = document.getElementById('moments-content');
            var activeTab = document.querySelector('.moments-tab.active');
            if (container && activeTab) renderTab(activeTab.dataset.tab, container);
            _notify('成员已更新 ✨', 'success');
        };
    };

    // 添加成员
    window.addMember = function() {
        var old = document.getElementById('add-member-modal');
        if (old) old.remove();

        var wrap = document.createElement('div');
        wrap.id = 'add-member-modal';
        wrap.style.cssText = 'position:fixed;inset:0;z-index:10058;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';

        var inner = document.createElement('div');
        inner.style.cssText = 'background:var(--primary-bg);border-radius:20px;padding:24px;width:min(380px, 90vw);border:1px solid var(--border-color);';
        inner.innerHTML =
            '<div style="display:flex;justify-content:space-between;margin-bottom:16px;">' +
                '<span style="font-size:18px;font-weight:700;">➕ 添加成员</span>' +
                '<button id="add-member-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-secondary);">✕</button>' +
            '</div>' +
            '<div style="display:flex;flex-direction:column;align-items:center;gap:12px;margin-bottom:16px;">' +
                '<div style="width:64px;height:64px;border-radius:50%;overflow:hidden;border:2px dashed var(--border-color);display:flex;align-items:center;justify-content:center;background:var(--secondary-bg);cursor:pointer;position:relative;" onclick="document.getElementById(\'add-member-avatar-input\').click()">' +
                    '<span id="add-member-avatar-preview" style="font-size:28px;color:var(--text-secondary);">+</span>' +
                    '<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.5);color:#fff;font-size:9px;text-align:center;padding:2px 0;">点击上传头像</div>' +
                '</div>' +
                '<input type="file" id="add-member-avatar-input" accept="image/*" style="display:none;">' +
                '<div style="width:100%;">' +
                    '<label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">成员名字</label>' +
                    '<input id="add-member-name-input" type="text" placeholder="输入名字" maxlength="12" style="width:100%;padding:10px;border:1px solid var(--border-color);border-radius:10px;background:var(--secondary-bg);color:var(--text-primary);font-size:14px;box-sizing:border-box;">' +
                '</div>' +
                '<div style="width:100%;display:flex;gap:8px;">' +
                    '<button onclick="document.getElementById(\'add-member-avatar-url-input\').style.display=\'block\'" style="flex:1;padding:6px;border:1px dashed var(--border-color);border-radius:8px;background:transparent;color:var(--text-secondary);font-size:11px;cursor:pointer;">🔗 图片URL</button>' +
                    '<input id="add-member-avatar-url-input" type="text" placeholder="输入图片URL" style="display:none;flex:1;padding:6px 10px;border:1px solid var(--border-color);border-radius:8px;background:var(--secondary-bg);color:var(--text-primary);font-size:11px;box-sizing:border-box;">' +
                '</div>' +
            '</div>' +
            '<div style="display:flex;gap:10px;">' +
                '<button id="add-member-cancel" style="flex:1;padding:10px;border:1px solid var(--border-color);border-radius:12px;background:var(--secondary-bg);color:var(--text-secondary);font-size:13px;cursor:pointer;">取消</button>' +
                '<button id="add-member-save" style="flex:2;padding:10px;border:none;border-radius:12px;background:var(--accent-color);color:#fff;font-weight:700;font-size:13px;cursor:pointer;">保存</button>' +
            '</div>';

        wrap.appendChild(inner);
        document.body.appendChild(wrap);

        var tempAvatar = '';

        document.getElementById('add-member-close').onclick = function() { wrap.remove(); };
        document.getElementById('add-member-cancel').onclick = function() { wrap.remove(); };
        wrap.onclick = function(e) { if (e.target === wrap) wrap.remove(); };

        document.getElementById('add-member-avatar-input').onchange = function(e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(ev) {
                var data = ev.target.result;
                tempAvatar = data;
                var preview = document.getElementById('add-member-avatar-preview');
                if (preview) {
                    preview.innerHTML = '<img src="' + data + '" style="width:100%;height:100%;object-fit:cover;">';
                }
            };
            reader.readAsDataURL(file);
        };

        document.getElementById('add-member-avatar-url-input').addEventListener('change', function() {
            var url = this.value.trim();
            if (url) {
                tempAvatar = url;
                var preview = document.getElementById('add-member-avatar-preview');
                if (preview) {
                    preview.innerHTML = '<img src="' + url + '" style="width:100%;height:100%;object-fit:cover;">';
                }
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
            wrap.remove();
            var avatarModal = document.getElementById('avatar-settings-modal');
            if (avatarModal) avatarModal.remove();
            window.showAvatarSettings();
            var container = document.getElementById('moments-content');
            var activeTab = document.querySelector('.moments-tab.active');
            if (container && activeTab) renderTab(activeTab.dataset.tab, container);
            _notify('成员已添加 ✨', 'success');
        };
    };

    // 删除成员
    window.removeMember = function(name) {
        if (!confirm('确定要删除成员 "' + name + '" 吗？\n该成员的所有动态也将被删除。')) return;
        _removeGroupMember(name);
        var avatarModal = document.getElementById('avatar-settings-modal');
        if (avatarModal) avatarModal.remove();
        window.showAvatarSettings();
        var container = document.getElementById('moments-content');
        var activeTab = document.querySelector('.moments-tab.active');
        if (container && activeTab) renderTab(activeTab.dataset.tab, container);
        _notify('成员已删除', 'info');
    };

    // 回复弹窗
    function showReplyModal(postId, commentId) {
        var old = document.getElementById('reply-modal');
        if (old) old.remove();

        var wrap = document.createElement('div');
        wrap.id = 'reply-modal';
        wrap.style.cssText = 'position:fixed;inset:0;z-index:10035;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';
        var inner = document.createElement('div');
        inner.style.cssText = 'background:var(--primary-bg);border-radius:20px;padding:24px;width:min(380px, 90vw);border:1px solid var(--border-color);';
        inner.innerHTML = '<div style="display:flex;justify-content:space-between;margin-bottom:14px;">' +
            '<span style="font-size:18px;font-weight:700;">💬 回复</span>' +
            '<button id="reply-close" style="background:none;border:none;font-size:20px;cursor:pointer;">✕</button>' +
            '</div>' +
            '<textarea id="reply-text" rows="3" placeholder="写下你的回复..." style="width:100%;padding:10px;border:1px solid var(--border-color);border-radius:12px;background:var(--secondary-bg);color:var(--text-primary);font-size:14px;resize:vertical;box-sizing:border-box;font-family:var(--font-family);"></textarea>' +
            '<div style="display:flex;gap:10px;margin-top:12px;">' +
            '<button id="reply-cancel" style="flex:1;padding:10px;border:1px solid var(--border-color);border-radius:12px;background:var(--secondary-bg);color:var(--text-secondary);cursor:pointer;">取消</button>' +
            '<button id="reply-submit" style="flex:2;padding:10px;border:none;border-radius:12px;background:var(--accent-color);color:#fff;font-weight:700;cursor:pointer;">发送</button>' +
            '</div>';
        wrap.appendChild(inner);
        document.body.appendChild(wrap);

        var close = function() { wrap.remove(); };
        document.getElementById('reply-close').onclick = close;
        document.getElementById('reply-cancel').onclick = close;
        wrap.onclick = function(e) { if (e.target === wrap) close(); };

        document.getElementById('reply-submit').onclick = function() {
            var text = document.getElementById('reply-text').value.trim();
            if (!text) { _notify('请输入回复内容', 'warning'); return; }
            _addReplyToComment(postId, commentId, text);
            close();
            var container = document.getElementById('moments-content');
            var activeTab = document.querySelector('.moments-tab.active');
            if (container && activeTab) renderTab(activeTab.dataset.tab, container);
            _notify('回复已发送', 'success');
        };
    }

    // 发布弹窗
    function showPublishModal() {
        var old = document.getElementById('publish-modal');
        if (old) old.remove();

        var wrap = document.createElement('div');
        wrap.id = 'publish-modal';
        wrap.style.cssText = 'position:fixed;inset:0;z-index:10020;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';
        var inner = document.createElement('div');
        inner.style.cssText = 'background:var(--primary-bg);border-radius:20px;padding:24px;width:min(380px, 90vw);border:1px solid var(--border-color);';
        inner.innerHTML = '<div style="display:flex;justify-content:space-between;margin-bottom:14px;">' +
            '<span style="font-size:18px;font-weight:700;">📝 发布新动态</span>' +
            '<button id="publish-close" style="background:none;border:none;font-size:20px;cursor:pointer;">✕</button>' +
            '</div>' +
            '<textarea id="publish-text" rows="4" placeholder="此刻的想法..." style="width:100%;padding:10px;border:1px solid var(--border-color);border-radius:12px;background:var(--secondary-bg);color:var(--text-primary);font-size:14px;resize:vertical;box-sizing:border-box;font-family:var(--font-family);"></textarea>' +
            '<div style="display:flex;gap:10px;margin-top:12px;">' +
            '<button id="publish-cancel" style="flex:1;padding:10px;border:1px solid var(--border-color);border-radius:12px;background:var(--secondary-bg);color:var(--text-secondary);cursor:pointer;">取消</button>' +
            '<button id="publish-submit" style="flex:2;padding:10px;border:none;border-radius:12px;background:var(--accent-color);color:#fff;font-weight:700;cursor:pointer;">发布</button>' +
            '</div>';
        wrap.appendChild(inner);
        document.body.appendChild(wrap);

        var close = function() { wrap.remove(); };
        document.getElementById('publish-close').onclick = close;
        document.getElementById('publish-cancel').onclick = close;
        wrap.onclick = function(e) { if (e.target === wrap) close(); };

        document.getElementById('publish-submit').onclick = function() {
            var text = document.getElementById('publish-text').value.trim();
            if (!text) { _notify('请输入内容', 'warning'); return; }
            _addPost('me', text);
            close();
            var container = document.getElementById('moments-content');
            var activeTab = document.querySelector('.moments-tab.active');
            if (container && activeTab) renderTab(activeTab.dataset.tab, container);
            _notify('发布成功 ✨', 'success');
        };
    }

    // 评论弹窗
    function showCommentModal(postId) {
        var old = document.getElementById('comment-modal');
        if (old) old.remove();

        var wrap = document.createElement('div');
        wrap.id = 'comment-modal';
        wrap.style.cssText = 'position:fixed;inset:0;z-index:10030;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';
        var inner = document.createElement('div');
        inner.style.cssText = 'background:var(--primary-bg);border-radius:20px;padding:24px;width:min(380px, 90vw);border:1px solid var(--border-color);';
        inner.innerHTML = '<div style="display:flex;justify-content:space-between;margin-bottom:14px;">' +
            '<span style="font-size:18px;font-weight:700;">💬 评论</span>' +
            '<button id="comment-close" style="background:none;border:none;font-size:20px;cursor:pointer;">✕</button>' +
            '</div>' +
            '<textarea id="comment-text" rows="3" placeholder="写下你的评论..." style="width:100%;padding:10px;border:1px solid var(--border-color);border-radius:12px;background:var(--secondary-bg);color:var(--text-primary);font-size:14px;resize:vertical;box-sizing:border-box;font-family:var(--font-family);"></textarea>' +
            '<div style="display:flex;gap:10px;margin-top:12px;">' +
            '<button id="comment-cancel" style="flex:1;padding:10px;border:1px solid var(--border-color);border-radius:12px;background:var(--secondary-bg);color:var(--text-secondary);cursor:pointer;">取消</button>' +
            '<button id="comment-submit" style="flex:2;padding:10px;border:none;border-radius:12px;background:var(--accent-color);color:#fff;font-weight:700;cursor:pointer;">发送</button>' +
            '</div>';
        wrap.appendChild(inner);
        document.body.appendChild(wrap);

        var close = function() { wrap.remove(); };
        document.getElementById('comment-close').onclick = close;
        document.getElementById('comment-cancel').onclick = close;
        wrap.onclick = function(e) { if (e.target === wrap) close(); };

        document.getElementById('comment-submit').onclick = function() {
            var text = document.getElementById('comment-text').value.trim();
            if (!text) { _notify('请输入评论', 'warning'); return; }

            var posts = _getPosts();
            var post = null;
            for (var i = 0; i < posts.length; i++) {
                if (posts[i].id === postId) { post = posts[i]; break; }
            }
            if (!post) { _notify('帖子不存在', 'error'); return; }

            var comment = _addComment(postId, 'me', text);
            if (!comment) { _notify('评论失败', 'error'); return; }

            close();
            var container = document.getElementById('moments-content');
            var activeTab = document.querySelector('.moments-tab.active');
            if (container && activeTab) renderTab(activeTab.dataset.tab, container);
            _notify('评论已发送', 'success');

            if (post.author === 'partner') {
                var delay = 3000 + Math.random() * 180000;
                var timeoutId = setTimeout(function() {
                    var freshPosts = _getPosts();
                    var freshPost = null;
                    for (var fi = 0; fi < freshPosts.length; fi++) {
                        if (freshPosts[fi].id === postId) { freshPost = freshPosts[fi]; break; }
                    }
                    if (!freshPost) return;
                    var latestComment = freshPost.comments[freshPost.comments.length - 1];
                    if (latestComment && latestComment.author === 'me' && !latestComment.replied) {
                        // 🔥 从主字卡中生成回复
                        var replyText = _generateReplyText();
                        if (replyText) {
                            _addReplyToComment(postId, latestComment.id, replyText);
                            _notify('💬 ' + _getPartnerName() + ' 回复了你的评论: "' + replyText + '"', 'info', 3000);
                            var container2 = document.getElementById('moments-content');
                            var activeTab2 = document.querySelector('.moments-tab.active');
                            if (container2 && activeTab2) renderTab(activeTab2.dataset.tab, container2);
                        }
                    }
                }, delay);
                if (!post._replyTimeouts) post._replyTimeouts = [];
                post._replyTimeouts.push(timeoutId);
            }
        };
    }

    // =============================================
    // 清理工具
    // =============================================
    window.cleanMomentsStorage = function() {
        if (!confirm('将清理所有头像和封面图片（保留文字内容），释放存储空间。确定吗？')) return;
        
        var data = _getData();
        var compressedCount = 0;
        
        for (var i = 0; i < data.posts.length; i++) {
            if (data.posts[i].memberAvatar && data.posts[i].memberAvatar.length > 1000) {
                data.posts[i].memberAvatar = '';
                compressedCount++;
            }
        }
        
        var members = _getGroupMembers();
        for (var j = 0; j < members.length; j++) {
            if (members[j].avatar && members[j].avatar.length > 1000) {
                members[j].avatar = '';
                compressedCount++;
            }
        }
        _saveGroupMembers(members);
        
        if (_getMyAvatarSetting().length > 1000) {
            _setMyAvatarSetting('');
            compressedCount++;
        }
        
        if (_getCoverImage().length > 1000) {
            _clearCoverImage();
            compressedCount++;
        }
        
        _setData(data);
        _notify('已清理 ' + compressedCount + ' 个头像/封面，释放存储空间', 'success', 3000);
        
        var container = document.getElementById('moments-content');
        var activeTab = document.querySelector('.moments-tab.active');
        if (container && activeTab) renderTab(activeTab.dataset.tab, container);
    };

    window.showMomentsStorageStatus = function() {
        try {
            var total = 0;
            var items = 0;
            for (var key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    total += localStorage[key].length;
                    items++;
                }
            }
            var sizeKB = (total / 1024).toFixed(2);
            var sizeMB = (total / (1024 * 1024)).toFixed(2);
            
            var msg = '📊 localStorage 存储状态：\n';
            msg += '总大小: ' + sizeKB + ' KB (' + sizeMB + ' MB)\n';
            msg += '总条目: ' + items + ' 项\n';
            msg += '限制: 5-10MB (浏览器限制)';
            
            var momentsData = localStorage.getItem(STORAGE_KEY);
            if (momentsData) {
                var dataSize = (momentsData.length / 1024).toFixed(2);
                msg += '\n\n📱 朋友圈数据: ' + dataSize + ' KB';
                var data = _getData();
                msg += '\n动态数量: ' + data.posts.length + ' 条';
            }
            
            // 🔥 显示主字卡库状态
            var replies = _getMainReplies();
            msg += '\n\n📝 主字卡库: ' + replies.length + ' 条';
            if (replies.length > 0) {
                msg += '\n示例: ' + replies.slice(0, 5).join('、');
            }
            if (window.replyLibrary) {
                msg += '\n来源: window.replyLibrary (' + window.replyLibrary.length + ' 条)';
            }
            
            alert(msg);
        } catch(e) {
            alert('无法读取存储状态');
        }
    };

    // 🔥 获取主字卡库（暴露给外部使用）
    window.getMainReplies = _getMainReplies;

    // =============================================
    // 🔥 主界面
    // =============================================
    window.openMoments = function() {
        // 检查存储空间
        if (!_checkStorageSpace()) {
            if (confirm('存储空间不足！是否清理旧数据（清理头像和封面）？')) {
                window.cleanMomentsStorage();
                setTimeout(function() { window.openMoments(); }, 500);
            } else {
                _notify('存储空间不足，无法打开朋友圈', 'error', 3000);
            }
            return;
        }
        
        _forceGeneratePartnerPosts();

        var old = document.getElementById('moments-modal');
        if (old) old.remove();

        var wrap = document.createElement('div');
        wrap.id = 'moments-modal';
        wrap.style.cssText = 'position:fixed;inset:0;z-index:10010;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);';

        var inner = document.createElement('div');
        inner.style.cssText = 'background:var(--primary-bg);border-radius:20px;padding:0;width:min(460px, 94vw);max-height:85vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.3);border:1px solid var(--border-color);';

        // ===== 顶部封面 =====
        var coverUrl = _getCoverImage();
        var defaultCover = 'linear-gradient(135deg, #2d1b3d 0%, #1a1a2e 50%, #16213e 100%)';
        var coverStyle = coverUrl ? 'url(' + coverUrl + ')' : defaultCover;

        var coverSection = document.createElement('div');
        coverSection.id = 'moments-cover';
        coverSection.style.cssText = 'position:relative;width:100%;height:160px;background:' + coverStyle + ';background-size:cover;background-position:center;flex-shrink:0;cursor:pointer;transition:background 0.3s ease;';

        var coverText = document.createElement('div');
        coverText.style.cssText = 'position:absolute;bottom:16px;left:18px;right:18px;color:rgba(255,255,255,0.95);text-shadow:0 2px 16px rgba(0,0,0,0.4);';
        coverText.innerHTML =
            '<div style="font-size:17px;font-weight:300;letter-spacing:2px;font-style:italic;line-height:1.5;">誓言是一场有时差的雨。</div>' +
            '<div style="font-size:11px;opacity:0.6;margin-top:2px;letter-spacing:1.5px;font-weight:300;">— Vow is a rain with time difference.</div>';
        coverSection.appendChild(coverText);

        var coverBtnHint = document.createElement('div');
        coverBtnHint.style.cssText = 'position:absolute;top:12px;right:14px;background:rgba(0,0,0,0.45);backdrop-filter:blur(8px);padding:4px 12px;border-radius:14px;font-size:11px;color:rgba(255,255,255,0.85);pointer-events:none;';
        coverBtnHint.textContent = '📷 更换封面';
        coverSection.appendChild(coverBtnHint);

        coverSection.addEventListener('click', function() {
            window.showCoverSettings();
        });

        inner.appendChild(coverSection);

        // ===== 标题栏 =====
        var header = document.createElement('div');
        header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:14px 18px 10px;border-bottom:1px solid var(--border-color);flex-shrink:0;background:var(--primary-bg);';

        var leftSection = document.createElement('div');
        leftSection.style.cssText = 'display:flex;align-items:center;gap:8px;';
        var backBtn = document.createElement('button');
        backBtn.style.cssText = 'background:none;border:none;font-size:16px;color:var(--text-secondary);cursor:pointer;padding:4px;border-radius:8px;display:flex;align-items:center;justify-content:center;';
        backBtn.innerHTML = '<i class="fas fa-arrow-left"></i>';
        backBtn.onclick = function() { wrap.remove(); };
        leftSection.appendChild(backBtn);

        var titleSpan = document.createElement('span');
        titleSpan.style.cssText = 'font-size:17px;font-weight:700;color:var(--text-primary);';
        titleSpan.textContent = '📱 朋友圈';
        leftSection.appendChild(titleSpan);
        header.appendChild(leftSection);

        var rightSection = document.createElement('div');
        rightSection.style.cssText = 'display:flex;gap:6px;align-items:center;';

        var storageBtn = document.createElement('button');
        storageBtn.style.cssText = 'background:none;border:none;font-size:13px;color:var(--text-secondary);cursor:pointer;padding:4px 6px;border-radius:8px;';
        storageBtn.innerHTML = '💾';
        storageBtn.title = '存储状态';
        storageBtn.onclick = function(e) {
            e.stopPropagation();
            window.showMomentsStorageStatus();
        };
        rightSection.appendChild(storageBtn);

        var cleanBtn = document.createElement('button');
        cleanBtn.style.cssText = 'background:none;border:none;font-size:13px;color:var(--text-secondary);cursor:pointer;padding:4px 6px;border-radius:8px;';
        cleanBtn.innerHTML = '🧹';
        cleanBtn.title = '清理头像释放空间';
        cleanBtn.onclick = function(e) {
            e.stopPropagation();
            window.cleanMomentsStorage();
        };
        rightSection.appendChild(cleanBtn);

        var avatarBtn = document.createElement('button');
        avatarBtn.style.cssText = 'background:none;border:none;font-size:16px;color:var(--text-secondary);cursor:pointer;padding:4px 6px;border-radius:8px;';
        avatarBtn.innerHTML = '<i class="fas fa-user-circle"></i>';
        avatarBtn.title = '头像与昵称';
        avatarBtn.onclick = function(e) {
            e.stopPropagation();
            window.showAvatarSettings();
        };
        rightSection.appendChild(avatarBtn);

        var bgBtn = document.createElement('button');
        bgBtn.style.cssText = 'background:none;border:none;font-size:14px;color:var(--text-secondary);cursor:pointer;padding:4px 6px;border-radius:8px;';
        bgBtn.innerHTML = '<i class="fas fa-image"></i>';
        bgBtn.title = '更换封面';
        bgBtn.onclick = function(e) {
            e.stopPropagation();
            window.showCoverSettings();
        };
        rightSection.appendChild(bgBtn);
        header.appendChild(rightSection);
        inner.appendChild(header);

        // ===== Tab切换 =====
        var tabBar = document.createElement('div');
        tabBar.style.cssText = 'display:flex;border-bottom:1px solid rgba(var(--border-color-rgb,0,0,0),0.08);flex-shrink:0;background:var(--primary-bg);padding:0 16px;';
        tabBar.innerHTML = '<button class="moments-tab active" data-tab="me" style="flex:1;padding:12px 4px 10px;border:none;background:transparent;font-weight:600;color:var(--text-primary);cursor:pointer;font-family:var(--font-family);font-size:14px;position:relative;border-bottom:2px solid var(--accent-color);">我的</button>' +
            '<button class="moments-tab" data-tab="partner" style="flex:1;padding:12px 4px 10px;border:none;background:transparent;font-weight:400;color:var(--text-secondary);cursor:pointer;font-family:var(--font-family);font-size:14px;position:relative;border-bottom:2px solid transparent;">群成员</button>';
        inner.appendChild(tabBar);

        // ===== 内容列表 =====
        var contentContainer = document.createElement('div');
        contentContainer.id = 'moments-content';
        contentContainer.style.cssText = 'flex:1;overflow-y:auto;padding:12px 16px 16px;background:var(--secondary-bg);';

        renderTab('me', contentContainer);
        inner.appendChild(contentContainer);

        // ===== 底部发布按钮 =====
        var footer = document.createElement('div');
        footer.style.cssText = 'display:flex;justify-content:flex-end;padding:10px 16px 14px;border-top:1px solid var(--border-color);flex-shrink:0;background:rgba(var(--primary-bg-rgb),0.95);backdrop-filter:blur(8px);';
        var addBtn = document.createElement('button');
        addBtn.id = 'moments-add-btn';
        addBtn.style.cssText = 'width:38px;height:38px;border-radius:50%;background:#000;color:#fff;border:none;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,0.2);';
        addBtn.textContent = '+';
        addBtn.title = '发布新动态';
        addBtn.onclick = function() { showPublishModal(); };
        footer.appendChild(addBtn);
        inner.appendChild(footer);

        wrap.appendChild(inner);
        document.body.appendChild(wrap);

        tabBar.querySelectorAll('.moments-tab').forEach(function(btn) {
            btn.addEventListener('click', function() {
                tabBar.querySelectorAll('.moments-tab').forEach(function(b) {
                    b.classList.remove('active');
                    b.style.color = 'var(--text-secondary)';
                    b.style.borderBottom = '2px solid transparent';
                    b.style.fontWeight = '400';
                });
                this.classList.add('active');
                this.style.color = 'var(--text-primary)';
                this.style.borderBottom = '2px solid var(--accent-color)';
                this.style.fontWeight = '600';
                var tab = this.dataset.tab;
                renderTab(tab, contentContainer);
                var addBtnEl = document.getElementById('moments-add-btn');
                if (addBtnEl) addBtnEl.style.display = tab === 'me' ? 'flex' : 'none';
            });
        });

        // 🔥 显示当前使用的字卡数量
        var replyCount = _getMainReplies().length;
        if (replyCount > 0) {
            var statusBar = document.createElement('div');
            statusBar.style.cssText = 'position:absolute;bottom:70px;right:16px;font-size:10px;color:var(--text-secondary);opacity:0.5;background:rgba(0,0,0,0.3);padding:2px 10px;border-radius:10px;pointer-events:none;';
            statusBar.textContent = '📚 ' + replyCount + '个字卡';
            inner.style.position = 'relative';
            inner.appendChild(statusBar);
        }
    };

    // 🔥 初始化 - 监听回复库更新
    _watchReplyLibraryUpdates();

    // =============================================
    // 🔥 确保所有函数暴露到全局
    // =============================================
    window.openMoments = window.openMoments;
    window.showAvatarSettings = window.showAvatarSettings;
    window.showCoverSettings = window.showCoverSettings;
    window.editMyInfo = window.editMyInfo;
    window.editMember = window.editMember;
    window.addMember = window.addMember;
    window.removeMember = window.removeMember;
    window.partnerPublishPost = window.partnerPublishPost;
    window.cleanMomentsStorage = window.cleanMomentsStorage;
    window.showMomentsStorageStatus = window.showMomentsStorageStatus;
    window.getMainReplies = _getMainReplies;

    console.log('[朋友圈] 模块已加载（reply-library.js联动版）');
    console.log('[朋友圈] 当前主字卡库:', _getMainReplies().slice(0, 10));
    console.log('[朋友圈] 字卡总数:', _getMainReplies().length);
})();
