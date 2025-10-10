// Firebase Config - Your unique config
const firebaseConfig = {
  apiKey: "AIzaSyCa7xd7wyEEeoQ4y1HYBSrHr1VNzL1hX8Y",
  authDomain: "lhbc-media-hub.firebaseapp.com",
  projectId: "lhbc-media-hub",
  storageBucket: "lhbc-media-hub.firebasestorage.app",
  messagingSenderId: "451866693777",
  appId: "1:451866693777:web:bc1c85ceae7d95ef9b2f30",
  measurementId: "G-3SY609VXPJ"
};

// Initialize Firebase (using compat for global access)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Disable Firestore persistence for static sites (reduces stream errors)
db.enablePersistence().catch(err => console.log('Persistence failed:', err));

// Helper: Extract YouTube ID from URL
function extractYouTubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    if (u.searchParams.get('v')) return u.searchParams.get('v');
    const p = u.pathname.split('/');
    return p.pop() || p[p.length - 2];  // Handle /embed/ or /watch?v=
  } catch (e) {
    return null;
  }
}

// Show message (success/error)
function showMsg(text, isError = false) {
  const el = document.getElementById('msg');
  if (!el) return;
  el.textContent = text;
  el.className = `msg ${isError ? 'error' : ''}`;
  setTimeout(() => { el.textContent = ''; el.className = 'msg'; }, 5000);  // Longer timeout
}

// Escape HTML to prevent XSS
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
}

// Handle actions: play or delete
function handleAction(action, id) {
  if (action === 'play') {
    getSubmission(id).then(item => {
      if (item && item.youtube) {
        window.open(item.youtube, '_blank');
      } else {
        showMsg('Could not load video. Invalid submission.', true);
      }
    }).catch(e => {
      console.error('Play error:', e);
      showMsg('Error playing video: ' + e.message, true);
    });
  } else if (action === 'delete') {
    if (!confirm('Delete this submission? This cannot be undone.')) return;
    db.collection('submissions').doc(id).delete()
      .then(() => {
        renderPlaylist();
        showMsg('Deleted successfully.');
      })
      .catch(e => {
        console.error('Delete error:', e);
        showMsg('Error deleting: ' + (e.code === 'permission-denied' ? 'Check database rules.' : e.message), true);
      });
  }
}

// Get single submission by doc ID (for play button)
function getSubmission(id) {
  return db.collection('submissions').doc(id).get()
    .then(docSnap => {
      if (docSnap.exists) {
        return { id, ...docSnap.data() };
      }
      return null;
    })
    .catch(e => {
      console.error('Fetch submission error:', e);
      return null;
    });
}

// Render playlist from Firebase
function renderPlaylist() {
  const container = document.getElementById('playlist');
  if (!container) return;

  container.innerHTML = '<div class="loading">Loading submissions...</div>';

  db.collection('submissions').orderBy('created', 'desc').get()
    .then(snapshot => {
      container.innerHTML = '';

      if (snapshot.empty) {
        container.innerHTML = '<div class="empty">No submissions yet. Ask members to submit songs/videos!</div>';
        return;
      }

      let itemCount = 0;
      snapshot.forEach(doc => {
        const item = { id: doc.id, ...doc.data() };
        const div = document.createElement('div');
        div.className = 'playlist-item';
        const thumbUrl = item.image || (item.youtubeId ? `https://img.youtube.com/vi/${item.youtubeId}/hqdefault.jpg` : '');
        div.innerHTML = `
          <div class="thumb">
            ${thumbUrl ? `<img src="${escapeHtml(thumbUrl)}" alt="Thumbnail" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';"/>` : '<div style="background:#ddd;width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#999;">No Image</div>'}
          </div>
          <div class="info">
            <h4>${escapeHtml(item.title || '(No title)')}</h4>
            <p>${escapeHtml(item.performer || 'Unknown')} · ${item.created ? new Date(item.created.toDate()).toLocaleString() : 'Unknown date'}</p>
            ${item.notes ? `<p style="color:var(--muted);font-size:13px;margin-top:8px;">${escapeHtml(item.notes)}</p>` : ''}
          </div>
          <div class="controls">
            <button class="small-btn" data-action="play" data-id="${item.id}">▶ Play</button>
            <button class="small-btn" data-action="delete" data-id="${item.id}">🗑 Delete</button>
          </div>
        `;
        container.appendChild(div);
        itemCount++;
      });

      // Add event listeners
      container.querySelectorAll('.controls button').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const action = btn.getAttribute('data-action');
          const id = btn.getAttribute('data-id');
          handleAction(action, id);
        });
      });

      console.log(`Loaded ${itemCount} submissions successfully.`);
    })
    .catch(e => {
      console.error('Playlist load error:', e);
      let msg = 'Error loading playlist: ';
      if (e.code === 'permission-denied') msg += 'Database rules block access. Update rules in Firebase.';
      else if (e.code === 'unavailable') msg += 'No internet or server issue. Try refreshing.';
      else msg += e.message;
      container.innerHTML = `<div class="empty error">${msg}</div>`;
      showMsg(msg, true);
    });
}

// Main event listener
document.addEventListener('DOMContentLoaded', () => {
  // Handle form submission
  const form = document.getElementById('submitForm');
  if (form) {
    form.addEventListener('submit', (ev) => {
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

      // Validation
      if (!title) {
        showMsg('Song title is required.', true);
        resetBtn();
        return;
      }
      if (!youtube) {
        showMsg('YouTube link is required.', true);
        resetBtn();
        return;
      }

      const youtubeId = extractYouTubeId(youtube);
      if (!youtubeId) {
        showMsg('Please enter a valid YouTube URL (e.g., https://www.youtube.com/watch?v=VIDEO_ID).', true);
        resetBtn();
        return;
      }

      function resetBtn() {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }

      // Save to Firebase (use client timestamp to avoid clock issues)
      db.collection('submissions').add({
        title,
        performer: performer || null,
        youtube,
        youtubeId,
        image: image || null,
        notes: notes || null,
        created: firebase.firestore.Timestamp.now()  // Server-synced timestamp
      })
      .then(() => {
        form.reset();
        showMsg('Submission saved! View it in the playlist on any device.');
        console.log('Submission saved successfully.');
        // Optional: Redirect to playlist
        // setTimeout(() => window.location.href = 'playlist.html', 2000);
      })
      .catch(e => {
        console.error('Submit error:', e);
        let msg = 'Error saving: ';
        if (e.code === 'permission-denied') msg += 'Database rules block writes. Update in Firebase Console.';
        else if (e.code === 'unavailable') msg += 'No internet. Try again.';
        else msg += e.message;
        showMsg(msg, true);
      })
      .finally(() => resetBtn());
    });
  }

  // Load playlist
  const playlistEl = document.getElementById('playlist');
  if (playlistEl) {
    renderPlaylist();
  }
});
