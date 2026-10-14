'use strict';

(() => {
  const nativeGetItem = Storage.prototype.getItem;
  const nativeSetItem = Storage.prototype.setItem;
  let currentUser = null;
  let studyData = null;
  let saveTimer = null;
  let pendingData = null;
  let saveChain = Promise.resolve();
  let coreLoaded = false;
  let syncNotice = null;

  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      }
    });
    if (response.status === 204) return null;
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Yêu cầu thất bại (${response.status}).`);
    return body;
  }

  function renderAuth(errorMessage = '') {
    document.querySelector('#nav').replaceChildren();
    document.querySelector('#title').textContent = 'Đăng nhập để học và đồng bộ';
    const topButton = document.querySelector('#header-import');
    if (topButton) topButton.style.display = 'none';

    document.querySelector('#app').innerHTML = `
      <section class="hero auth-hero">
        <div class="card auth-card">
          <span class="badge">N3 STUDY STUDIO</span>
          <h2 id="auth-title">Đăng nhập</h2>
          <p class="muted">Từ vựng, tiến độ ôn tập và ghi chú được lưu riêng cho tài khoản của bạn.</p>
          <form id="auth-form">
            <label>Tên tài khoản
              <input name="username" autocomplete="username" minlength="3" maxlength="32" required>
            </label>
            <label>Mật khẩu
              <input name="password" type="password" autocomplete="current-password" minlength="12" maxlength="128" required>
            </label>
            <p id="auth-error" class="danger" role="alert"></p>
            <button class="primary" type="submit">Đăng nhập</button>
          </form>
          <p id="google-signin" hidden><a class="button" href="/api/auth/google">Tiếp tục với Google</a></p>
          <p><button id="auth-toggle" type="button">Chưa có tài khoản? Đăng ký</button></p>
          <small>Tên tài khoản: 3–32 ký tự. Mật khẩu: tối thiểu 12 ký tự.</small>
        </div>
        <div class="jp">学ぶ<br>毎日</div>
      </section>`;

    let registering = false;
    const form = document.querySelector('#auth-form');
    const passwordInput = form.elements.password;
    const error = document.querySelector('#auth-error');
    const authErrors = {
      'google-unavailable': 'Đăng nhập Google chưa được cấu hình trên máy chủ.',
      'google-state': 'Phiên đăng nhập Google không hợp lệ. Hãy thử lại.',
      'google-cancelled': 'Bạn đã hủy đăng nhập Google.',
      'google-unverified': 'Tài khoản Google chưa xác minh được email.'
    };
    const oauthError = new URLSearchParams(window.location.search).get('authError');
    error.textContent = errorMessage || authErrors[oauthError] || '';
    if (oauthError) history.replaceState(null, '', window.location.pathname);
    request('/api/auth/providers')
      .then((providers) => {
        if (providers.google) document.querySelector('#google-signin').hidden = false;
      })
      .catch((providerError) => console.error('Unable to load sign-in providers:', providerError));

    document.querySelector('#auth-toggle').addEventListener('click', () => {
      registering = !registering;
      document.querySelector('#auth-title').textContent = registering ? 'Tạo tài khoản' : 'Đăng nhập';
      form.querySelector('button[type="submit"]').textContent = registering ? 'Đăng ký' : 'Đăng nhập';
      document.querySelector('#auth-toggle').textContent = registering ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký';
      passwordInput.autocomplete = registering ? 'new-password' : 'current-password';
      error.textContent = '';
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submitButton = form.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      error.textContent = '';
      try {
        const payload = Object.fromEntries(new FormData(form));
        const result = await request(registering ? '/api/auth/register' : '/api/auth/login', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        currentUser = result.user;
        studyData = await request('/api/study-data');
        startCore();
      } catch (requestError) {
        error.textContent = requestError.message;
        submitButton.disabled = false;
      }
    });
  }

  function showSyncError(error) {
    if (!syncNotice) {
      syncNotice = document.createElement('div');
      syncNotice.className = 'sync-notice';
      syncNotice.setAttribute('role', 'alert');
      document.body.append(syncNotice);
    }
    syncNotice.replaceChildren(
      document.createTextNode(`Không đồng bộ được với máy chủ: ${error.message} Dữ liệu mới vẫn còn trong bộ nhớ trang này. Hãy thử lại hoặc xuất bản sao trước khi rời trang. `)
    );
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Thử lưu lại';
    retry.addEventListener('click', flushSave);
    syncNotice.append(retry);
  }

  function clearSyncError() {
    if (syncNotice) syncNotice.remove();
    syncNotice = null;
  }

  function flushSave() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!pendingData) return saveChain;
    const snapshot = pendingData;
    pendingData = null;
    saveChain = saveChain.then(async () => {
      await request('/api/study-data', {
        method: 'PUT',
        body: JSON.stringify(snapshot)
      });
      clearSyncError();
    }).catch((error) => {
      if (!pendingData) pendingData = snapshot;
      console.error('Study data sync failed:', error);
      showSyncError(error);
    });
    return saveChain;
  }

  function installStudyDataBridge() {
    Storage.prototype.getItem = function (key) {
      if (this === window.localStorage && key === 'n3studio') return JSON.stringify(studyData);
      return nativeGetItem.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (this === window.localStorage && key === 'n3studio') {
        try {
          studyData = JSON.parse(value);
          pendingData = studyData;
          clearTimeout(saveTimer);
          saveTimer = setTimeout(flushSave, 400);
        } catch (error) {
          console.error('Invalid study data update:', error);
          showSyncError(error);
        }
        return;
      }
      return nativeSetItem.call(this, key, value);
    };
  }

  function addAccountControls() {
    const header = document.querySelector('main header');
    const accountControl = document.createElement('div');
    accountControl.className = 'account-control';

    const avatarButton = document.createElement('button');
    avatarButton.className = 'account-avatar';
    avatarButton.type = 'button';
    avatarButton.setAttribute('aria-label', `Tài khoản ${currentUser.username}`);
    avatarButton.setAttribute('aria-haspopup', 'true');
    avatarButton.setAttribute('aria-expanded', 'false');

    const initials = currentUser.username.slice(0, 1).toLocaleUpperCase();
    const fallback = document.createElement('span');
    fallback.className = 'account-avatar-fallback';
    fallback.textContent = initials;
    avatarButton.append(fallback);
    if (currentUser.avatar_url) {
      const image = document.createElement('img');
      image.src = currentUser.avatar_url;
      image.alt = '';
      image.referrerPolicy = 'no-referrer';
      image.addEventListener('error', () => image.replaceWith(fallback), { once: true });
      avatarButton.replaceChildren(image);
    }

    const menu = document.createElement('div');
    menu.className = 'account-menu';
    menu.hidden = true;
    const username = document.createElement('span');
    username.className = 'account-name';
    username.textContent = currentUser.username;

    const logoutButton = document.createElement('button');
    logoutButton.className = 'account-logout';
    logoutButton.type = 'button';
    logoutButton.textContent = 'Đăng xuất';
    logoutButton.addEventListener('click', async () => {
      logoutButton.disabled = true;
      try {
        await flushSave();
        if (pendingData) throw new Error('Dữ liệu chưa lưu được. Hãy thử lưu lại trước khi đăng xuất.');
        await request('/api/auth/logout', { method: 'POST' });
        window.location.reload();
      } catch (error) {
        showSyncError(error);
        logoutButton.disabled = false;
      }
    });

    avatarButton.addEventListener('click', () => {
      menu.hidden = !menu.hidden;
      avatarButton.setAttribute('aria-expanded', String(!menu.hidden));
    });
    document.addEventListener('click', (event) => {
      if (!accountControl.contains(event.target)) {
        menu.hidden = true;
        avatarButton.setAttribute('aria-expanded', 'false');
      }
    });

    menu.append(username, logoutButton);
    accountControl.append(avatarButton, menu);
    header.querySelector('.header-actions').append(accountControl);
  }

  function startCore() {
    if (coreLoaded) return;
    coreLoaded = true;
    installStudyDataBridge();
    const topButton = document.querySelector('#header-import');
    if (topButton) topButton.style.display = '';
    addAccountControls();
    const script = document.createElement('script');
    script.src = '/app.js?v=browser-history-1';
    script.onload = () => {
      const grammarScript = document.createElement('script');
      grammarScript.src = '/grammar.js?v=browser-history-1';
      grammarScript.onerror = () => {
        console.error('Unable to load grammar study features.');
        document.querySelector('#app').innerHTML = '<div class="notice">Không tải được phần học ngữ pháp. Hãy tải lại trang để thử lại.</div>';
      };
      document.body.append(grammarScript);
    };
    script.onerror = () => renderAuth('Không tải được ứng dụng. Hãy tải lại trang để thử lại.');
    document.body.append(script);
  }

  window.addEventListener('beforeunload', (event) => {
    if (pendingData || saveTimer) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  request('/api/auth/me')
    .then(async ({ user }) => {
      if (!user) return renderAuth();
      currentUser = user;
      studyData = await request('/api/study-data');
      startCore();
    })
    .catch((error) => {
      renderAuth(`Không kết nối được máy chủ: ${error.message}. Hãy kiểm tra cấu hình triển khai.`);
    });
})();
