// script.js
import { db, auth, ADMIN_EMAILS, isAdminUser, extractYouTubeId, showToast } from './firebase.js';

// --- Global UI Helpers ---
function showLoader(show) {
  const el = document.getElementById('loader');
  if (!el) return;
  el.style.display = show ? 'block' : 'none';
}

function setCompactHeader(enable) {
  if (enable) document.body.classList.add('compact-header');
  else document.body.classList.remove('compact-header');
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
}

function showMsg(text, isError = false) {
  const el = document.getElementById('msg');
  if (!el) return;
  el.textContent = text;
  el.className = `msg ${isError ? 'error' : ''}`;
  if (text) { // Only clear if there's text to show
    setTimeout(() => { el.textContent = ''; el.className = 'msg'; }, 5000);
  }
}

// --- Authentication Logic ---
auth.onAuthStateChanged(user => {
  console.log('Auth state changed:', user ? user.email : 'Logged out');
  const path = window.location.pathname.split('/').pop() || 'index.html';
  const isAdmin = isAdminUser(); // Use the helper from firebase.js

  // Update navigation based on auth state
  const loginNavItem = document.getElementById('loginNavItem');
  const adminPanelNavItem = document.getElementById('adminPanelNavItem');

  if (loginNavItem && adminPanelNavItem) {
    if (user) { // User is logged in
      loginNavItem.style.display = 'none';
      adminPanelNavItem.style.display = isAdmin ? 'block' : 'none'; // Only show Admin Panel if user is admin
    } else { // No user logged in
      loginNavItem.style.display = 'block';
      adminPanelNavItem.style.display = 'none';
    }
  }

  // Handle display logic for admin.html
  if (path === 'admin.html') {
      const adminLoginFormContainer = document.getElementById('adminLoginFormContainer');
      const adminControlsPanel = document.getElementById('adminControlsPanel');
      const adminPlaylistContainer = document.getElementById('playlist'); // Assuming playlist section is main content

      if (user && isAdmin) {
          // Logged in as admin: Hide login form, show controls & playlist
          if (adminLoginFormContainer) adminLoginFormContainer.style.display = 'none';
          if (adminControlsPanel) adminControlsPanel.style.display = 'flex'; // Use flex to align logout button
          renderAdminPlaylist();
      } else if (user && !isAdmin) {
          // Logged in as non-admin: Redirect to home, toast message
          showToast('Access denied. Admin privileges required.', 'error');
          window.location.href = 'index.html';
      } else {
          // Not logged in: Show login form, hide controls & playlist (or show placeholder)
          if (adminLoginFormContainer) adminLoginFormContainer.style.display = 'block';
          if (adminControlsPanel) adminControlsPanel.style.display = 'none';
          if (adminPlaylistContainer) adminPlaylistContainer.innerHTML = '<div class="empty">Please log in as an administrator to manage the playlist.</div>';
      }

      const logoutBtn = document.getElementById('adminLogoutButton');
      if (logoutBtn) {
          logoutBtn.onclick = signOutAndGoHome; // Attach handler
      }

  } else if (path === 'playlist.html') {
      // For public playlist view, regardless of login status (but not admin management)
      renderPublicPlaylist();
  }
});


function handleLogin(email, password) {
  showLoader(true);
  auth.signInWithEmailAndPassword(email, password)
    .then(userCredential => {
      showLoader(false);
      const user = userCredential.user;
      if (isAdminUser()) { // Use isAdminUser helper
        showToast('Login successful! Redirecting to Admin Panel...', 'success');
        // No explicit redirect needed here, auth.onAuthStateChanged will handle UI update and content
      } else {
        auth.signOut();
        showMsg('Access denied. Admin only.', true);
        showToast('Access denied. Admin only.', 'error'); // Also show toast
      }
    })
    .catch(e => {
      showLoader(false);
      console.error('Login error:', e);
      showMsg(e.message === 'auth/wrong-password' ? 'Wrong password.' : e.message, true);
      showToast(e.message === 'auth/wrong-password' ? 'Wrong password.' : e.message, 'error'); // Also show toast
    });
}

