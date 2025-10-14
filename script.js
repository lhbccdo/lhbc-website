// Firebase Config
const firebaseConfig = {
  apiKey: "YOUR_NEW_API_KEY_HERE",
  authDomain: "lhbc-media-hub.firebaseapp.com",
  projectId: "lhbc-media-hub",
  storageBucket: "lhbc-media-hub.firebasestorage.app",
  messagingSenderId: "451866693777",
  appId: "1:451866693777:web:dcdc3f8fa6f4b5c79b2f30",
  measurementId: "G-3SY609VXPJ"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Admin emails (match your rules)
const ADMIN_EMAILS = ['lhbc.cdo@gmail.com']; 
const ADMIN_EMAILS = ['hans55jerald@gmail.com'];

// Helper: Check if current user is admin
function isAdmin() {
  const user = auth.currentUser;
  return user && ADMIN_EMAILS.includes(user.email);
}

// Listen for auth changes (auto-redirect or show status)
auth.onAuthStateChanged(user => {
  if (user && isAdmin()) {
    console.log('Admin logged in:', user.email);
    // Optional: Redirect to playlist
    if (window.location.pathname.includes('login.html')) {
      window.location.href = 'playlist.html';
    }
  } else if (window.location.pathname.includes('login.html')) {
    // Stay on login if not admin
  } else {
    console.log('Not admin or logged out');
  }
  // Re-render playlist if on that page
  if (document.getElementById('playlist')) {
    renderPlaylist();
  }
});

// Login function
function handleLogin(email, password) {
  auth.signInWithEmailAndPassword(email, password)
    .then(userCredential => {
      const user = userCredential.user;
      if (isAdmin()) {
        showMsg('Login successful! Redirecting to playlist...');
        setTimeout(() => window.location.href = 'playlist.html', 1500);
      } else {
        auth.signOut();  // Log out non-admin
        showMsg('Access denied. Admin only.', true);
      }
    })
    .catch(e => {
      console.error('Login error:', e);
      showMsg(e.message === 'auth/wrong-password' ? 'Wrong password.' : e.message, true);
    });
}

// Logout function (add to playlist if needed)
function logout() {
  auth.signOut().then(() => {
    showMsg('Logged out.');
    window.location.href = 'index.html';
  });
}

// Rest of your existing code (extractYouTubeId, showMsg, escapeHtml, etc.) - paste from previous version
function extractYouTubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    if (u.searchParams.get('v')) return u.searchParams.get('v');
    const p = u.pathname.split('/');
    return p.pop() || p[p.length - 2];
  } catch (e) {
    return null;
  }
}

function showMsg(text, isError = false) {
  const el = document.getElementById('msg');
  if (!el) return;
  el.textContent = text;
  el.className = `msg ${isError ? 'error' : ''}`;
  setTimeout(() => { el.textContent = ''; el.className = 'msg'; }, 5000);
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
}

// Updated handleAction (delete only for admins)
function handleAction(action, id) {
  if (action === 'play') {
    getSubmission(id).then(item => {
      if (item && item.youtube) window.open(item.youtube, '_blank');
      else showMsg('Could not load video.', true);
    });
  } else if (action === 'delete') {
    if (!isAdmin()) {
      showMsg('Admin login required to delete.', true);
      window.location.href = 'login.html';
      return;
    }
    if (!confirm('Delete this submission?')) return;
    db.collection('submissions').doc(id).delete()
      .then(() => {
        renderPlaylist();
        showMsg('Deleted successfully.');
      })
      .catch(e => showMsg('Error deleting: ' + e.message, true));
  }
}

// getSubmission, renderPlaylist, form submit - paste from your previous script.js (unchanged except for admin check in render)
function getSubmission(id) {
  return db.collection('submissions').doc(id).get()
    .then(docSnap => docSnap.exists ? { id, ...docSnap.data() } : null)
    .catch(e => { console.error('Fetch error:', e); return null; });
}

function renderPlaylist() {
  const container = document.getElementById('playlist');
  if (!container) return;
  container.innerHTML = '<div class="loading">Loading...</div>';

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
        div.innerHTML = `
          <div class="thumb">${thumbUrl ? `<img src="${escapeHtml(thumbUrl)}" alt="Thumbnail" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';"/>` : '<div style="background:#ddd;width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#999;">No Image</div>'}</div>
          <div class="info">
            <h4>${escapeHtml(item.title || '(No title)')}</h4>
            <p>${escapeHtml(item.performer || 'Unknown')} · ${item.created ? new Date(item.created.toDate()).toLocaleString() : 'Unknown'}</p>
            ${item.notes ? `<p style="color:var(--muted);font-size:13px;margin-top:8px;">${escapeHtml(item.notes)}</p>` : ''}
          </div>
          <div class="controls">
            <button class="small-btn" data-action="play" data-id="${item.id}">▶ Play</button>
            ${isAdmin() ? `<button class="small-btn" data-action="delete" data-id="${item.id}">🗑 Delete</button>` : ''}
          </div>
        `;
        container.appendChild(div);
      });
      // Event listeners
      container.querySelectorAll('.controls button').forEach(btn => {
        btn.addEventListener('click', e => {
          const action = btn.dataset.action;
          const id = btn.dataset.id;
          handleAction(action, id);
        });
      });
    })
    .catch(e => {
      console.error('Playlist error:', e);
      container.innerHTML = '<div class="empty error">Error loading: ' + e.message + '</div>';
    });
}

// Form submit (unchanged)
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('submitForm');
  if (form) {
    form.addEventListener('submit', ev => {
      ev.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<span class="loading"></span>Saving...';
      submitBtn.disabled = true;

      const title = document.getElementById('title').value.trim();
      const performer = document.getElementById('performer').value.trim();
      const youtube = document.getElementById('youtube').value.trim();
      const image = document.getElementById('image').value.trim();
      const notes = document.getElementById('notes').value.trim();

      if (!title || !youtube) {
        showMsg('Title and YouTube required.', true);
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        return;
      }

      const youtubeId = extractYouTubeId(youtube);
      if (!youtubeId) {
        showMsg('Invalid YouTube URL.', true);
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        return;
      }

      db.collection('submissions').add({
        title, performer: performer || null, youtube, youtubeId, image: image || null, notes: notes || null,
        created: firebase.firestore.Timestamp.now()
      }).then(() => {
        form.reset();
        showMsg('Saved! View in playlist.');
      }).catch(e => showMsg('Save error: ' + e.message, true))
        .finally(() => {
          submitBtn.innerHTML = originalText;
          submitBtn.disabled = false;
        });
    });
  }

  // Login form
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', ev => {
      ev.preventDefault();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value.trim();
      if (!email || !password) {
        showMsg('Email and password required.', true);
        return;
      }
      handleLogin(email, password);
    });
  }

  // Load playlist
  if (document.getElementById('playlist')) renderPlaylist();
});

