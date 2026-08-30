// js/storage-manager.js - 使用 IndexedDB 替代 localStorage
(function() {
    'use strict';

    var DB_NAME = 'ChuanXunApp';
    var STORE_NAME = 'storage';
    var DB_VERSION = 1;

    var db = null;

    // =============================================
    // 初始化 IndexedDB
    // =============================================
    function initDB() {
        return new Promise(function(resolve, reject) {
            var request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onupgradeneeded = function(e) {
                var database = e.target.result;
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    var store = database.createObjectStore(STORE_NAME);
                    console.log('[存储] 创建 IndexedDB 存储');
                }
            };
            
            request.onsuccess = function(e) {
                db = e.target.result;
                console.log('[存储] IndexedDB 已连接');
                resolve(db);
            };
            
            request.onerror = function(e) {
                console.error('[存储] IndexedDB 打开失败:', e.target.error);
                reject(e.target.error);
            };
        });
    }

    // =============================================
    // 迁移 localStorage 数据到 IndexedDB
    // =============================================
    function migrateToIndexedDB() {
        if (!db) return;

        var tx = db.transaction(STORE_NAME, 'readwrite');
        var store = tx.objectStore(STORE_NAME);
        var count = 0;

        for (var key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                var value = localStorage.getItem(key);
                store.put(value, key);
                count++;
            }
        }

        tx.oncomplete = function() {
            console.log('[存储] 已迁移 ' + count + ' 项数据到 IndexedDB');
            
            // 迁移成功后，清理 localStorage 释放空间
            if (count > 0) {
                var shouldClear = confirm('数据已迁移到 IndexedDB，是否清除 localStorage 中的旧数据以释放空间？\n（建议选择「确定」）');
                if (shouldClear) {
                    for (var key in localStorage) {
                        if (localStorage.hasOwnProperty(key)) {
                            localStorage.removeItem(key);
                        }
                    }
                    console.log('[存储] localStorage 已清空');
                }
            }
        };

        tx.onerror = function(e) {
            console.error('[存储] 迁移失败:', e.target.error);
        };
    }

    // =============================================
    // 兼容 localStorage 接口
    // =============================================
    var _origSetItem = localStorage.setItem;
    var _origGetItem = localStorage.getItem;
    var _origRemoveItem = localStorage.removeItem;
    var _origClear = localStorage.clear;
    var _origKey = localStorage.key;
    var _origLength = Object.getOwnPropertyDescriptor(localStorage, 'length');

    // 重写 setItem
    localStorage.setItem = function(key, value) {
        // 同时写入 localStorage 和 IndexedDB
        _origSetItem.call(localStorage, key, value);
        
        if (db) {
            try {
                var tx = db.transaction(STORE_NAME, 'readwrite');
                var store = tx.objectStore(STORE_NAME);
                store.put(value, key);
            } catch(e) {
                console.warn('[存储] setItem 写入 IndexedDB 失败:', e);
            }
        }
    };

    // 重写 getItem
    localStorage.getItem = function(key) {
        // 先从 localStorage 读取
        var value = _origGetItem.call(localStorage, key);
        if (value !== null) {
            return value;
        }
        
        // 如果 localStorage 没有，从 IndexedDB 读取
        if (db) {
            try {
                var tx = db.transaction(STORE_NAME, 'readonly');
                var store = tx.objectStore(STORE_NAME);
                var request = store.get(key);
                request.onsuccess = function() {
                    if (request.result !== undefined) {
                        // 回写到 localStorage
                        _origSetItem.call(localStorage, key, request.result);
                    }
                };
            } catch(e) {
                console.warn('[存储] getItem 从 IndexedDB 读取失败:', e);
            }
            return null;
        }
        return null;
    };

    // 重写 removeItem
    localStorage.removeItem = function(key) {
        _origRemoveItem.call(localStorage, key);
        if (db) {
            try {
                var tx = db.transaction(STORE_NAME, 'readwrite');
                var store = tx.objectStore(STORE_NAME);
                store.delete(key);
            } catch(e) {
                console.warn('[存储] removeItem 失败:', e);
            }
        }
    };

    // 重写 clear
    localStorage.clear = function() {
        _origClear.call(localStorage);
        if (db) {
            try {
                var tx = db.transaction(STORE_NAME, 'readwrite');
                var store = tx.objectStore(STORE_NAME);
                store.clear();
            } catch(e) {
                console.warn('[存储] clear 失败:', e);
            }
        }
    };

    // 保持 length 属性兼容
    Object.defineProperty(localStorage, 'length', {
        get: function() {
            var count = 0;
            for (var key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    count++;
                }
            }
            return count;
        },
        enumerable: true,
        configurable: true
    });

    // 保持 key 方法兼容
    localStorage.key = function(index) {
        var keys = [];
        for (var key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                keys.push(key);
            }
        }
        return keys[index] || null;
    };

    // =============================================
    // 工具方法
    // =============================================
    window.StorageManager = {
        // 获取 IndexedDB 中的数据大小
        getSize: function() {
            return new Promise(function(resolve) {
                if (!db) {
                    resolve('0 KB');
                    return;
                }
                var tx = db.transaction(STORE_NAME, 'readonly');
                var store = tx.objectStore(STORE_NAME);
                var request = store.getAll();
                request.onsuccess = function() {
                    var data = request.result;
                    var size = 0;
                    for (var i = 0; i < data.length; i++) {
                        size += data[i].length || 0;
                    }
                    resolve((size / 1024).toFixed(1) + ' KB');
                };
                request.onerror = function() {
                    resolve('无法计算');
                };
            });
        },

        // 手动迁移数据
        migrate: function() {
            if (confirm('将把 localStorage 中的所有数据迁移到 IndexedDB，确定继续吗？')) {
                migrateToIndexedDB();
            }
        },

        // 强制从 IndexedDB 恢复数据到 localStorage
        restore: function() {
            if (!db || !confirm('从 IndexedDB 恢复数据到 localStorage？')) return;
            
            var tx = db.transaction(STORE_NAME, 'readonly');
            var store = tx.objectStore(STORE_NAME);
            var request = store.getAll();
            request.onsuccess = function() {
                var items = request.result;
                for (var key in items) {
                    localStorage.setItem(key, items[key]);
                }
                alert('已恢复 ' + Object.keys(items).length + ' 项数据');
            };
        }
    };

    // =============================================
    // 启动
    // =============================================
    initDB().then(function() {
        // 检查是否需要迁移
        var hasData = false;
        for (var key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                hasData = true;
                break;
            }
        }
        
        if (hasData) {
            // 检查 IndexedDB 中是否已有数据
            var tx = db.transaction(STORE_NAME, 'readonly');
            var store = tx.objectStore(STORE_NAME);
            var countRequest = store.count();
            countRequest.onsuccess = function() {
                if (countRequest.result === 0) {
                    console.log('[存储] 检测到 localStorage 有数据，开始迁移...');
                    migrateToIndexedDB();
                } else {
                    console.log('[存储] IndexedDB 已有数据，跳过迁移');
                }
            };
        } else {
            console.log('[存储] localStorage 无数据，跳过迁移');
        }
    }).catch(function(err) {
        console.warn('[存储] IndexedDB 初始化失败，使用 localStorage 降级模式:', err);
    });

    console.log('[存储] 存储管理器已加载，使用 IndexedDB 扩容');
})();