function signOutAndGoHome() {
  showLoader(true); // Show loader during sign out
  auth.signOut().then(() => {
    showLoader(false); // Hide loader after sign out
    showToast('Signed out successfully.', 'success');
    window.location.href = 'index.html'; // Redirect to home as per brief
  }).catch(err => {
    showLoader(false); // Hide loader if error
    console.error(err);
    showToast('Error signing out', 'error');
  });
}

// --- Playlist Rendering (Admin View) ---
function renderAdminPlaylist() {
    const container = document.getElementById('playlist');
    if (!container) return;
    container.innerHTML = '<div class="loader-inline"></div><p style="text-align:center;">Loading playlist for admin...</p>'; // Inline loader

    db.collection('submissions').orderBy('created', 'desc').get()
        .then(snapshot => {
            container.innerHTML = '';
            if (snapshot.empty) {
                container.innerHTML = '<div class="empty">No submissions yet.</div>';
                return;
            }
            snapshot.forEach(doc => {
                const item = { id: doc.id, ...doc.data() };
                const div = document.createElement('div');
                div.className = 'playlist-item';
                const thumbUrl = item.image || (item.youtubeId ? `https://img.youtube.com/vi/${item.youtubeId}/hqdefault.jpg` : '');
                const createdDate = item.created ? new Date(item.created.toDate()).toLocaleString() : 'Unknown';

                div.innerHTML = `
                    <div class="thumb">${thumbUrl ? `<img src="${escapeHtml(thumbUrl)}" alt="Thumbnail" onerror="this.src='https://via.placeholder.com/140x80?text=No+Image';"/>` : '<div class="thumb-placeholder">No Image</div>'}</div>
                    <div class="info">
                        <h4>${escapeHtml(item.title || '(No title)')}</h4>
                        <p>${escapeHtml(item.performer || 'Unknown')} · ${createdDate}</p>
                        ${item.notes ? `<p style="color:var(--muted);font-size:13px;margin-top:8px;">${escapeHtml(item.notes)}</p>` : ''}
                    </div>
                    <div class="controls">
                        <button class="small-btn" data-action="play" data-id="${item.id}">▶ Play</button>
                        <button class="small-btn small-btn-delete" data-action="delete" data-id="${item.id}">🗑 Delete</button>
                    </div>
                `;
                container.appendChild(div);
            });
            container.querySelectorAll('.controls button').forEach(btn => {
                btn.addEventListener('click', e => {
                    const action = btn.dataset.action;
                    const id = btn.dataset.id;
                    handleAdminAction(action, id);
                });
            });
        })
        .catch(e => {
            console.error('Admin Playlist error:', e);
            container.innerHTML = `<div class="empty error">Error loading: ${e.message}</div>`;
            showToast('Error loading admin playlist.', 'error');
        });
}

// --- Playlist Rendering (Public View) ---
function renderPublicPlaylist() {
    const container = document.getElementById('playlist');
    if (!container) return;
    container.innerHTML = '<div class="loader-inline"></div><p style="text-align:center;">Loading playlist...</p>';

    db.collection('submissions').orderBy('created', 'desc').get()
        .then(snapshot => {
            container.innerHTML = '';
            if (snapshot.empty) {
                container.innerHTML = '<div class="empty">No submissions yet. Ask members to submit songs.</div>';
                return;
            }
            snapshot.forEach(doc => {
                const item = { id: doc.id, ...doc.data() };
                const div = document.createElement('div');
                div.className = 'playlist-item';
                const thumbUrl = item.image || (item.youtubeId ? `https://img.youtube.com/vi/${item.youtubeId}/hqdefault.jpg` : '');
                const createdDate = item.created ? new Date(item.created.toDate()).toLocaleString() : 'Unknown';

                div.innerHTML = `
                    <div class="thumb">${thumbUrl ? `<img src="${escapeHtml(thumbUrl)}" alt="Thumbnail" onerror="this.src='https://via.placeholder.com/140x80?text=No+Image';"/>` : '<div class="thumb-placeholder">No Image</div>'}</div>
                    <div class="info">
                        <h4>${escapeHtml(item.title || '(No title)')}</h4>
                        <p>${escapeHtml(item.performer || 'Unknown')} · ${createdDate}</p>
                        ${item.notes ? `<p style="color:var(--muted);font-size:13px;margin-top:8px;">${escapeHtml(item.notes)}</p>` : ''}
                    </div>
                    <div class="controls">
                        <button class="small-btn" data-action="play" data-id="${item.id}">▶ Play</button>
                    </div>
                `;
                container.appendChild(div);
            });
            container.querySelectorAll('.controls button').forEach(btn => {
                btn.addEventListener('click', e => {
                    const action = btn.dataset.action;
                    const id = btn.dataset.id;
                    handlePublicAction(action, id);
                });
            });
        })
        .catch(e => {
            console.error('Public Playlist error:', e);
            container.innerHTML = `<div class="empty error">Error loading: ${e.message}</div>`;
            showToast('Error loading public playlist.', 'error');
        });
}


