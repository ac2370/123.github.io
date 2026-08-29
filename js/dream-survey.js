// dream-survey.js - 完整梦向问卷系统（含问卷池、多题问卷、回复模拟）
(function() {
    'use strict';

    // =============================================
    // 1. 配置与常量
    // =============================================
    const DAILY_KEY = 'dreamSurvey_daily';
    const CUSTOM_KEY = 'dreamSurvey_custom_list';
    const QUESTIONNAIRES_KEY = 'dreamSurvey_questionnaires';
    const HISTORY_KEY = 'dreamSurvey_history';

    // 内置恋爱向每日问题池
    const DEFAULT_QUESTIONS = [
        { q: '你最喜欢我身上哪个小习惯？', type: 'choice', options: ['笑容', '声音', '走路姿势', '说话语气'] },
        { q: '我们第一次约会时，你心里在想什么？', type: 'choice', options: ['好紧张', 'TA好可爱', '时间过快点', '想牵TA的手'] },
        { q: '你希望我们下次旅行去哪里？', type: 'choice', options: ['海边', '雪山', '古镇', '游乐园'] },
        { q: '我做过最让你心动的一件事是什么？', type: 'text' },
        { q: '如果只能用3个词形容我们的关系，你会选哪3个？', type: 'text' },
        { q: '你更喜欢清晨醒来看到我，还是夜晚睡前抱着我？', type: 'choice', options: ['清晨', '夜晚', '都要！', '听你的'] },
        { q: '你觉得我像什么动物？为什么？', type: 'text' },
        { q: '如果我们一起养宠物，你想养什么？', type: 'choice', options: ['狗', '猫', '兔子', '仓鼠'] },
        { q: '你最近一次偷偷想我是什么时候？', type: 'text' },
        { q: '你更喜欢拥抱还是亲吻？', type: 'choice', options: ['拥抱', '亲吻', '击掌', '都超爱'] },
        { q: '你觉得我们之间最默契的一件事是什么？', type: 'text' },
        { q: '如果明天是世界末日，你今天最想和我做什么？', type: 'choice', options: ['吃大餐', '看电影', '聊天到天亮', '紧紧抱着'] },
        { q: '我的哪句话曾让你瞬间破防？', type: 'text' },
        { q: '你觉得我们十年后会在哪里？', type: 'choice', options: ['还是老地方', '环游世界', '有了自己的家', '只要有彼此就行'] },
        { q: '今天想对我说的一句悄悄话是？', type: 'text' }
    ];

    // =============================================
    // 2. 工具函数
    // =============================================
    function _getCustomList() {
        try { return JSON.parse(localStorage.getItem(CUSTOM_KEY)) || []; } catch { return []; }
    }
    function _setCustomList(list) {
        localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
    }
    function _getDailyRecord() {
        try { return JSON.parse(localStorage.getItem(DAILY_KEY)) || {}; } catch { return {}; }
    }
    function _setDailyRecord(rec) {
        localStorage.setItem(DAILY_KEY, JSON.stringify(rec));
    }
    function _getQuestionnaires() {
        try { return JSON.parse(localStorage.getItem(QUESTIONNAIRES_KEY)) || []; } catch { return []; }
    }
    function _setQuestionnaires(list) {
        localStorage.setItem(QUESTIONNAIRES_KEY, JSON.stringify(list));
    }
    function _getHistory() {
        try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; }
    }
    function _addHistory(entry) {
        const h = _getHistory();
        h.push(entry);
        if (h.length > 100) h.shift();
        localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
    }

    function _getAllQuestions() {
        const customs = _getCustomList();
        return [...DEFAULT_QUESTIONS, ...customs];
    }

    function _getReplyCards() {
        let cards = [];
        if (window.customReplies && Array.isArray(window.customReplies)) {
            cards = window.customReplies.map(c => typeof c === 'string' ? c : (c.text || c.label || ''));
        }
        try {
            const stored = localStorage.getItem('customReplies');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    cards = parsed.map(c => typeof c === 'string' ? c : (c.text || c.label || ''));
                }
            }
        } catch(e) {}
        if (cards.length === 0) {
            cards = ['早安', '晚安', '想你', '抱抱', '亲亲', '开心', '好梦', '今天超棒', '别担心', '有我在'];
        }
        return [...new Set(cards.filter(c => c && c.trim()))];
    }

    function _getPartnerName() {
        return (typeof settings !== 'undefined' && settings.partnerName) ? settings.partnerName : '亲爱的';
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

    function _sendAsMessage(text, isSystem) {
        isSystem = isSystem || false;
        if (typeof addMessage === 'function') {
            addMessage({
                id: Date.now() + Math.random(),
                sender: 'user',
                text: text,
                timestamp: new Date(),
                type: isSystem ? 'system' : 'normal',
                status: 'sent'
            });
            if (typeof playSound === 'function') playSound('send');
        } else {
            console.warn('[梦向问卷] addMessage 未定义，但已记录:', text);
        }
    }

    function _generateId() {
        return Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    }

    // =============================================
    // 3. 每日随机弹出（触发概率 50%）
    // =============================================
    function _checkDailyPopup() {
        const today = new Date().toDateString();
        const record = _getDailyRecord();
        
        if (record.lastDate === today) {
            console.log('[梦向问卷] 今天已弹出过，跳过');
            return;
        }
        
        const PROBABILITY = 0.5;
        if (Math.random() > PROBABILITY) {
            console.log('[梦向问卷] 随机概率未命中（50%），今日不弹出');
            return;
        }
        
        const allQ = _getAllQuestions();
        if (allQ.length === 0) {
            console.log('[梦向问卷] 没有问题池');
            return;
        }
        
        const question = _randomPick(allQ);
        record.lastDate = today;
        _setDailyRecord(record);
        
        console.log('[梦向问卷] 触发每日弹出:', question.q);
        _showSurveyModal(question, true);
    }

    // =============================================
    // 4. 答题弹窗（每日随机用）
    // =============================================
    function _showSurveyModal(question, isDaily) {
        isDaily = isDaily || false;
        const old = document.getElementById('dream-survey-popup');
        if (old) old.remove();

        const wrap = document.createElement('div');
        wrap.id = 'dream-survey-popup';
        wrap.style.cssText = 'position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);';

        const inner = document.createElement('div');
        inner.style.cssText = 'background:var(--primary-bg);border-radius:24px;padding:28px 24px;width:min(420px, 90vw);max-height:80vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,0.3);border:1px solid var(--border-color);';

        const isChoice = question.type === 'choice';
        const options = question.options || [];

        inner.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;"><span style="font-size:16px;font-weight:600;color:var(--text-secondary);">' + (isDaily ? '🌸 今日梦向问卷' : '📋 问卷') + '</span><button id="survey-popup-close" style="background:none;border:none;font-size:20px;color:var(--text-secondary);cursor:pointer;">✕</button></div><div style="font-size:18px;font-weight:600;color:var(--text-primary);margin-bottom:16px;line-height:1.6;">' + _esc(question.q) + '</div><div id="survey-answer-area">' + (isChoice ? options.map(function(opt, idx) { return '<label style="display:flex;align-items:center;gap:10px;padding:10px 14px;margin-bottom:6px;background:var(--secondary-bg);border-radius:12px;border:1.5px solid transparent;cursor:pointer;"><input type="radio" name="survey_answer" value="' + _esc(opt) + '" style="accent-color:var(--accent-color);width:18px;height:18px;cursor:pointer;"><span style="font-size:15px;color:var(--text-primary);">' + _esc(opt) + '</span></label>'; }).join('') : '<textarea id="survey-text-input" rows="4" placeholder="写下你的回答..." style="width:100%;padding:12px;border:1.5px solid var(--border-color);border-radius:12px;background:var(--secondary-bg);color:var(--text-primary);font-size:14px;resize:vertical;box-sizing:border-box;font-family:var(--font-family);"></textarea>') + '</div><div style="display:flex;gap:10px;margin-top:18px;"><button id="survey-skip" style="flex:1;padding:10px;border:1px solid var(--border-color);border-radius:12px;background:var(--secondary-bg);color:var(--text-secondary);font-size:14px;cursor:pointer;">跳过</button><button id="survey-submit" style="flex:2;padding:10px;border:none;border-radius:12px;background:var(--accent-color);color:#fff;font-size:14px;font-weight:700;cursor:pointer;">回答</button></div>';

        wrap.appendChild(inner);
        document.body.appendChild(wrap);

        var close = function() { wrap.remove(); };
        document.getElementById('survey-popup-close').onclick = close;
        document.getElementById('survey-skip').onclick = close;
        wrap.onclick = function(e) { if (e.target === wrap) close(); };

        document.getElementById('survey-submit').onclick = function() {
            var answer = '';
            if (isChoice) {
                var selected = document.querySelector('input[name="survey_answer"]:checked');
                if (!selected) { _notify('请选择一个选项', 'warning'); return; }
                answer = selected.value;
            } else {
                var input = document.getElementById('survey-text-input');
                if (!input || !input.value.trim()) { _notify('请写下你的回答', 'warning'); return; }
                answer = input.value.trim();
            }

            _addHistory({
                date: new Date().toISOString(),
                question: question.q,
                answer: answer,
                isDaily: isDaily
            });

            var pName = _getPartnerName();
            var myName = _getMyName();
            _sendAsMessage('📝 问卷回答：「' + question.q + '」\n→ ' + myName + '：' + answer, false);

            var cards = _getReplyCards();
            var replyMsg = _randomPick(cards) + '～';
            setTimeout(function() {
                _sendAsMessage('💬 ' + pName + '：' + replyMsg, false);
            }, 1500 + Math.random() * 3000);

            close();
            _notify('回答已发送 ✨', 'success', 2000);
        };
    }

    // =============================================
    // 5. 主面板
    // =============================================
    window.openDreamSurveyManager = function() {
        var old = document.getElementById('dream-manager-modal');
        if (old) old.remove();

        var wrap = document.createElement('div');
        wrap.id = 'dream-manager-modal';
        wrap.style.cssText = 'position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);';

        var inner = document.createElement('div');
        inner.style.cssText = 'background:var(--primary-bg);border-radius:24px;padding:24px 20px;width:min(460px, 92vw);max-height:80vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,0.3);border:1px solid var(--border-color);display:flex;flex-direction:column;';

        var header = document.createElement('div');
        header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;';
        header.innerHTML = '<span style="font-size:20px;font-weight:700;color:var(--text-primary);">🧸 梦向问卷</span><button id="dream-manager-close" style="background:none;border:none;font-size:22px;color:var(--text-secondary);cursor:pointer;">✕</button>';
        inner.appendChild(header);

        var actionRow = document.createElement('div');
        actionRow.style.cssText = 'display:flex;gap:10px;margin-bottom:16px;';
        var btnPool = document.createElement('button');
        btnPool.textContent = '📥 添加问卷池';
        btnPool.style.cssText = 'flex:1;padding:10px;border:1px solid var(--border-color);border-radius:12px;background:var(--secondary-bg);color:var(--text-primary);font-size:14px;cursor:pointer;font-weight:600;';
        btnPool.onclick = function() {
            wrap.remove();
            openSingleQuestionEditor();
        };
        var btnCreate = document.createElement('button');
        btnCreate.textContent = '📝 创建问卷';
        btnCreate.style.cssText = 'flex:1;padding:10px;border:none;border-radius:12px;background:var(--accent-color);color:#fff;font-size:14px;cursor:pointer;font-weight:600;';
        btnCreate.onclick = function() {
            wrap.remove();
            openQuestionnaireEditor(null);
        };
        actionRow.appendChild(btnPool);
        actionRow.appendChild(btnCreate);
        inner.appendChild(actionRow);

        var listTitle = document.createElement('div');
        listTitle.style.cssText = 'font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:8px;';
        listTitle.textContent = '我的问卷';
        inner.appendChild(listTitle);

        var listContainer = document.createElement('div');
        listContainer.id = 'dream-manager-list';
        listContainer.style.cssText = 'flex:1;overflow-y:auto;max-height:40vh;';

        renderQuestionnaireList(listContainer);

        inner.appendChild(listContainer);

        var closeBtn = document.createElement('button');
        closeBtn.textContent = '关闭';
        closeBtn.style.cssText = 'margin-top:12px;padding:10px;border:1px solid var(--border-color);border-radius:12px;background:var(--secondary-bg);color:var(--text-secondary);font-size:14px;cursor:pointer;width:100%;';
        closeBtn.onclick = function() { wrap.remove(); };
        inner.appendChild(closeBtn);

        wrap.appendChild(inner);
        document.body.appendChild(wrap);

        wrap.addEventListener('click', function(e) {
            if (e.target === wrap) wrap.remove();
        });
        document.getElementById('dream-manager-close').addEventListener('click', function() { wrap.remove(); });
    };

    // =============================================
    // 6. 渲染问卷列表
    // =============================================
    function renderQuestionnaireList(container) {
        var list = _getQuestionnaires();
        if (list.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:30px 20px;color:var(--text-secondary);"><div style="font-size:32px;margin-bottom:8px;">📋</div><div style="font-size:14px;">还没有问卷</div><div style="font-size:12px;opacity:0.7;">点击上方按钮创建吧~</div></div>';
            return;
        }
        var html = '<div style="display:flex;flex-direction:column;gap:10px;">';
        for (var i = 0; i < list.length; i++) {
            var q = list[i];
            var totalQuestions = q.questions ? q.questions.length : 0;
            var status = q.replied ? '✅ 已回复' : (q.sent ? '⏳ 已发送' : '📄 未发送');
            var typeLabel = '填空题';
            if (q.questions) {
                var hasChoice = false;
                var hasText = false;
                for (var j = 0; j < q.questions.length; j++) {
                    if (q.questions[j].type === 'choice') hasChoice = true;
                    if (q.questions[j].type === 'text') hasText = true;
                }
                if (hasChoice && hasText) typeLabel = '混合';
                else if (hasChoice) typeLabel = '选择题';
                else typeLabel = '填空题';
            }
            var replyTimeLabel = q.replyTime === 'immediate' ? '立即回复' : '随机时间';
            html += '<div style="display:flex;flex-direction:column;padding:12px 14px;background:var(--secondary-bg);border-radius:12px;border:1px solid var(--border-color);"><div style="display:flex;justify-content:space-between;align-items:center;"><div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:600;color:var(--text-primary);">' + _esc(q.title || '未命名问卷') + '</div><div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">' + totalQuestions + ' 题 · ' + typeLabel + ' · ' + replyTimeLabel + '</div></div><div style="font-size:12px;color:' + (q.replied ? 'var(--accent-color)' : 'var(--text-secondary)') + ';">' + status + '</div></div><div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">' + (!q.sent ? '<button class="q-send-btn" data-id="' + q.id + '" style="padding:4px 12px;border:none;border-radius:8px;background:var(--accent-color);color:#fff;font-size:12px;cursor:pointer;">发送问卷</button>' : '') + (q.replied ? '<button class="q-view-btn" data-id="' + q.id + '" style="padding:4px 12px;border:1px solid var(--border-color);border-radius:8px;background:var(--secondary-bg);color:var(--text-primary);font-size:12px;cursor:pointer;">查看回复</button>' : '') + '<button class="q-delete-btn" data-id="' + q.id + '" style="padding:4px 12px;border:1px solid var(--border-color);border-radius:8px;background:transparent;color:#ff6b6b;font-size:12px;cursor:pointer;">删除</button></div></div>';
        }
        html += '</div>';
        container.innerHTML = html;

        var sendBtns = container.querySelectorAll('.q-send-btn');
        for (var si = 0; si < sendBtns.length; si++) {
            (function(btn) {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var id = this.dataset.id;
                    sendQuestionnaire(id);
                });
            })(sendBtns[si]);
        }
        var viewBtns = container.querySelectorAll('.q-view-btn');
        for (var vi = 0; vi < viewBtns.length; vi++) {
            (function(btn) {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var id = this.dataset.id;
                    viewQuestionnaireReply(id);
                });
            })(viewBtns[vi]);
        }
        var delBtns = container.querySelectorAll('.q-delete-btn');
        for (var di = 0; di < delBtns.length; di++) {
            (function(btn) {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var id = this.dataset.id;
                    if (confirm('确定要删除此问卷吗？')) {
                        var list2 = _getQuestionnaires();
                        var newList = [];
                        for (var k = 0; k < list2.length; k++) {
                            if (list2[k].id !== id) newList.push(list2[k]);
                        }
                        _setQuestionnaires(newList);
                        var container2 = document.getElementById('dream-manager-list');
                        if (container2) renderQuestionnaireList(container2);
                        _notify('已删除', 'info');
                    }
                });
            })(delBtns[di]);
        }
    }

    // =============================================
    // 7. 添加问卷池（单题编辑器）
    // =============================================
    function openSingleQuestionEditor() {
        var old = document.getElementById('dream-single-editor');
        if (old) old.remove();

        var wrap = document.createElement('div');
        wrap.id = 'dream-single-editor';
        wrap.style.cssText = 'position:fixed;inset:0;z-index:10002;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(12px);';

        var inner = document.createElement('div');
        inner.style.cssText = 'background:var(--primary-bg);border-radius:24px;padding:28px 24px;width:min(460px, 92vw);max-height:85vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,0.3);border:1px solid var(--border-color);';

        inner.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;"><span style="font-size:20px;font-weight:700;color:var(--text-primary);">🧸 创建梦向问卷</span><button id="single-editor-close" style="background:none;border:none;font-size:22px;color:var(--text-secondary);cursor:pointer;">✕</button></div><div style="margin-bottom:14px;"><label style="font-weight:600;color:var(--text-primary);font-size:14px;">问题内容 *</label><input id="single-q-input" type="text" placeholder="例如：你今天最想和我分享什么？" style="width:100%;padding:10px;border:1.5px solid var(--border-color);border-radius:10px;background:var(--secondary-bg);color:var(--text-primary);font-size:14px;margin-top:4px;box-sizing:border-box;font-family:var(--font-family);"></div><div style="margin-bottom:14px;"><label style="font-weight:600;color:var(--text-primary);font-size:14px;">题型</label><select id="single-type-select" style="width:100%;padding:10px;border:1.5px solid var(--border-color);border-radius:10px;background:var(--secondary-bg);color:var(--text-primary);font-size:14px;margin-top:4px;font-family:var(--font-family);"><option value="choice">选择题（单选）</option><option value="text">填空题</option></select></div><div id="single-options-wrap" style="margin-bottom:16px;"><label style="font-weight:600;color:var(--text-primary);font-size:14px;">选项（仅选择题需要，用英文逗号分隔）</label><input id="single-options-input" type="text" placeholder="例如：选项A, 选项B, 选项C" style="width:100%;padding:10px;border:1.5px solid var(--border-color);border-radius:10px;background:var(--secondary-bg);color:var(--text-primary);font-size:14px;margin-top:4px;box-sizing:border-box;font-family:var(--font-family);"></div><div style="display:flex;gap:10px;margin-top:8px;"><button id="single-cancel" style="flex:1;padding:11px;border:1px solid var(--border-color);border-radius:12px;background:var(--secondary-bg);color:var(--text-secondary);font-size:14px;cursor:pointer;">取消</button><button id="single-save" style="flex:2;padding:11px;border:none;border-radius:12px;background:var(--accent-color);color:#fff;font-size:14px;font-weight:700;cursor:pointer;">保存到问卷池</button></div>';

        wrap.appendChild(inner);
        document.body.appendChild(wrap);

        var close = function() { wrap.remove(); };
        document.getElementById('single-editor-close').onclick = close;
        document.getElementById('single-cancel').onclick = close;
        wrap.onclick = function(e) { if (e.target === wrap) close(); };

        var typeSelect = document.getElementById('single-type-select');
        var optWrap = document.getElementById('single-options-wrap');
        typeSelect.onchange = function() {
            optWrap.style.display = typeSelect.value === 'choice' ? 'block' : 'none';
        };

        document.getElementById('single-save').onclick = function() {
            var q = document.getElementById('single-q-input').value.trim();
            if (!q) { _notify('请输入问题内容', 'warning'); return; }
            var type = typeSelect.value;
            var options = [];
            if (type === 'choice') {
                var raw = document.getElementById('single-options-input').value.trim();
                options = raw.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s; });
                if (options.length < 2) { _notify('选择题至少需要2个选项', 'warning'); return; }
            }
            var questionnaire = {
                id: _generateId(),
                title: q.length > 20 ? q.slice(0, 20) + '...' : q,
                questions: [{
                    id: _generateId(),
                    text: q,
                    type: type,
                    options: options
                }],
                replyTime: 'immediate',
                created: new Date().toISOString(),
                sent: false,
                replied: false,
                answers: {}
            };
            var list = _getQuestionnaires();
            list.push(questionnaire);
            _setQuestionnaires(list);
            close();
            _notify('✅ 已添加到问卷池', 'success');
            var manager = document.getElementById('dream-manager-modal');
            if (manager) {
                var container = document.getElementById('dream-manager-list');
                if (container) renderQuestionnaireList(container);
            }
        };
    }

    // =============================================
    // 8. 创建/编辑问卷（多题编辑器）
    // =============================================
    function openQuestionnaireEditor(existingId) {
        var old = document.getElementById('dream-editor-modal');
        if (old) old.remove();

        var editingData = null;
        if (existingId) {
            var list = _getQuestionnaires();
            for (var i = 0; i < list.length; i++) {
                if (list[i].id === existingId) { editingData = list[i]; break; }
            }
            if (!editingData) { _notify('问卷不存在', 'error'); return; }
        }

        var wrap = document.createElement('div');
        wrap.id = 'dream-editor-modal';
        wrap.style.cssText = 'position:fixed;inset:0;z-index:10003;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(12px);';

        var inner = document.createElement('div');
        inner.style.cssText = 'background:var(--primary-bg);border-radius:24px;padding:28px 24px;width:min(480px, 94vw);max-height:85vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,0.3);border:1px solid var(--border-color);';

        var header = document.createElement('div');
        header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;';
        header.innerHTML = '<span style="font-size:20px;font-weight:700;color:var(--text-primary);">🧸 ' + (editingData ? '编辑问卷' : '创建问卷') + '</span><button id="editor-close" style="background:none;border:none;font-size:22px;color:var(--text-secondary);cursor:pointer;">✕</button>';
        inner.appendChild(header);

        var titleGroup = document.createElement('div');
        titleGroup.style.cssText = 'margin-bottom:14px;';
        titleGroup.innerHTML = '<label style="font-weight:600;color:var(--text-primary);font-size:14px;">问卷标题 *</label><input id="editor-title-input" type="text" placeholder="例如：关于我的小调查" value="' + (editingData ? _esc(editingData.title) : '') + '" style="width:100%;padding:10px;border:1.5px solid var(--border-color);border-radius:10px;background:var(--secondary-bg);color:var(--text-primary);font-size:14px;margin-top:4px;box-sizing:border-box;font-family:var(--font-family);">';
        inner.appendChild(titleGroup);

        var timeGroup = document.createElement('div');
        timeGroup.style.cssText = 'margin-bottom:16px;';
        timeGroup.innerHTML = '<label style="font-weight:600;color:var(--text-primary);font-size:14px;display:block;margin-bottom:6px;">回复时间</label><div style="display:flex;gap:10px;"><button class="editor-time-btn active" data-value="immediate" style="flex:1;padding:8px;border:2px solid var(--accent-color);border-radius:10px;background:rgba(var(--accent-color-rgb),0.1);color:var(--text-primary);font-size:13px;cursor:pointer;font-family:var(--font-family);">立即收到</button><button class="editor-time-btn" data-value="random" style="flex:1;padding:8px;border:2px solid var(--border-color);border-radius:10px;background:var(--secondary-bg);color:var(--text-secondary);font-size:13px;cursor:pointer;font-family:var(--font-family);">随机时间</button></div><div id="editor-time-hint" style="font-size:11px;color:var(--text-secondary);margin-top:6px;opacity:0.7;">对方将在 1 小时内随机时间完成</div>';
        inner.appendChild(timeGroup);

        var questionList = document.createElement('div');
        questionList.id = 'editor-question-list';
        questionList.style.cssText = 'margin-bottom:12px;max-height:300px;overflow-y:auto;';

        var questions = editingData ? JSON.parse(JSON.stringify(editingData.questions)) : [];

        function renderQuestions() {
            questionList.innerHTML = '';
            if (questions.length === 0) {
                questionList.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-secondary);font-size:13px;">暂无题目，点击下方按钮添加</div>';
                return;
            }
            for (var idx = 0; idx < questions.length; idx++) {
                var q2 = questions[idx];
                var div = document.createElement('div');
                div.style.cssText = 'background:var(--secondary-bg);border-radius:12px;padding:12px 14px;margin-bottom:8px;border:1px solid var(--border-color);';
                var typeLabel = q2.type === 'choice' ? '选择题' : '填空题';
                var optionsHtml = '';
                if (q2.type === 'choice' && q2.options) {
                    for (var oi = 0; oi < q2.options.length; oi++) {
                        optionsHtml += '<span style="display:inline-block;background:rgba(var(--accent-color-rgb),0.08);padding:2px 8px;border-radius:12px;margin:2px 4px 2px 0;font-size:11px;">' + _esc(q2.options[oi]) + '</span>';
                    }
                }
                div.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:flex-start;"><div style="flex:1;"><div style="font-weight:600;font-size:14px;color:var(--text-primary);">' + (idx+1) + '. ' + _esc(q2.text) + '</div><div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">' + typeLabel + (optionsHtml ? ' · ' + optionsHtml : '') + '</div></div><button class="q-remove-btn" data-index="' + idx + '" style="background:none;border:none;color:#ff6b6b;cursor:pointer;font-size:16px;">✕</button></div>';
                questionList.appendChild(div);
            }
            var removeBtns = questionList.querySelectorAll('.q-remove-btn');
            for (var ri = 0; ri < removeBtns.length; ri++) {
                (function(btn) {
                    btn.addEventListener('click', function() {
                        var idx2 = parseInt(this.dataset.index);
                        questions.splice(idx2, 1);
                        renderQuestions();
                    });
                })(removeBtns[ri]);
            }
        }
        renderQuestions();

        inner.appendChild(questionList);

        var addBtn = document.createElement('button');
        addBtn.textContent = '+ 添加题目';
        addBtn.style.cssText = 'width:100%;padding:10px;border:1.5px dashed var(--border-color);border-radius:12px;background:transparent;color:var(--text-secondary);font-size:13px;cursor:pointer;margin-bottom:16px;font-family:var(--font-family);';
        addBtn.onclick = function() {
            var newQ = { id: _generateId(), text: '新题目', type: 'choice', options: ['选项1', '选项2'] };
            var idx = questions.length;
            questions.push(newQ);
            openQuestionEditorInline(newQ, idx, function(updated) {
                if (updated) {
                    questions[idx] = updated;
                    renderQuestions();
                } else {
                    questions.pop();
                    renderQuestions();
                }
            });
        };
        inner.appendChild(addBtn);

        var btnGroup = document.createElement('div');
        btnGroup.style.cssText = 'display:flex;gap:10px;margin-top:8px;';
        var cancelBtn = document.createElement('button');
        cancelBtn.textContent = '返回';
        cancelBtn.style.cssText = 'flex:1;padding:11px;border:1px solid var(--border-color);border-radius:12px;background:var(--secondary-bg);color:var(--text-secondary);font-size:14px;cursor:pointer;';
        cancelBtn.onclick = function() { wrap.remove(); };
        var saveBtn = document.createElement('button');
        saveBtn.textContent = '💾 保存问卷';
        saveBtn.style.cssText = 'flex:2;padding:11px;border:none;border-radius:12px;background:var(--accent-color);color:#fff;font-size:14px;font-weight:700;cursor:pointer;';
        saveBtn.onclick = function() {
            var title = document.getElementById('editor-title-input').value.trim();
            if (!title) { _notify('请输入问卷标题', 'warning'); return; }
            if (questions.length === 0) { _notify('请至少添加一道题目', 'warning'); return; }
            for (var qi = 0; qi < questions.length; qi++) {
                if (!questions[qi].text.trim()) { _notify('所有题目内容不能为空', 'warning'); return; }
                if (questions[qi].type === 'choice' && (!questions[qi].options || questions[qi].options.length < 2)) {
                    _notify('选择题至少需要2个选项', 'warning'); return;
                }
            }
            var timeBtn = document.querySelector('.editor-time-btn.active');
            var replyTime = timeBtn ? timeBtn.dataset.value : 'immediate';

            var list2 = _getQuestionnaires();
            if (editingData) {
                var idx2 = -1;
                for (var li = 0; li < list2.length; li++) {
                    if (list2[li].id === editingData.id) { idx2 = li; break; }
                }
                if (idx2 !== -1) {
                    list2[idx2].title = title;
                    list2[idx2].questions = questions;
                    list2[idx2].replyTime = replyTime;
                    _setQuestionnaires(list2);
                    _notify('问卷已更新', 'success');
                }
            } else {
                var newQ2 = {
                    id: _generateId(),
                    title: title,
                    questions: questions,
                    replyTime: replyTime,
                    created: new Date().toISOString(),
                    sent: false,
                    replied: false,
                    answers: {}
                };
                list2.push(newQ2);
                _setQuestionnaires(list2);
                _notify('问卷已保存', 'success');
            }
            wrap.remove();
            var manager = document.getElementById('dream-manager-modal');
            if (manager) {
                var container = document.getElementById('dream-manager-list');
                if (container) renderQuestionnaireList(container);
            } else {
                window.openDreamSurveyManager();
            }
        };
        btnGroup.appendChild(cancelBtn);
        btnGroup.appendChild(saveBtn);
        inner.appendChild(btnGroup);

        wrap.appendChild(inner);
        document.body.appendChild(wrap);

        document.getElementById('editor-close').onclick = function() { wrap.remove(); };
        wrap.onclick = function(e) { if (e.target === wrap) wrap.remove(); };

        var timeBtns = timeGroup.querySelectorAll('.editor-time-btn');
        for (var tb = 0; tb < timeBtns.length; tb++) {
            (function(btn) {
                btn.addEventListener('click', function() {
                    var btns = timeGroup.querySelectorAll('.editor-time-btn');
                    for (var b2 = 0; b2 < btns.length; b2++) {
                        btns[b2].classList.remove('active');
                        btns[b2].style.borderColor = 'var(--border-color)';
                        btns[b2].style.background = 'var(--secondary-bg)';
                        btns[b2].style.color = 'var(--text-secondary)';
                    }
                    this.classList.add('active');
                    this.style.borderColor = 'var(--accent-color)';
                    this.style.background = 'rgba(var(--accent-color-rgb),0.1)';
                    this.style.color = 'var(--text-primary)';
                    var hint = document.getElementById('editor-time-hint');
                    if (this.dataset.value === 'immediate') {
                        hint.textContent = '对方将在 1 小时内随机时间完成';
                    } else {
                        hint.textContent = '对方将在 0 ~ 300 分钟内随机时间完成';
                    }
                });
            })(timeBtns[tb]);
        }
        if (editingData) {
            var timeVal = editingData.replyTime || 'immediate';
            var btn = timeGroup.querySelector('.editor-time-btn[data-value="' + timeVal + '"]');
            if (btn) btn.click();
        } else {
            var defaultBtn = timeGroup.querySelector('.editor-time-btn[data-value="immediate"]');
            if (defaultBtn) defaultBtn.click();
        }

        function openQuestionEditorInline(q, idx, callback) {
            var old2 = document.getElementById('q-editor-modal');
            if (old2) old2.remove();

            var wrap2 = document.createElement('div');
            wrap2.id = 'q-editor-modal';
            wrap2.style.cssText = 'position:fixed;inset:0;z-index:10004;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';
            var inner2 = document.createElement('div');
            inner2.style.cssText = 'background:var(--primary-bg);border-radius:20px;padding:24px;width:min(420px, 90vw);max-height:80vh;overflow-y:auto;border:1px solid var(--border-color);';
            inner2.innerHTML = '<div style="display:flex;justify-content:space-between;margin-bottom:14px;"><span style="font-size:18px;font-weight:700;color:var(--text-primary);">编辑题目</span><button id="q-editor-close" style="background:none;border:none;font-size:20px;cursor:pointer;">✕</button></div><div style="margin-bottom:10px;"><label style="font-weight:600;font-size:13px;">题目内容 *</label><input id="q-editor-text" type="text" value="' + _esc(q.text) + '" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:8px;background:var(--secondary-bg);color:var(--text-primary);font-size:14px;margin-top:4px;"></div><div style="margin-bottom:10px;"><label style="font-weight:600;font-size:13px;">题型</label><select id="q-editor-type" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:8px;background:var(--secondary-bg);color:var(--text-primary);font-size:14px;margin-top:4px;"><option value="choice" ' + (q.type === 'choice' ? 'selected' : '') + '>选择题</option><option value="text" ' + (q.type === 'text' ? 'selected' : '') + '>填空题</option></select></div><div id="q-editor-options-wrap" style="margin-bottom:10px;"><label style="font-weight:600;font-size:13px;">选项（逗号分隔）</label><input id="q-editor-options" type="text" value="' + (q.options ? q.options.join(', ') : '') + '" placeholder="选项A, 选项B, 选项C" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:8px;background:var(--secondary-bg);color:var(--text-primary);font-size:14px;margin-top:4px;"></div><div style="display:flex;gap:10px;margin-top:12px;"><button id="q-editor-cancel" style="flex:1;padding:9px;border:1px solid var(--border-color);border-radius:8px;background:var(--secondary-bg);color:var(--text-secondary);cursor:pointer;">取消</button><button id="q-editor-save" style="flex:2;padding:9px;border:none;border-radius:8px;background:var(--accent-color);color:#fff;font-weight:700;cursor:pointer;">保存</button></div>';
            wrap2.appendChild(inner2);
            document.body.appendChild(wrap2);

            var closeEditor = function() { wrap2.remove(); };
            document.getElementById('q-editor-close').onclick = closeEditor;
            document.getElementById('q-editor-cancel').onclick = function() {
                closeEditor();
                callback(null);
            };
            wrap2.onclick = function(e) { if (e.target === wrap2) { closeEditor(); callback(null); } };

            var typeSelect2 = document.getElementById('q-editor-type');
            var optWrap2 = document.getElementById('q-editor-options-wrap');
            typeSelect2.onchange = function() {
                optWrap2.style.display = this.value === 'choice' ? 'block' : 'none';
            };
            typeSelect2.dispatchEvent(new Event('change'));

            document.getElementById('q-editor-save').onclick = function() {
                var text = document.getElementById('q-editor-text').value.trim();
                if (!text) { _notify('请输入题目内容', 'warning'); return; }
                var type = typeSelect2.value;
                var options = [];
                if (type === 'choice') {
                    var raw = document.getElementById('q-editor-options').value.trim();
                    options = raw.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s; });
                    if (options.length < 2) { _notify('选择题至少需要2个选项', 'warning'); return; }
                }
                var updated = { id: q.id, text: text, type: type, options: options };
                closeEditor();
                callback(updated);
            };
        }
    }

    // =============================================
    // 9. 发送问卷
    // =============================================
    function sendQuestionnaire(id) {
        var list = _getQuestionnaires();
        var q = null;
        for (var i = 0; i < list.length; i++) {
            if (list[i].id === id) { q = list[i]; break; }
        }
        if (!q) { _notify('问卷不存在', 'error'); return; }
        if (q.sent) { _notify('该问卷已发送', 'info'); return; }

        var delayMinutes = 0;
        if (q.replyTime === 'immediate') {
            delayMinutes = Math.floor(Math.random() * 60) + 1;
        } else {
            delayMinutes = Math.floor(Math.random() * 300) + 1;
        }
        var delayMs = delayMinutes * 60 * 1000;

        q.sent = true;
        q.sentAt = new Date().toISOString();
        _setQuestionnaires(list);

        var pName = _getPartnerName();
        _sendAsMessage('📋 问卷「' + q.title + '」已发送，' + pName + ' 会在 ' + delayMinutes + ' 分钟内完成作答', true);

        var qId = q.id;
        setTimeout(function() {
            var currentList = _getQuestionnaires();
            var currentQ = null;
            for (var ci = 0; ci < currentList.length; ci++) {
                if (currentList[ci].id === qId) { currentQ = currentList[ci]; break; }
            }
            if (!currentQ) {
                console.warn('[梦向问卷] 问卷已被删除:', qId);
                return;
            }
            
            var answers = {};
            for (var qi = 0; qi < currentQ.questions.length; qi++) {
                var question = currentQ.questions[qi];
                if (question.type === 'choice') {
                    var options = question.options || [];
                    var chosen = options.length > 0 ? _randomPick(options) : '未选择';
                    answers[question.id] = chosen;
                } else {
                    var cards = _getReplyCards();
                    var count = Math.min(1 + Math.floor(Math.random() * 3), cards.length);
                    var shuffled = cards.slice();
                    for (var si = shuffled.length - 1; si > 0; si--) {
                        var sj = Math.floor(Math.random() * (si + 1));
                        var temp = shuffled[si];
                        shuffled[si] = shuffled[sj];
                        shuffled[sj] = temp;
                    }
                    var picked = shuffled.slice(0, count);
                    answers[question.id] = picked.join('');
                }
            }
            
            var finalList = _getQuestionnaires();
            var finalQ = null;
            for (var fi = 0; fi < finalList.length; fi++) {
                if (finalList[fi].id === qId) { finalQ = finalList[fi]; break; }
            }
            if (finalQ) {
                finalQ.replied = true;
                finalQ.answers = answers;
                _setQuestionnaires(finalList);
                _sendAsMessage('✅ ' + pName + ' 已完成问卷「' + finalQ.title + '」的作答！', true);
                var manager = document.getElementById('dream-manager-modal');
                if (manager) {
                    var container = document.getElementById('dream-manager-list');
                    if (container) renderQuestionnaireList(container);
                }
                _notify('对方已完成问卷作答！', 'success', 3000);
            }
        }, delayMs);

        _notify('问卷已发送，对方将在 ' + delayMinutes + ' 分钟内完成作答', 'success', 3000);
        var manager2 = document.getElementById('dream-manager-modal');
        if (manager2) {
            var container2 = document.getElementById('dream-manager-list');
            if (container2) renderQuestionnaireList(container2);
        }
    }

    // =============================================
    // 10. 查看回复
    // =============================================
    function viewQuestionnaireReply(id) {
        var list = _getQuestionnaires();
        var q = null;
        for (var i = 0; i < list.length; i++) {
            if (list[i].id === id) { q = list[i]; break; }
        }
        if (!q) {
            _notify('问卷不存在或已被删除', 'error');
            return;
        }
        if (!q.replied || !q.answers || Object.keys(q.answers).length === 0) {
            _notify('该问卷尚未收到回复', 'info');
            return;
        }

        var modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;inset:0;z-index:10005;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(10px);';
        var inner = document.createElement('div');
        inner.style.cssText = 'background:var(--primary-bg);border-radius:20px;padding:24px;width:min(440px, 92vw);max-height:80vh;overflow-y:auto;border:1px solid var(--border-color);';
        var html = '<div style="display:flex;justify-content:space-between;margin-bottom:12px;"><span style="font-size:18px;font-weight:700;">📋 ' + _esc(q.title) + '</span><button id="reply-close" style="background:none;border:none;font-size:20px;cursor:pointer;">✕</button></div>';
        
        var pName = _getPartnerName();
        html += '<div style="font-size:13px;color:var(--text-secondary);margin-bottom:14px;">💕 ' + pName + ' 的回答：</div>';
        
        for (var qi = 0; qi < q.questions.length; qi++) {
            var question = q.questions[qi];
            var answer = q.answers[question.id] || '未回答';
            html += '<div style="margin-bottom:12px;padding:10px;background:var(--secondary-bg);border-radius:10px;"><div style="font-weight:600;font-size:14px;color:var(--text-primary);">' + (qi+1) + '. ' + _esc(question.text) + '</div><div style="font-size:13px;color:var(--accent-color);margin-top:4px;">💬 ' + _esc(answer) + '</div></div>';
        }
        inner.innerHTML = html;
        modal.appendChild(inner);
        document.body.appendChild(modal);

        modal.querySelector('#reply-close').onclick = function() { modal.remove(); };
        modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
    }

    // =============================================
    // 11. 初始化
    // =============================================
    function _init() {
        console.log('[梦向问卷] 初始化中...');
        setTimeout(function() {
            console.log('[梦向问卷] 检查每日弹出（概率50%）...');
            _checkDailyPopup();
        }, 3000);
        
        setTimeout(function() {
            console.log('[梦向问卷] 备用检查每日弹出...');
            var record = _getDailyRecord();
            var today = new Date().toDateString();
            if (record.lastDate !== today) {
                _checkDailyPopup();
            }
        }, 5000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _init);
    } else {
        _init();
    }

    // =============================================
    // 12. 暴露全局方法
    // =============================================
    window.forceCheckDailySurvey = _checkDailyPopup;
    window.viewDreamHistory = function() {
        try {
            var h = _getHistory();
            if (h.length === 0) { _notify('暂无问卷回答记录', 'info'); return; }
            var last = h.slice(-10).reverse();
            var msg = '📜 最近10条问卷记录：\n';
            for (var i = 0; i < last.length; i++) {
                var date = new Date(last[i].date).toLocaleString();
                msg += '\n[' + date + '] ' + last[i].question + '\n→ ' + last[i].answer + '\n';
            }
            alert(msg);
        } catch(e) { alert('读取记录失败'); }
    };
    window.partnerAnswerSurvey = function(questionnaireId, answers) {
        var list = _getQuestionnaires();
        var q = null;
        for (var i = 0; i < list.length; i++) {
            if (list[i].id === questionnaireId) { q = list[i]; break; }
        }
        if (!q) { _notify('问卷不存在', 'error'); return; }
        q.replied = true;
        q.answers = answers || {};
        _setQuestionnaires(list);
        _notify('已手动标记问卷为已回复', 'success');
        var manager = document.getElementById('dream-manager-modal');
        if (manager) {
            var container = document.getElementById('dream-manager-list');
            if (container) renderQuestionnaireList(container);
        }
    };

    console.log('[梦向问卷] 完整系统已加载（触发概率50%）。');
})();
