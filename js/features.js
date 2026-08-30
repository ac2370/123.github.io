(function() {
    var KEY = 'keepaliveAudioEnabled';
    // ⬇️ 改成您的音频文件名，只改引号里的内容
    var SRC = '123.m4a';  // 您的音频文件名
    var _audio = null;
    var _unlockBound = false;

    function _get() { return localStorage.getItem(KEY) === 'true'; }

    function _createAudio() {
        if (_audio) return _audio;
        _audio = new Audio(SRC);  // 使用 SRC 变量
        _audio.loop   = true;
        _audio.volume = 0.01;
        _audio.preload = 'auto';
        return _audio;
    }

    function _setUI(playing) {
        var dot  = document.getElementById('keepalive-dot');
        var desc = document.getElementById('keepalive-audio-desc');
        var sw   = document.getElementById('keepalive-audio-switch');
        var row  = document.getElementById('keepalive-bar-row');

        if (sw)   sw.classList.toggle('active', _get());
        if (dot) {
            dot.className = 'keepalive-dot' + (playing ? ' alive' : '');
        }
        if (desc) {
            if (!_get())      desc.textContent = '静音循环音频，防止页面被系统挂起';
            else if (playing) desc.textContent = '运行中 · 页面已保活';
            else              desc.textContent = '等待交互后启动…';
        }
        if (row)  row.style.display = _get() ? 'flex' : 'none';
        var bars = document.querySelectorAll('.keepalive-wave-bar');
        bars.forEach(function(b){ b.style.animationPlayState = playing ? 'running' : 'paused'; });
    }

    function _start() {
        var a = _createAudio();
        var p = a.play();
        if (p && p.then) {
            p.catch(function(){
                _setUI(false);
                if (!_unlockBound) {
                    _unlockBound = true;
                    function unlock(){ if(_get()) a.play().catch(function(){}); _unlockBound=false; }
                    document.addEventListener('touchstart', unlock, { once:true });
                    document.addEventListener('click',      unlock, { once:true });
                }
            });
        }
    }

    function _stop() {
        if (_audio) { _audio.pause(); _audio.currentTime = 0; }
        _setUI(false);
    }

    window._toggleKeepaliveAudio = function() {
        var next = !_get();
        localStorage.setItem(KEY, String(next));
        if (next) {
            _start();
            if (typeof showNotification === 'function') showNotification('保活音频已开启 🎵', 'success', 2000);
        } else {
            _stop();
            if (typeof showNotification === 'function') showNotification('保活音频已关闭', 'info', 1500);
        }
        _setUI(next && _audio && !_audio.paused);
    };

    document.addEventListener('visibilitychange', function(){
        if (_get() && document.visibilityState === 'visible' && _audio && _audio.paused) {
            _audio.play().catch(function(){});
        }
    });

    document.addEventListener('DOMContentLoaded', function(){
        _setUI(false);
        if (_get()) _start();
    });
    setTimeout(function(){
        _setUI(_get() && !!_audio && !_audio.paused);
        if (_get() && (!_audio || _audio.paused)) _start();
    }, 1800);
})();