// --- Action Handlers ---
function handlePublicAction(action, id) {
  if (action === 'play') {
    getSubmission(id).then(item => {
      if (item && item.youtube) window.open(item.youtube, '_blank');
      else showToast('Could not load video.', 'error');
    });
  }
}

function handleAdminAction(action, id) {
  if (!isAdminUser()) {
    showToast('Admin login required for this action.', 'error');
    window.location.href = 'index.html'; // Redirect if somehow unauthorized
    return;
  }

  if (action === 'play') {
    getSubmission(id).then(item => {
      if (item && item.youtube) window.open(item.youtube, '_blank');
      else showToast('Could not load video.', 'error');
    });
  } else if (action === 'delete') {
    if (!confirm('Are you sure you want to delete this submission? This action cannot be undone.')) return;
    db.collection('submissions').doc(id).delete()
      .then(() => {
        renderAdminPlaylist(); // Re-render admin playlist after delete
        showToast('Submission deleted successfully.', 'success');
      })
      .catch(e => {
          showToast('Error deleting: ' + e.message, 'error');
          console.error('Delete error:', e);
      });
  }
}

function getSubmission(id) {
  return db.collection('submissions').doc(id).get()
    .then(docSnap => docSnap.exists ? { id, ...docSnap.data() } : null)
    .catch(e => { console.error('Fetch error:', e); return null; });
}

// --- DOM Ready Event Listener ---
document.addEventListener('DOMContentLoaded', () => {
  // Set compact header for non-home pages
  const path = window.location.pathname.split('/').pop() || 'index.html';
  if (path !== 'index.html') {
    setCompactHeader(true);
  } else {
    setCompactHeader(false);
  }

  // Submit Form Handler
  const submitForm = document.getElementById('submitForm');
  if (submitForm) {
    submitForm.addEventListener('submit', ev => {
      ev.preventDefault();
      const submitBtn = submitForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<span class="loading"></span>Saving...';
      submitBtn.disabled = true;

      const title = document.getElementById('title').value.trim();
      const performer = document.getElementById('performer').value.trim();
      const youtube = document.getElementById('youtube').value.trim();
      const image = document.getElementById('image').value.trim();
      const notes = document.getElementById('notes').value.trim();

      if (!title || !youtube) {
        showMsg('Title and YouTube URL are required.', true);
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        return;
      }

      const youtubeId = extractYouTubeId(youtube); // Use helper from firebase.js
      if (!youtubeId) {
        showMsg('Invalid YouTube URL provided.', true);
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        return;
      }

      db.collection('submissions').add({
        title,
        performer: performer || null,
        youtube,
        youtubeId,
        image: image || null,
        notes: notes || null,
        created: firebase.firestore.Timestamp.now()
      }).then(() => {
        submitForm.reset();
        showMsg('Your submission has been saved!', false);
        showToast('Submission successful!', 'success');
      }).catch(e => {
        showMsg('Error saving submission: ' + e.message, true);
        showToast('Error saving submission', 'error');
      }).finally(() => {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      });
    });
  }

  // Admin Login Form Handler (only on admin.html)
  const loginForm = document.getElementById('adminLoginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', ev => {
      ev.preventDefault();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value.trim();
      if (!email || !password) {
        showMsg('Email and password are required for login.', true);
        return;
      }
      handleLogin(email, password);
    });
  }
});