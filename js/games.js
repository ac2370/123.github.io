// games.js - 保留词云和收藏功能，删除抉择和占卜
(function() {

    // =============================================
    // 1. 词云功能
    // =============================================
    var STOP_WORDS = new Set([
        '的','了','是','我','你','他','她','它','们','这','那','有','在','就','也','都',
        '和','与','或','但','不','没','很','太','更','最','已','被','让','把','对','从',
        '到','于','以','为','之','其','而','则','所','等','啊','哦','嗯','哈','呢','吧',
        '吗','嘛','呀','哇','哎','唉','嗯嗯','哈哈','嘻嘻','呵呵','哦哦','啊啊','哈哈哈',
        '一','二','三','四','五','六','七','八','九','十','个','次','条','件','种',
        '好','行','可以','可','又','再','还','来','去','说','想','知道','觉得','感觉',
        '什么','怎么','为什么','哪','谁','哪里','怎样','如何','这么','那么',
        '然后','因为','所以','如果','虽然','但是','而且','不过','只是','只有',
        '没有','不是','还是','就是','真的','对啊','好的','好吧','那个','这个',
        '今天','昨天','明天','现在','以前','以后','时候','时间','一下','一直','一个',
        'ok','OK','Ok','yes','no','hh','hhhh','hhh','嗯','额',
        '图片','表情','语音','【图片】','【表情】','【语音】','撤回了一条消息','已撤回'
    ]);

    function tokenize(text) {
        text = text
            .replace(/https?:\/\/\S+/g, '')
            .replace(/\[.*?\]/g, '')
            .replace(/<[^>]+>/g, '')
            .replace(/[^\u4e00-\u9fa5a-zA-Z]/g, ' ')
            .toLowerCase();
        var words = {};
        var cn = text.replace(/[a-z ]/g, '');
        var covered = new Array(cn.length).fill(false);
        for (var i = 0; i + 4 <= cn.length; i++) {
            var w4 = cn.slice(i, i + 4);
            if (!STOP_WORDS.has(w4)) {
                words[w4] = (words[w4] || 0) + 2.4;
                covered[i] = covered[i+1] = covered[i+2] = covered[i+3] = true;
                i += 3;
            }
        }
        covered = new Array(cn.length).fill(false);
        for (var j = 0; j + 3 <= cn.length; j++) {
            var w3 = cn.slice(j, j + 3);
            if (!STOP_WORDS.has(w3)) {
                words[w3] = (words[w3] || 0) + 1.8;
                j += 2;
            }
        }
        for (var k = 0; k + 2 <= cn.length; k += 2) {
            var w2 = cn.slice(k, k + 2);
            if (!STOP_WORDS.has(w2)) {
                words[w2] = (words[w2] || 0) + 1;
            }
        }
        (text.match(/[a-z]{3,}/g) || []).forEach(function(w) {
            if (!STOP_WORDS.has(w)) words[w] = (words[w] || 0) + 1;
        });
        return words;
    }

    function mergeFreq(a, b) {
        var o = Object.assign({}, a);
        Object.keys(b).forEach(function(k) { o[k] = (o[k] || 0) + b[k]; });
        return o;
    }

    function topWords(freq, n) {
        var min = Object.keys(freq).length > 60 ? 2 : 1;
        return Object.entries(freq)
            .filter(function(e) { return e[1] >= min && e[0].length >= 2; })
            .sort(function(a, b) { return b[1] - a[1]; })
            .slice(0, n)
            .map(function(e) { return { word: e[0], count: e[1] }; });
    }

    function resolveFont() {
        var el = document.createElement('span');
        el.style.cssText = 'position:absolute;visibility:hidden;font-family:var(--font-family)';
        document.body.appendChild(el);
        var f = getComputedStyle(el).fontFamily || '"PingFang SC","Microsoft YaHei",sans-serif';
        document.body.removeChild(el);
        return f;
    }

    function hex3(hex) {
        hex = hex.replace('#','');
        if (hex.length === 3) hex = hex.split('').map(function(c){return c+c;}).join('');
        var n = parseInt(hex, 16);
        return [(n>>16)&255, (n>>8)&255, n&255];
    }

    function drawWordCloud(canvas, words) {
        var ctx   = canvas.getContext('2d');
        var dpr   = window.devicePixelRatio || 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        var W = canvas.width / dpr;
        var H = canvas.height / dpr;

        var cs     = getComputedStyle(document.documentElement);
        var accent = cs.getPropertyValue('--accent-color').trim() || '#c5a47e';
        var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        var rgb    = hex3(accent);
        var font   = resolveFont();

        ctx.fillStyle = isDark ? '#141414' : '#ffffff';
        ctx.fillRect(0, 0, W, H);

        if (!words.length) return;

        var maxC = words[0].count;
        var minC = words[words.length - 1].count;
        var placed = [];

        var MIN_F = 11, MAX_F = 54;

        function fontSize(c) {
            if (maxC === minC) return 24;
            var t = Math.log(1 + c - minC) / Math.log(1 + maxC - minC);
            return Math.round(MIN_F + t * (MAX_F - MIN_F));
        }

        function wordAlpha(idx, total) {
            if (idx === 0) return 1.0;
            if (idx < 3)   return 0.82;
            if (idx < 8)   return 0.64;
            if (idx < 20)  return 0.46;
            return Math.max(0.20, 0.46 - (idx - 20) / total * 0.25);
        }

        function tilt(word, idx) {
            if (idx < 5) return 0;
            var h = 0;
            for (var i = 0; i < word.length; i++) h = (h * 31 + word.charCodeAt(i)) | 0;
            return (Math.abs(h) % 6 === 0) ? (Math.PI / 2) : 0;
        }

        function overlaps(x, y, w, h, pad) {
            for (var i = 0; i < placed.length; i++) {
                var p = placed[i];
                if (x - pad < p.x + p.w && x + w + pad > p.x &&
                    y - pad < p.y + p.h && y + h + pad > p.y) return true;
            }
            return false;
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 0;

        words.forEach(function(item, idx) {
            var fs  = fontSize(item.count);
            var fw  = idx < 2 ? '800' : idx < 8 ? '600' : '400';
            var rot = tilt(item.word, idx);
            var a   = wordAlpha(idx, words.length);

            ctx.font = fw + ' ' + fs + 'px ' + font;
            var tw = ctx.measureText(item.word).width;
            var th = fs * 1.25;

            var bw = rot !== 0 ? th + 2 : tw;
            var bh = rot !== 0 ? tw + 2 : th;
            var pad = idx < 3 ? 9 : idx < 12 ? 4 : 2;

            var placed_ = false;
            var cx = W / 2, cy = H / 2;

            for (var t = 0; t < 320; t += 0.09) {
                var ang = t * 2.2;
                var r   = 1.8 * ang;
                var bx  = cx + r * Math.cos(ang) * 1.2 - bw / 2;
                var by  = cy + r * Math.sin(ang) * 0.88 - bh / 2;

                if (bx >= pad && by >= pad && bx + bw <= W - pad && by + bh <= H - pad) {
                    if (!overlaps(bx, by, bw, bh, pad)) {
                        ctx.save();
                        ctx.globalAlpha = a;
                        ctx.fillStyle = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')';
                        ctx.translate(bx + bw/2, by + bh/2);
                        ctx.rotate(rot);
                        ctx.fillText(item.word, 0, 0);
                        ctx.restore();
                        placed.push({ x: bx, y: by, w: bw, h: bh });
                        placed_ = true;
                        break;
                    }
                }
            }

            if (!placed_) {
                var fsS = Math.max(10, fs * 0.58);
                ctx.font = '400 ' + fsS + 'px ' + font;
                var tw2 = ctx.measureText(item.word).width + 2;
                var th2 = fsS * 1.25;
                for (var fb = 0; fb < 60; fb++) {
                    var fx = 6 + Math.random() * (W - tw2 - 12);
                    var fy = 6 + Math.random() * (H - th2 - 12);
                    if (!overlaps(fx, fy, tw2, th2, 2)) {
                        ctx.save();
                        ctx.globalAlpha = Math.min(a, 0.32);
                        ctx.fillStyle = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')';
                        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                        ctx.fillText(item.word, fx, fy);
                        ctx.restore();
                        placed.push({ x: fx, y: fy, w: tw2, h: th2 });
                        break;
                    }
                }
            }
        });
    }

    window.renderWordCloud = function() {
        var container = document.getElementById('wordcloud-container');
        if (!container) return;

        if (typeof messages === 'undefined' || !messages || !messages.length) {
            container.innerHTML = '<div class="wc-empty"><i class="fas fa-ghost"></i><p>还没有聊天记录</p><span>多聊几句，词云就会出现～</span></div>';
            return;
        }

        var pName = (typeof settings !== 'undefined' && settings.partnerName) ? settings.partnerName : '对方';
        var mName = (typeof settings !== 'undefined' && settings.myName)      ? settings.myName      : '我';

        var partnerMsgs = messages.filter(function(m) { return m.sender !== 'user' && m.text && m.type !== 'system' && m.type !== 'call-event'; });
        var myMsgs      = messages.filter(function(m) { return m.sender === 'user' && m.text && m.type !== 'system' && m.type !== 'call-event'; });

        var pFreq = {}, mFreq = {};
        partnerMsgs.forEach(function(m) { pFreq = mergeFreq(pFreq, tokenize(m.text)); });
        myMsgs.forEach(function(m)      { mFreq = mergeFreq(mFreq, tokenize(m.text)); });
        var aFreq = mergeFreq(pFreq, mFreq);

        var pTop = topWords(pFreq, 60);
        var mTop = topWords(mFreq, 60);
        var aTop = topWords(aFreq, 60);

        var cur = container._currentView || 'all';

        function data(v) {
            if (v === 'partner') return { words: pTop, total: partnerMsgs.length };
            if (v === 'me')      return { words: mTop, total: myMsgs.length };
            return { words: aTop, total: partnerMsgs.length + myMsgs.length };
        }

        function renderRank(words) {
            var el = container.querySelector('.wc-rank-list');
            if (!el) return;
            if (!words.length) { el.innerHTML = '<div class="wc-rank-empty">暂无数据</div>'; return; }
            var cs     = getComputedStyle(document.documentElement);
            var accent = cs.getPropertyValue('--accent-color').trim() || '#c5a47e';
            var rgb    = hex3(accent);
            var max    = words[0].count;
            el.innerHTML = words.slice(0, 10).map(function(item, i) {
                var pct = Math.round(item.count / max * 100);
                var numStyle = i < 3
                    ? 'color:rgb('+rgb[0]+','+rgb[1]+','+rgb[2]+');font-weight:700;'
                    : 'color:var(--text-secondary);font-weight:500;';
                return '<div class="wc-rank-item">'
                    + '<span class="wc-rank-num" style="'+numStyle+'">' + (i < 9 ? '0'+(i+1) : i+1) + '</span>'
                    + '<span class="wc-rank-word">' + item.word + '</span>'
                    + '<div class="wc-rank-bar-wrap">'
                    +   '<div class="wc-rank-bar" style="width:'+pct+'%;background:rgba('+rgb[0]+','+rgb[1]+','+rgb[2]+','+(0.2+pct/100*0.6)+');"></div>'
                    + '</div>'
                    + '<span class="wc-rank-count">' + Math.round(item.count) + '</span>'
                    + '</div>';
            }).join('');
        }

        function renderSummary(d) {
            var el = container.querySelector('.wc-summary');
            if (!el) return;
            el.innerHTML =
                '<span class="wc-summary-pill"><i class="fas fa-comment-dots"></i> ' + d.total + ' 条</span>'
                + '<span class="wc-summary-pill"><i class="fas fa-font"></i> ' + d.words.length + ' 词</span>';
        }

        function renderView(v) {
            container._currentView = v;
            container.querySelectorAll('.wc-view-btn').forEach(function(b) {
                b.classList.toggle('active', b.dataset.view === v);
            });
            var canvas = container.querySelector('#wc-canvas');
            if (!canvas) return;
            var d = data(v);
            drawWordCloud(canvas, d.words);
            renderRank(d.words);
            renderSummary(d);
        }

        if (!container.querySelector('#wc-canvas')) {
            var dpr = window.devicePixelRatio || 1;
            var cw  = Math.min(container.offsetWidth || (container.parentElement && container.parentElement.offsetWidth) || 340, 500);
            var ch  = Math.round(cw * 0.72);

            container.innerHTML =
                '<div class="wc-header">'
                +   '<div class="wc-tabs"><div class="wc-tabs-track">'
                +     '<button class="wc-view-btn'+(cur==='all'?' active':'')+'" data-view="all">全部</button>'
                +     '<button class="wc-view-btn'+(cur==='partner'?' active':'')+'" data-view="partner">'+pName+'</button>'
                +     '<button class="wc-view-btn'+(cur==='me'?' active':'')+'" data-view="me">'+mName+'</button>'
                +   '</div></div>'
                +   '<button class="wc-regen-btn" title="换一种布局"><i class="fas fa-redo"></i></button>'
                + '</div>'
                + '<div class="wc-summary"></div>'
                + '<div class="wc-canvas-wrap">'
                +   '<canvas id="wc-canvas" width="'+(cw*dpr)+'" height="'+(ch*dpr)+'" style="width:'+cw+'px;height:'+ch+'px;display:block;"></canvas>'
                + '</div>'
                + '<div class="wc-rank-section">'
                +   '<div class="wc-rank-title"><i class="fas fa-bars"></i> 高频词 Top 10</div>'
                +   '<div class="wc-rank-list"></div>'
                + '</div>';

            container.querySelector('.wc-tabs-track').addEventListener('click', function(e) {
                var b = e.target.closest('.wc-view-btn');
                if (b) renderView(b.dataset.view);
            });
            container.querySelector('.wc-regen-btn').addEventListener('click', function() {
                var canvas = container.querySelector('#wc-canvas');
                var d = data(container._currentView);
                var shuffled = d.words.slice().sort(function(a, b) {
                    return a.count !== b.count ? b.count - a.count : Math.random() - 0.5;
                });
                drawWordCloud(canvas, shuffled);
            });
        }

        renderView(cur);
    };

    // =============================================
    // 2. 收藏功能
    // =============================================
    function renderFavorites() {
        var list = document.getElementById('favorites-list');
        if (!list) return;

        var favoritedMessages = (typeof messages !== 'undefined' ? messages : [])
            .filter(function(m) { return m.favorited && m.type !== 'system'; });

        if (favoritedMessages.length === 0) {
            list.innerHTML = `
                <div class="stats-empty-state">
                    <div class="stats-empty-icon"><i class="fas fa-star"></i></div>
                    <h3>收藏夹空空如也</h3>
                    <p>点击消息旁的 ☆ 星标即可收藏</p>
                </div>`;
            return;
        }

        list.innerHTML = favoritedMessages.map(function(msg) {
            var isUser = msg.sender === 'user';
            var senderName = isUser
                ? ((typeof settings !== 'undefined' && settings.myName) || '我')
                : ((typeof settings !== 'undefined' && settings.partnerName) || msg.sender || '对方');
            var ts = msg.timestamp ? new Date(msg.timestamp).toLocaleString('zh-CN', {
                month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            }) : '';
            var content = msg.text
                ? msg.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')
                : (msg.image ? '<img src="' + msg.image + '" style="max-width:100%;max-height:180px;border-radius:8px;display:block;margin-top:4px;cursor:pointer;" onclick="if(typeof viewImage===\'function\')viewImage(\'' + msg.image.replace(/'/g,'\\\'') + '\')" loading="lazy">' : '');
            var avatarEl = isUser
                ? (typeof DOMElements !== 'undefined' ? DOMElements.me.avatar : null)
                : (typeof DOMElements !== 'undefined' ? DOMElements.partner.avatar : null);
            var avatarImg = avatarEl ? avatarEl.querySelector('img') : null;
            var avatarHtml = avatarImg
                ? '<img src="' + avatarImg.src + '" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0;">'
                : '<div style="width:28px;height:28px;border-radius:50%;background:rgba(var(--accent-color-rgb),0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fas fa-user" style="font-size:11px;color:var(--accent-color);"></i></div>';
            return `
                <div class="fav-item" style="
                    display:flex;flex-direction:column;gap:4px;
                    padding:12px 14px;border-radius:12px;
                    background:var(--primary-bg);
                    border:1px solid var(--border-color);
                    margin-bottom:10px;
                    position:relative;
                ">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                        ${avatarHtml}
                        <span style="font-size:12px;font-weight:600;color:var(--accent-color);">${senderName}</span>
                        <span style="font-size:11px;color:var(--text-secondary);margin-left:auto;padding-right:24px;">${ts}</span>
                    </div>
                    <div style="font-size:13px;color:var(--text-primary);line-height:1.5;word-break:break-word;">${content}</div>
                    <button class="fav-remove-btn" data-id="${msg.id}" style="
                        position:absolute;top:8px;right:10px;
                        background:none;border:none;cursor:pointer;
                        color:var(--text-secondary);font-size:14px;padding:2px 4px;
                        opacity:0.6;
                    " title="取消收藏"><i class="fas fa-star" style="color:var(--accent-color);"></i></button>
                </div>`;
        }).join('');

        list.querySelectorAll('.fav-remove-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var id = Number(btn.dataset.id);
                var msg = (typeof messages !== 'undefined' ? messages : []).find(function(m) { return m.id === id; });
                if (msg) {
                    msg.favorited = false;
                    if (typeof throttledSaveData === 'function') throttledSaveData();
                    if (typeof showNotification === 'function') showNotification('已取消收藏', 'success', 1500);
                    renderFavorites();
                }
            });
        });
    }
    window.renderFavorites = renderFavorites;

    // =============================================
    // 3. 消息搜索功能
    // =============================================
    window._runMsgSearch = function() {
        var input = document.getElementById('msg-search-input');
        var dateFrom = document.getElementById('msg-search-date-from');
        var dateTo = document.getElementById('msg-search-date-to');
        var resultsEl = document.getElementById('msg-search-results');
        if (!resultsEl) return;

        var q = (input ? input.value.trim() : '').toLowerCase();
        var from = dateFrom && dateFrom.value ? new Date(dateFrom.value) : null;
        var to = dateTo && dateTo.value ? new Date(dateTo.value + 'T23:59:59') : null;

        if (!q && !from && !to) {
            resultsEl.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-secondary);font-size:13px;">输入关键词或选择日期开始搜索</div>';
            return;
        }

        var allMessages = typeof messages !== 'undefined' ? messages : [];
        var results = allMessages.filter(function(m) {
            if (m.type === 'system') return false;
            var ts = m.timestamp ? new Date(m.timestamp) : null;
            if (from && ts && ts < from) return false;
            if (to && ts && ts > to) return false;
            if (q && m.text && m.text.toLowerCase().includes(q)) return true;
            return !q;
        });

        if (results.length === 0) {
            resultsEl.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-secondary);font-size:13px;">未找到 "' + (q || '相关') + '" 的消息</div>';
            return;
        }

        var myAvatarEl = typeof DOMElements !== 'undefined' ? DOMElements.me.avatar : null;
        var partnerAvatarEl = typeof DOMElements !== 'undefined' ? DOMElements.partner.avatar : null;
        var myImg = myAvatarEl ? myAvatarEl.querySelector('img') : null;
        var partnerImg = partnerAvatarEl ? partnerAvatarEl.querySelector('img') : null;

        function getAvatarHtml(isUser) {
            var img = isUser ? myImg : partnerImg;
            if (img) return '<img src="' + img.src + '" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0;">';
            return '<div style="width:28px;height:28px;border-radius:50%;background:rgba(var(--accent-color-rgb),0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fas fa-user" style="font-size:11px;color:var(--accent-color);"></i></div>';
        }

        function highlight(text, keyword) {
            if (!keyword) return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            var escaped = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            var re = new RegExp('(' + keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
            return escaped.replace(re, '<mark style="background:rgba(var(--accent-color-rgb),0.25);color:var(--accent-color);border-radius:2px;padding:0 1px;">$1</mark>');
        }

        resultsEl.innerHTML = results.slice(0, 100).map(function(msg) {
            var isUser = msg.sender === 'user';
            var senderName = isUser
                ? ((typeof settings !== 'undefined' && settings.myName) || '我')
                : ((typeof settings !== 'undefined' && settings.partnerName) || msg.sender || '对方');
            var ts = msg.timestamp ? new Date(msg.timestamp).toLocaleString('zh-CN', {
                month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
            }) : '';
            var content = msg.text
                ? highlight(msg.text, q)
                : (msg.image ? '<img src="' + msg.image + '" style="max-height:60px;border-radius:6px;display:block;margin-top:4px;" loading="lazy">' : '');
            return '<div style="display:flex;gap:10px;align-items:flex-start;padding:11px 12px;border-radius:12px;background:var(--primary-bg);border:1px solid var(--border-color);margin-bottom:8px;cursor:pointer;" onclick="if(typeof showNotification===\'function\')showNotification(\'已定位消息\', \'info\', 1500); if(typeof scrollToQuotedMessage===\'function\'){var el=document.createElement(\'div\');el.dataset.replyId=\'' + msg.id + '\';scrollToQuotedMessage(el);}">'
                + getAvatarHtml(isUser)
                + '<div style="flex:1;min-width:0;">'
                +   '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">'
                +     '<span style="font-size:12px;font-weight:600;color:var(--accent-color);">' + senderName + '</span>'
                +     '<span style="font-size:11px;color:var(--text-secondary);">' + ts + '</span>'
                +   '</div>'
                +   '<div style="font-size:13px;color:var(--text-primary);line-height:1.5;word-break:break-word;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">' + content + '</div>'
                + '</div>'
                + '</div>';
        }).join('') + (results.length > 100 ? '<div style="text-align:center;padding:10px;font-size:12px;color:var(--text-secondary);">仅显示前100条，共找到 ' + results.length + ' 条</div>' : '');
    };

    // =============================================
    // 4. 初始化
    // =============================================
    console.log('[games.js] 已加载（仅保留词云和收藏功能）');

})();
