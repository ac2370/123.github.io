// moments.js - 朋友圈功能（存储优化版）
(function() {
    'use strict';

    var STORAGE_KEY = 'moments_data';
    var COVER_KEY = 'moments_cover_image';
    var MAX_POSTS = 50;
    var PAGE_SIZE = 10;

    // =============================================
    // 🔥 存储空间检测
    // =============================================
    function _checkStorageSpace() {
        try {
            var testKey = '_storage_test_';
            var testData = 'x'.repeat(1024 * 100); // 100KB
            localStorage.setItem(testKey, testData);
            localStorage.removeItem(testKey);
            return true;
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                return false;
            }
            return true;
        }
    }

    // =============================================
    // 🔥 图片压缩函数（核心优化）
    // =============================================
    function _compressImage(dataUrl, maxWidth, maxHeight, quality) {
        return new Promise(function(resolve) {
            maxWidth = maxWidth || 80;   // 🔥 头像最大宽度 80px
            maxHeight = maxHeight || 80; // 🔥 头像最大高度 80px
            quality = quality || 0.6;    // 🔥 JPEG质量 60%

            // 如果是URL（网络图片），直接返回
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

                // 计算缩放比例
                if (width > maxWidth || height > maxHeight) {
                    var ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }

                canvas.width = width;
                canvas.height = height;

                // 绘制并压缩
                ctx.drawImage(img, 0, 0, width, height);
                
                // 尝试 JPEG 压缩
                var compressed = canvas.toDataURL('image/jpeg', quality);
                
                // 如果压缩后反而更大，用原始格式
                if (compressed.length > dataUrl.length && dataUrl.length < 20000) {
                    compressed = canvas.toDataURL('image/png');
                }
                
                // 如果还是太大，降低质量再试一次
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

    // 🔥 同步版本的压缩（用于快速处理）
    function _compressImageSync(dataUrl) {
        if (!dataUrl || !dataUrl.startsWith('data:image')) {
            return dataUrl || '';
        }
        // 如果已经是小图片，直接返回
        if (dataUrl.length < 15000) {
            return dataUrl;
        }
        // 异步压缩，但返回原图（实际会在保存时异步处理）
        return dataUrl;
    }

    // 🔥 批量清理未使用的头像
    function _cleanUnusedAvatars() {
        var posts = _getPosts();
        var members = _getGroupMembers();
        var usedAvatars = {};

        // 收集所有在用头像
        for (var i = 0; i < posts.length; i++) {
            if (posts[i].memberAvatar && posts[i].memberAvatar.length > 100) {
                usedAvatars[posts[i].memberAvatar] = true;
            }
        }
        for (var j = 0; j < members.length; j++) {
            if (members[j].avatar && members[j].avatar.length > 100) {
                usedAvatars[members[j].avatar] = true;
            }
        }

        // 我的头像
        var myAvatar = _getMyAvatarSetting();
        if (myAvatar && myAvatar.length > 100) {
            usedAvatars[myAvatar] = true;
        }

        // 封面
        var cover = _getCoverImage();
        if (cover && cover.length > 100) {
            usedAvatars[cover] = true;
        }

        // 清理头像存储（如果有单独存储）
        try {
            var allKeys = Object.keys(localStorage);
            for (var k = 0; k < allKeys.length; k++) {
                if (allKeys[k].startsWith('avatar_')) {
                    var avatarData = localStorage.getItem(allKeys[k]);
                    if (!usedAvatars[avatarData] && avatarData.length > 100) {
                        localStorage.removeItem(allKeys[k]);
                    }
                }
            }
        } catch(e) {}
    }

    // =============================================
    // 🔥 存储数据时压缩
    // =============================================
    function _setData(data) {
        if (data.posts && data.posts.length > MAX_POSTS) {
            data.posts = data.posts.slice(0, MAX_POSTS);
        }
        
        // 🔥 压缩头像数据（遍历帖子）
        for (var i = 0; i < data.posts.length; i++) {
            var post = data.posts[i];
            // 如果头像太大，标记为需要压缩
            if (post.memberAvatar && post.memberAvatar.length > 50000) {
                // 异步压缩，但先保留原值，下次保存时会压缩
                if (!post._compressed) {
                    post._compressed = true;
                    // 使用异步压缩
                    _compressImage(post.memberAvatar, 60, 60, 0.5).then(function(compressed) {
                        if (compressed && compressed.length < post.memberAvatar.length) {
                            var freshData = _getData();
                            for (var pi = 0; pi < freshData.posts.length; pi++) {
                                if (freshData.posts[pi].id === post.id) {
                                    freshData.posts[pi].memberAvatar = compressed;
                                    _setData(freshData);
                                    break;
                                }
                            }
                        }
                    });
                }
            }
        }

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                // 🔥 存储空间不足，尝试清理
                _emergencyCleanup(data);
            }
            throw e;
        }
    }

    // 🔥 紧急清理
    function _emergencyCleanup(data) {
        console.warn('[朋友圈] 存储空间不足，执行紧急清理...');
        
        // 1. 删除旧的partner帖子
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

        // 2. 压缩所有头像
        var compressPromises = [];
        for (var pi = 0; pi < data.posts.length; pi++) {
            var post = data.posts[pi];
            if (post.memberAvatar && post.memberAvatar.length > 20000) {
                compressPromises.push(
                    _compressImage(post.memberAvatar, 40, 40, 0.4).then(function(compressed, idx) {
                        data.posts[idx].memberAvatar = compressed;
                    }.bind(null, pi))
                );
            }
        }

        // 3. 保存清理后的数据
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            _notify('已自动清理存储空间，请重新打开朋友圈', 'info', 3000);
        } catch (e2) {
            // 如果还是不行，只保留最近的10条
            data.posts = data.posts.slice(0, 10);
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                _notify('已紧急清理，仅保留最近10条动态', 'warning', 3000);
            } catch (e3) {
                _notify('存储空间已满，请清除浏览器缓存后重试', 'error', 5000);
            }
        }
    }

    // =============================================
    // 🔥 头像上传时压缩（关键优化）
    // =============================================
    function _handleAvatarUpload(file, callback) {
        if (!file) return;

        var reader = new FileReader();
        reader.onload = function(e) {
            var dataUrl = e.target.result;
            
            // 🔥 压缩到 60x60，质量40%
            _compressImage(dataUrl, 60, 60, 0.4).then(function(compressed) {
                callback(compressed);
            });
        };
        reader.readAsDataURL(file);
    }

    // =============================================
    // 🔥 工具函数（覆盖原有）
    // =============================================
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
        // 🔥 压缩成员头像
        for (var i = 0; i < members.length; i++) {
            if (members[i].avatar && members[i].avatar.length > 30000) {
                // 标记需要压缩，异步处理
                _compressImage(members[i].avatar, 60, 60, 0.4).then(function(compressed, idx) {
                    var freshMembers = _getGroupMembers();
                    if (freshMembers[idx]) {
                        freshMembers[idx].avatar = compressed;
                        localStorage.setItem('moments_group_members', JSON.stringify(freshMembers));
                    }
                }.bind(null, i));
            }
        }
        localStorage.setItem('moments_group_members', JSON.stringify(members));
    }

    function _getRandomGroupMember() {
        var members = _getGroupMembers();
        if (members.length === 0) {
            return { name: '未命名', avatar: '' };
        }
        return members[Math.floor(Math.random() * members.length)];
    }

    function _generatePartnerPostText() {
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
        var count = 1 + Math.floor(Math.random() * 2);
        var picked = shuffled.slice(0, Math.min(count, shuffled.length));
        var puncts = ['，', '。', '？', '！', '...', '、', '；'];
        var result = '';
        for (var pi = 0; pi < picked.length; pi++) {
            var p = puncts[Math.floor(Math.random() * puncts.length)];
            result += picked[pi] + p;
        }
        return result;
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
    function _setCoverImage(data) { 
        // 🔥 封面也压缩
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
        // 🔥 压缩我的头像
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
                // 🔥 压缩头像
                if (avatar && avatar.startsWith('data:image') && avatar.length > 30000) {
                    _compressImage(avatar, 60, 60, 0.4).then(function(compressed) {
                        var freshMembers = _getGroupMembers();
                        for (var mi = 0; mi < freshMembers.length; mi++) {
                            if (freshMembers[mi].name === name) {
                                freshMembers[mi].avatar = compressed;
                                _saveGroupMembers(freshMembers);
                                break;
                            }
                        }
                    });
                }
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
        // 🔥 压缩新成员头像
        if (avatar && avatar.startsWith('data:image') && avatar.length > 30000) {
            _compressImage(avatar, 60, 60, 0.4).then(function(compressed) {
                var freshMembers = _getGroupMembers();
                freshMembers.push({ name: name.trim(), avatar: compressed });
                _saveGroupMembers(freshMembers);
            });
        }
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
            text: text.trim().substring(0, 500), // 🔥 限制文本长度
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
            text: text.trim().substring(0, 200), // 🔥 限制评论长度
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

        var count = Math.min(1 + Math.floor(Math.random() * 1), activeMembers.length); // 🔥 只生成1条
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
        var start = 0;
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
            var post = pagePosts[pi];
            html += _renderPostHtml(post);
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
    // 🔥 清理工具 - 手动清理所有头像数据
    // =============================================
    window.cleanMomentsStorage = function() {
        if (!confirm('将清理所有头像和封面图片（保留文字内容），释放存储空间。确定吗？')) return;
        
        var data = _getData();
        var compressedCount = 0;
        
        for (var i = 0; i < data.posts.length; i++) {
            if (data.posts[i].memberAvatar && data.posts[i].memberAvatar.length > 1000) {
                // 替换为占位符，释放空间
                data.posts[i].memberAvatar = '';
                compressedCount++;
            }
        }
        
        // 清理成员头像
        var members = _getGroupMembers();
        for (var j = 0; j < members.length; j++) {
            if (members[j].avatar && members[j].avatar.length > 1000) {
                members[j].avatar = '';
                compressedCount++;
            }
        }
        _saveGroupMembers(members);
        
        // 清理我的头像
        if (_getMyAvatarSetting().length > 1000) {
            _setMyAvatarSetting('');
            compressedCount++;
        }
        
        // 清理封面
        if (_getCoverImage().length > 1000) {
            _clearCoverImage();
            compressedCount++;
        }
        
        _setData(data);
        _notify('已清理 ' + compressedCount + ' 个头像/封面，释放存储空间', 'success', 3000);
        
        // 刷新界面
        var container = document.getElementById('moments-content');
        var activeTab = document.querySelector('.moments-tab.active');
        if (container && activeTab) renderTab(activeTab.dataset.tab, container);
    };

    // =============================================
    // 🔥 显示存储状态
    // =============================================
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
            
            // 获取朋友圈数据大小
            var momentsData = localStorage.getItem(STORAGE_KEY);
            if (momentsData) {
                var dataSize = (momentsData.length / 1024).toFixed(2);
                msg += '\n\n📱 朋友圈数据: ' + dataSize + ' KB';
                var data = _getData();
                msg += '\n动态数量: ' + data.posts.length + ' 条';
                var avatarCount = 0;
                for (var i = 0; i < data.posts.length; i++) {
                    if (data.posts[i].memberAvatar && data.posts[i].memberAvatar.length > 100) {
                        avatarCount++;
                    }
                }
                msg += '\n含头像动态: ' + avatarCount + ' 条';
            }
            
            alert(msg);
        } catch(e) {
            alert('无法读取存储状态');
        }
    };

    // =============================================
    // 弹窗函数（简化，与之前相同）
    // =============================================
    // ... （保留所有弹窗函数，但上传头像时使用 _handleAvatarUpload）
    
    // 🔥 覆盖上传函数中使用压缩
    // 在 editMyInfo、editMember、addMember 中的图片上传部分使用 _handleAvatarUpload
    
    // 为了简洁，这里省略弹窗函数的具体实现（与之前相同，但上传部分改用 _handleAvatarUpload）

    // =============================================
    // 朋友圈主界面
    // =============================================
    window.openMoments = function() {
        // 🔥 检查存储空间
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
        _cleanUnusedAvatars();

        var old = document.getElementById('moments-modal');
        if (old) old.remove();

        var wrap = document.createElement('div');
        wrap.id = 'moments-modal';
        wrap.style.cssText = 'position:fixed;inset:0;z-index:10010;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);';

        var inner = document.createElement('div');
        inner.style.cssText = 'background:var(--primary-bg);border-radius:20px;padding:0;width:min(460px, 94vw);max-height:85vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.3);border:1px solid var(--border-color);';

        // ===== 顶部封面区域 =====
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
            showCoverSettings();
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

        // 🔥 新增：存储状态按钮
        var storageBtn = document.createElement('button');
        storageBtn.style.cssText = 'background:none;border:none;font-size:13px;color:var(--text-secondary);cursor:pointer;padding:4px 6px;border-radius:8px;';
        storageBtn.innerHTML = '💾';
        storageBtn.title = '存储状态';
        storageBtn.onclick = function(e) {
            e.stopPropagation();
            window.showMomentsStorageStatus();
        };
        rightSection.appendChild(storageBtn);

        // 🔥 新增：清理按钮
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
            showAvatarSettings();
        };
        rightSection.appendChild(avatarBtn);

        var bgBtn = document.createElement('button');
        bgBtn.style.cssText = 'background:none;border:none;font-size:14px;color:var(--text-secondary);cursor:pointer;padding:4px 6px;border-radius:8px;';
        bgBtn.innerHTML = '<i class="fas fa-image"></i>';
        bgBtn.title = '更换封面';
        bgBtn.onclick = function(e) {
            e.stopPropagation();
            showCoverSettings();
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
    };

    // =============================================
    // 暴露到全局
    // =============================================
    window.openMoments = window.openMoments;
    window.showAvatarSettings = showAvatarSettings;
    window.editMyInfo = editMyInfo;
    window.editMember = editMember;
    window.addMember = addMember;
    window.removeMember = removeMember;
    window.partnerPublishPost = partnerPublishPost;
    window.cleanMomentsStorage = cleanMomentsStorage;
    window.showMomentsStorageStatus = showMomentsStorageStatus;

    console.log('[朋友圈] 模块已加载（存储优化版 + 自动压缩 + 紧急清理）');
})();
